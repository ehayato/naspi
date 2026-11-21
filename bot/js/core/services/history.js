const fs = require('fs/promises');
const path = require('path');

// sync.sh / backup.sh が実行のたびに追記する履歴（docker-compose.yml で読み取り専用マウント）
// 形式: 開始時刻(epoch秒)<TAB>auto|manual<TAB>終了コード<TAB>所要秒
const HISTORY_DIR = process.env.HISTORY_DIR || '/history';

const JOBS = {
  sync: { label: 'クラウド同期', emoji: '☁️', intervalSec: Number(process.env.SYNC_INTERVAL) || 1800 },
  backup: { label: 'バックアップ', emoji: '💾', intervalSec: Number(process.env.BACKUP_INTERVAL) || 86400 }
};

async function readHistory(job) {
  let raw;
  try {
    raw = await fs.readFile(path.join(HISTORY_DIR, `${job}.tsv`), 'utf8');
  } catch {
    return [];
  }

  return raw.split('\n')
    .map(line => {
      const [epoch, trigger, exitCode, duration] = line.split('\t');
      if (!epoch || !trigger) return null;

      return {
        start: new Date(Number(epoch) * 1000),
        auto: trigger === 'auto',
        exitCode: Number(exitCode),
        duration: Number(duration),
        ok: Number(exitCode) === 0
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

// 直近の実行の出力（上書きされるため、最後の1回分のみ）
async function readLastOutput(job) {
  try {
    return (await fs.readFile(path.join(HISTORY_DIR, `${job}.last.log`), 'utf8')).trim();
  } catch {
    return '';
  }
}

const jst = options => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false, ...options });
const dateTimeFmt = jst({ month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const timeFmt = jst({ hour: '2-digit', minute: '2-digit' });
const dayFmt = jst({ month: '2-digit', day: '2-digit' });

const formatDateTime = date => dateTimeFmt.format(date);
const formatTime = date => timeFmt.format(date);
const formatDay = date => dayFmt.format(date);

function formatSpan(ms) {
  const min = Math.floor(Math.abs(ms) / 60000);
  if (min < 1) return '1分未満';
  if (min < 60) return `${min}分`;

  const hours = Math.floor(min / 60);
  if (hours < 24) return min % 60 ? `${hours}時間${min % 60}分` : `${hours}時間`;
  return hours % 24 ? `${Math.floor(hours / 24)}日${hours % 24}時間` : `${hours / 24}日`;
}

function formatSeconds(sec) {
  return sec < 60 ? `${sec}秒` : `${Math.floor(sec / 60)}分${sec % 60}秒`;
}

// 1回分の実行を「✅ 11/21 12:05 (3分前・自動・10秒)」の形にする
function describeRun(run, now = Date.now()) {
  const trigger = run.auto ? '自動' : '手動';
  const result = run.ok ? '' : `・終了コード ${run.exitCode}`;
  return `${run.ok ? '✅' : '❌'} ${formatDateTime(run.start)} (${formatSpan(now - run.start)}前・${trigger}・${formatSeconds(run.duration)}${result})`;
}

// 次回の自動実行の目安（ループは「前回の終了＋間隔」で次を実行する）
function describeNextRun(job, runs, now = Date.now()) {
  const lastAuto = runs.filter(r => r.auto).at(-1);
  if (!lastAuto) return null;

  const next = lastAuto.start.getTime() + lastAuto.duration * 1000 + JOBS[job].intervalSec * 1000;
  if (next < now) return '予定を過ぎています（実行中、またはコンテナが停止している可能性があります）';
  // 日付をまたぐ場合は日付も添える
  const nextDate = new Date(next);
  const at = formatDay(nextDate) === formatDay(new Date(now)) ? formatTime(nextDate) : formatDateTime(nextDate);
  return `${at}頃 (${formatSpan(next - now)}後)`;
}

module.exports = {
  JOBS,
  readHistory,
  readLastOutput,
  formatDay,
  formatDateTime,
  describeRun,
  describeNextRun
};
