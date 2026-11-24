// クラウドのマウントと認証の状態確認（開発用）
const fs = require('fs/promises');
const { CustomEmbedBuilder } = require('../core/embedBuilder');
const { COLORS } = require('../core/constants');
const { readLastOutput, formatDateTime } = require('../core/services/history');
const { readAuthState } = require('../core/services/notifier');

const data = {
  name: 'mountcheck',
  description: 'クラウドのマウントと Proton Drive の認証状態を確認します（開発用）',
  devOnly: true,
  button: { label: 'マウント確認', emoji: '☁️', style: 'Secondary', group: 'dev', order: 40 }
}

async function service(interaction) {
  await interaction.deferReply({ flags: 64 });

  const auth = await readAuthState();
  let mount;
  try {
    const names = await fs.readdir('/mnt/data/cloud');
    mount = names.length > 0
      ? `✅ ${names.length}件\n${names.slice(0, 8).join('\n')}${names.length > 8 ? '\n…' : ''}`
      : '⚠️ 空です（マウントされていない可能性があります）';
  } catch (err) {
    mount = `❌ 読めません: ${err.code ?? err.message}`;
  }

  const out = await readLastOutput('sync');
  const embed = new CustomEmbedBuilder()
    .setTitle('☁️ マウント確認')
    .setDescription('/mnt/data/cloud（クラウド）の状態です')
    .setColor(auth ? COLORS.ERROR : COLORS.INFO);
  embed.embedData.fields.push(
    { name: 'マウント', value: mount },
    { name: 'Proton Drive の認証', value: auth ? `❌ 再認証が必要です（${formatDateTime(auth.since)} から）` : '✅ 正常' }
  );
  if (out) embed.embedData.fields.push({ name: '直近の出力', value: `\`\`\`\n${out.slice(-800)}\n\`\`\`` });

  await interaction.editReply({ embeds: [embed.build()] });
}

module.exports = { data, service };
