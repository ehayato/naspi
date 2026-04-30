

async function service(interaction) {
  thisIsError();

  await interaction.reply({
    content: 'このメッセージは表示されません。'
  });
}

module.exports = {
  data: {
    name: 'hoge',
    description: 'エラーを発生させるテストコマンド',
    button: {
      label: 'Hoge',
      emoji: '❌',
      style: 'DANGER'
    }
  },
  run: service
};