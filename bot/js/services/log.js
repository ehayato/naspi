// 直近3日間の同期・バックアップ状況の表示
const { isDev, COLORS } = require('../core/constants');
const { CustomEmbedBuilder } = require('../core/embedBuilder');
const {
  JOBS, readHistory, readLastOutput, formatDay, formatDateTime, describeRun
} = require('../core/services/history');

const data = {
  name: 'log',
  description: '直近3日間のクラウド同期とバックアップの状況を表示します',
  button: {
    label: 'ログ',
    emoji: '📜',
    style: 'Primary'
  }
}

const DAYS = 3;
const MAX_FAILURES = 5;
// Embedのフィールド値は1024文字まで
const MAX_OUTPUT_CHARS = 800;

// 日別の成功・失敗回数と、失敗した実行の一覧を作る
function summarize(runs) {
  const perDay = new Map();
  for (const run of runs) {
    const day = formatDay(run.start);
    const count = perDay.get(day) ?? { ok: 0, ng: 0 };
    run.ok ? count.ok++ : count.ng++;
    perDay.set(day, count);
  }

  const failed = runs.filter(r => !r.ok);
  const lines = [
    `実行 ${runs.length}回: ✅ ${runs.length - failed.length} / ❌ ${failed.length}`,
    ...[...perDay].reverse().map(([day, c]) => `${day}  ✅ ${c.ok}${c.ng ? `  ❌ ${c.ng}` : ''}`)
  ];

  if (failed.length > 0) {
    lines.push('', '失敗した実行:');
    lines.push(...failed.slice(-MAX_FAILURES).reverse().map(r => `❌ ${formatDateTime(r.start)}・${r.auto ? '自動' : '手動'}・終了コード ${r.exitCode}`));
    if (failed.length > MAX_FAILURES) lines.push(`（ほか ${failed.length - MAX_FAILURES}件）`);
  }
  return lines.join('\n');
}

async function jobFields(job, now) {
  const { label, emoji } = JOBS[job];
  const name = `${emoji} ${label}（直近${DAYS}日）`;

  // 開発モードではbisyncが停止しているため、同期の履歴は存在しない
  if (isDev && job === 'sync') {
    return [{ name, value: '開発モードのため、クラウドを直接マウントしており同期は行っていません' }];
  }

  const all = await readHistory(job);
  const runs = all.filter(r => now - r.start <= DAYS * 24 * 3600 * 1000);
  if (runs.length === 0) {
    return [{ name, value: all.length > 0 ? `この${DAYS}日間の実行記録はありません（最終: ${describeRun(all.at(-1), now)}）` : '実行記録がありません' }];
  }

  const fields = [{ name, value: summarize(runs) }];

  // 最後の実行が失敗している場合のみ、原因の手がかりとして出力を添える
  const latest = runs.at(-1);
  if (!latest.ok) {
    const output = await readLastOutput(job);
    if (output) {
      fields.push({ name: `🛠️ ${label}の直近の出力`, value: `\`\`\`\n${output.slice(-MAX_OUTPUT_CHARS)}\n\`\`\`` });
    }
  }
  return fields;
}

async function service(interaction) {
  const now = Date.now();
  const [syncFields, backupFields] = await Promise.all([jobFields('sync', now), jobFields('backup', now)]);

  const embed = new CustomEmbedBuilder()
    .setTitle('📜 同期・バックアップログ')
    .setDescription(`${formatDateTime(new Date(now - DAYS * 24 * 3600 * 1000))} 以降の実行結果`)
    .setColor(COLORS.INFO);
  embed.embedData.fields.push(...syncFields, ...backupFields);

  await interaction.reply({
    embeds: [embed.build()],
    ephemeral: true
  });
}

module.exports = {
  data,
  service
};
