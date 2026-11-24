// 同期・バックアップの状態変化と日次ダイジェストを Discord に通知する
//   CLOUD  : クラウドとローカルの動き（同期、Proton Drive の認証）
//   BACKUP : ローカルと世代管理の動き（バックアップ、スナップショット）
// sync.sh / backup.sh が /history に書く履歴を定期的に読み、「状態が変わったとき」だけ通知する
// （失敗が続いても毎回は通知しない）
const fs = require('fs/promises');
const path = require('path');
const { isDev, COLORS } = require('../constants');
const { CustomEmbedBuilder } = require('../embedBuilder');
const { dockerExec } = require('./dockerExec');
const {
  JOBS, readHistory, readLastOutput, describeRun, formatDateTime
} = require('./history');

const HISTORY_DIR = process.env.HISTORY_DIR || '/history';
const POLL_MS = 60 * 1000;
// 日次ダイジェストの送信時刻（日本時間）
const DIGEST_HOUR_JST = 8;
const JST_OFFSET_MS = 9 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
// sync.sh の AUTH_ERROR_EXIT / restic の「一部のファイルを読めなかった」終了コード
const AUTH_ERROR_EXIT = 4;
const PARTIAL_EXIT = 3;
const MAX_OUTPUT_CHARS = 900;

// 実行結果を ok / partial / auth / fail のどれかに分類する
function classify(job, run) {
  if (run.ok) return 'ok';
  if (job === 'sync' && run.exitCode === AUTH_ERROR_EXIT) return 'auth';
  if (job === 'backup' && run.exitCode === PARTIAL_EXIT) return 'partial';
  return 'fail';
}

// sync.sh が書く認証エラーの状態（なければ null）
async function readAuthState() {
  try {
    const [kind, epoch] = (await fs.readFile(path.join(HISTORY_DIR, 'sync.state'), 'utf8')).trim().split('\t');
    return kind === 'auth_error' ? { since: new Date(Number(epoch) * 1000) } : null;
  } catch {
    return null;
  }
}

function embed(title, description, color, fields = []) {
  const e = new CustomEmbedBuilder().setTitle(title).setDescription(description).setColor(color);
  e.embedData.fields.push(...fields);
  return e.build();
}

async function send(channel, payload, label) {
  if (!channel) {
    console.warn(`notifier.js: ${label} のチャンネルが未設定のため通知しません`);
    return;
  }
  try {
    await channel.send({ embeds: [payload] });
  } catch (err) {
    console.error(`\nnotifier.js (${label})\n${err}\n`);
  }
}

async function lastOutputField(job) {
  const out = await readLastOutput(job);
  if (!out) return [];
  return [{ name: '直近の出力', value: `\`\`\`\n${out.slice(-MAX_OUTPUT_CHARS)}\n\`\`\`` }];
}

const CHANNEL_KEY = { sync: 'CLOUD', backup: 'BACKUP' };

// ジョブごとの前回の状態（メモリ上）。Bot の再起動時は、現在の状態を基準にする
const known = {
  sync: { initialized: false, lastStart: 0, status: 'ok', failStreak: 0, auth: false },
  backup: { initialized: false, lastStart: 0, status: 'ok', failStreak: 0, auth: false }
};

