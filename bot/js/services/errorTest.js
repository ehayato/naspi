const data = {
  name: 'errortest',
  description: 'エラーを発生させるテストコマンド',
  button: {
    label: 'エラーテスト',
    emoji: '❌',
    style: 'DANGER'
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