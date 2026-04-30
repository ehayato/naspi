const commands = require('./commands');
const errorService = require('./error');

async function handleInteraction(interaction) {
  let command;
  let commandName = '';

  // A. スラッシュコマンドの場合
  if (interaction.isChatInputCommand()) {
    commandName = interaction.commandName;
    command = commands[commandName];
  }
  // B. ボタンの場合
  else if (interaction.isButton()) {
    // ex: "btn_help" から "help" を取り出す
    commandName = interaction.customId.replace('btn_', '');
    command = commands[commandName];
  }
  else {
    return; // 対応していないインタラクションは無視
  }
  
  if (!command) {
    console.warn('Unknown interaction:', commandName);

    await errorService.run(
      interaction, 
      '\`${commandName}\` というコマンドは登録されていないか、利用できません。'
    );

    return;
  }

  try {
    await command.run(interaction, commands);
  } catch (error) {
    // console.error(error);

    await errorService.run(
      interaction, 
      'コマンドの実行中にエラーが発生しました。ログを確認してください。',
      error
    );

    return;
  }
}

module.exports = {
  handleInteraction
};