// 状態の変化を通知メッセージに変換する（変化がなければ何も返さない）
async function describeChange(job, runs, authState) {
  const k = known[job];
  const label = JOBS[job].label;
  const notices = [];

  const fresh = runs.filter(r => r.start.getTime() > k.lastStart);
  const first = !k.initialized;

  // 認証エラー（同期のみ）: 状態ファイルの有無で判断する
  if (job === 'sync') {
    if (authState && !k.auth) {
      notices.push(embed('🔑 Proton Drive の再認証が必要です',
        '認証が切れたため、同期（マウント）を止めています。再認証されるまで、ログインを再試行しません（レート制限を避けるため）。',
        COLORS.ERROR, [
          { name: '対処', value: '1. `rclone config` で `protondrive` を作り直す（2FA コードが必要）\n2. `docker compose start rclone-sync`（停止している場合）\n\n`rclone.conf` が更新されると、自動的に再開します。' },
          { name: '検知', value: formatDateTime(authState.since) }
        ]));
    } else if (!authState && k.auth) {
      notices.push(embed('✅ Proton Drive の認証が回復しました', '同期（マウント）を再開しました。', COLORS.SUCCESS));
    }
    k.auth = Boolean(authState);
  }

  for (const run of fresh) {
    const status = classify(job, run);
    const prev = k.status;
    if (status === 'ok') {
      // 認証エラーからの回復は、認証の回復通知で知らせ済み
      if (!first && prev !== 'ok' && prev !== 'auth') {
        const extra = k.failStreak > 1 ? `（${k.failStreak}回連続で失敗していました）` : '';
        notices.push(embed(`✅ ${label}が回復しました`, `${describeRun(run)}${extra}`, COLORS.SUCCESS));
      }
      k.failStreak = 0;
    } else {
      k.failStreak++;
      // 認証エラーは上で通知済み。失敗が続く間は、最初の1回だけ通知する
      if (status !== 'auth' && (prev === 'ok' || prev === 'auth' || status !== prev)) {
        const partial = status === 'partial';
        notices.push(embed(
          partial ? `⚠️ ${label}: 一部のファイルを読めませんでした` : `❌ ${label}に失敗しました`,
          partial
            ? `${describeRun(run)}\n読めた分だけのスナップショットを保存し、partial タグを付けました。世代の整理は行っていません。`
            : describeRun(run),
          partial ? COLORS.WARNING : COLORS.ERROR,
          run === runs.at(-1) ? await lastOutputField(job) : []
        ));
      }
    }
    k.status = status;
    k.lastStart = run.start.getTime();
  }

  // 起動直後は過去の履歴を通知せず、失敗が続いている場合だけ知らせる
  if (first) {
    k.initialized = true;
    const latest = runs.at(-1);
    const ongoing = [];
    if (latest && classify(job, latest) !== 'ok' && classify(job, latest) !== 'auth') {
      ongoing.push(embed(`❌ ${label}: 失敗が続いています`, `Bot の起動時点の最終実行: ${describeRun(latest)}`, COLORS.ERROR, await lastOutputField(job)));
    }
    if (job === 'sync' && authState) {
      ongoing.push(notices.find(n => n.data.title.includes('再認証')));
    }
    return ongoing.filter(Boolean);
  }
  return notices;
}

async function poll(CHANNELS) {
  const authState = await readAuthState();
  for (const job of ['sync', 'backup']) {
    // 開発モードでは bisync を動かさないため、同期の履歴はない（認証エラーの状態は読む）
    const runs = await readHistory(job);
    try {
      for (const notice of await describeChange(job, runs, job === 'sync' ? authState : null)) {
        await send(CHANNELS[CHANNEL_KEY[job]], notice, CHANNEL_KEY[job]);
      }
    } catch (err) {
      console.error(`\nnotifier.js poll (${job})\n${err}\n`);
    }
  }
}

// --- 日次ダイジェスト ---

// 直近24時間の実行を要約する
function summarizeRuns(runs, now) {
  const recent = runs.filter(r => now - r.start <= DAY_MS);
  if (recent.length === 0) return null;
  const ng = recent.filter(r => !r.ok).length;
  const last = runs.at(-1);
  return { total: recent.length, ok: recent.length - ng, ng, last };
}

