const data = {
  name: 'errortest',
  description: 'エラー通知の動作確認のため、わざとエラーを発生させます（開発用）',
  devOnly: true,
  button: {
    label: 'エラーテスト',
    emoji: '🚨',
    style: 'Danger',
    group: 'dev',
    order: 70
  }
}

async function service(interaction) {
  thisIsAnError; // 存在しない変数を参照してエラーを発生させる
  
  await interaction.reply({
    content: 'このメッセージは表示されません。'
  });
}

module.exports = {
  data,
  service
};