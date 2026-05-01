// ステータス表示のロジック
const { CustomEmbedBuilder } = require('../core/embedBuilder');
const { COLORS } = require('../core/constants');

const data = {
  name: 'status',
  description: 'サーバーの現在の状態を表示します',
  button: {
    label: 'ステータス',
    emoji: '📊',
    style: 'PRIMARY'
  }
}

async function service(interaction) {
  const embed = new CustomEmbedBuilder()
    .setTitle('📊 サーバーステータス')
    .setDescription('現在のサーバーの状態')
    .setColor(COLORS.INFO);

  // ここで実際のサーバーステータスを取得してフィールドに追加する
  // 例: CPU使用率、メモリ使用率、稼働時間など
  embed.embedData.fields.push(
    { name: 'CPU使用率', value: '45%', inline: true },
    { name: 'メモリ使用率', value: '3.2GB / 8GB', inline: true },
    { name: '稼働時間', value: '12時間34分', inline: false }
  );

  await interaction.reply({
    embeds: [embed.build()],
    flags: 64
  });
}

module.exports = {
  data,
  service
};