async function syncDigest(now) {
  const authState = await readAuthState();
  const fields = [];
  const { getStorageUsage } = require('../../services/status');

  if (authState) {
    fields.push({ name: '🔑 認証', value: `❌ 再認証が必要です（${formatDateTime(authState.since)} から）` });
  } else {
    fields.push({ name: '🔑 認証', value: '✅ 正常' });
  }

  if (isDev) {
    fields.push({ name: '☁️ 同期', value: '開発モード（クラウドを直接マウント中・同期は停止）' });
  } else {
    const s = summarizeRuns(await readHistory('sync'), now);
    fields.push({
      name: '☁️ 同期（24時間）',
      value: s
        ? `実行 ${s.total}回: ✅ ${s.ok} / ❌ ${s.ng}\n最終: ${describeRun(s.last, now)}`
        : '実行記録がありません'
    });
  }

  const storages = await Promise.all([
    getStorageUsage({ name: 'Cloud-Sync', path: '/mnt/data/cloud' }),
    getStorageUsage({ name: 'Local-NAS', path: '/mnt/data/local' })
  ]);
  fields.push(...storages.map(s => ({ name: `ストレージ: ${s.name}`, value: s.value, inline: true })));

  const bad = authState || (!isDev && summarizeRuns(await readHistory('sync'), now)?.ng > 0);
  return embed('📋 クラウド・ローカル 日次レポート', 'クラウドとローカルの同期の、直近24時間の状況です。', bad ? COLORS.WARNING : COLORS.INFO, fields);
}

// restic のスナップショット数（取得できなければ null）
async function snapshotCount(extraArgs = '') {
  try {
    const { output } = await dockerExec('naspi_restic', ['sh', '-c', `restic -r /backup/repo snapshots ${extraArgs} --compact 2>&1 | tail -1`]);
    const m = output.match(/(\d+)\s+snapshots?/);
    return m ? Number(m[1]) : (/no snapshots/i.test(output) ? 0 : null);
  } catch {
    return null;
  }
}

async function backupDigest(now) {
  const runs = await readHistory('backup');
  const s = summarizeRuns(runs, now);
  const fields = [{
    name: '💾 バックアップ（24時間）',
    value: s
      ? `実行 ${s.total}回: ✅ ${s.ok} / ❌ ${s.ng}\n最終: ${describeRun(s.last, now)}`
      : runs.length > 0 ? `この24時間の実行はありません（最終: ${describeRun(runs.at(-1), now)}）` : '実行記録がありません'
  }];

  const [total, partial] = await Promise.all([snapshotCount(), snapshotCount('--tag partial')]);
  if (total !== null) {
    fields.push({ name: '🗂️ 世代（スナップショット）', value: `${total}件${partial ? `（うち不完全 ${partial}件）` : ''}\n方針: 日次7・週次2`, inline: false });
  }

  const bad = (s && s.ng > 0) || partial;
  return embed('📋 バックアップ・世代管理 日次レポート', 'ローカルのデータと世代管理の、直近24時間の状況です。', bad ? COLORS.WARNING : COLORS.INFO, fields);
}

// 次の DIGEST_HOUR_JST 時までの待ち時間
function msUntilNextDigest(now = Date.now()) {
  const jstNow = now + JST_OFFSET_MS;
  const startOfDay = Math.floor(jstNow / DAY_MS) * DAY_MS;
  let target = startOfDay + DIGEST_HOUR_JST * 3600 * 1000;
  if (target <= jstNow) target += DAY_MS;
  return target - jstNow;
}

async function sendDigests(CHANNELS) {
  const now = Date.now();
  try { await send(CHANNELS.CLOUD, await syncDigest(now), 'CLOUD'); } catch (e) { console.error(`\nnotifier.js digest(sync)\n${e}\n`); }
  try { await send(CHANNELS.BACKUP, await backupDigest(now), 'BACKUP'); } catch (e) { console.error(`\nnotifier.js digest(backup)\n${e}\n`); }
}

function scheduleDigest(CHANNELS) {
  setTimeout(async () => {
    await sendDigests(CHANNELS);
    scheduleDigest(CHANNELS);
  }, msUntilNextDigest());
}

function start(CHANNELS) {
  poll(CHANNELS);
  setInterval(() => poll(CHANNELS), POLL_MS);
  scheduleDigest(CHANNELS);
}

module.exports = {
  start,
  readAuthState,
  poll,
  sendDigests,
  classify,
  msUntilNextDigest
};
