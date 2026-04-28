// ステータス表示のロジック
module.exports = {
  run: async (interaction) => {
    // ここにシステムの稼働状況を返す処理を書く
    await interaction.reply('システムは稼働中です');
  }
};
