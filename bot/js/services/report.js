// 日次レポートの手動送信（開発用）
const { sendDigests } = require('../core/services/notifier');

const data = {
  name: 'report',
  description: '日次レポートを CLOUD と BACKUP に今すぐ送信します（開発用）',
  devOnly: true,
  button: { label: '日次レポート', emoji: '📋', style: 'Primary', group: 'dev', order: 50 }
}

async function service(interaction, _commands, CHANNELS) {
  await interaction.deferReply({ flags: 64 });
  await sendDigests(CHANNELS);
  await interaction.editReply({ content: '日次レポートを CLOUD と BACKUP に送信しました。' });
}

module.exports = { data, service };
