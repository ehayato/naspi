// 通知チャンネルへのテスト送信（開発用）
const { CustomEmbedBuilder } = require('../core/embedBuilder');
const { COLORS, TIMEis } = require('../core/constants');

const data = {
  name: 'notifytest',
  description: 'CLOUD と BACKUP にテスト通知を送り、投稿できることを確認します（開発用）',
  devOnly: true,
  button: { label: '通知テスト', emoji: '🔔', style: 'Primary', group: 'dev', order: 60 }
}

const TARGETS = [
  { key: 'CLOUD', note: 'クラウドとローカルの動き（同期、Proton Drive の認証）' },
  { key: 'BACKUP', note: 'ローカルと世代管理の動き（バックアップ、スナップショット）' }
];

async function service(interaction, _commands, CHANNELS) {
  await interaction.deferReply({ flags: 64 });

  const lines = [];
  for (const { key, note } of TARGETS) {
    const embed = new CustomEmbedBuilder()
      .setTitle('🔔 通知テスト')
      .setDescription(`${key} チャンネルへの通知テストです。\nここには、${note}が届きます。`)
      .setColor(COLORS.INFO);
    embed.embedData.fields.push({ name: '送信時刻', value: TIMEis() });

    try {
      if (!CHANNELS[key]) throw new Error('チャンネルが未設定です');
      await CHANNELS[key].send({ embeds: [embed.build()] });
      lines.push(`✅ ${key}`);
    } catch (err) {
      lines.push(`❌ ${key}: ${err.message}`);
    }
  }
  await interaction.editReply({ content: lines.join('\n') });
}

module.exports = { data, service };
