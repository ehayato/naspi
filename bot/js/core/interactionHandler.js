const commands = require('./commands');
const errorService = require('./services/error');

async function handleInteraction(interaction, CHANNELS) {
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

    await errorService.service(
      interaction, 
      '\`${commandName}\` というコマンドは登録されていないか、利用できません。'
    );

    return;
  }

  try {
    await command.service(interaction, commands, CHANNELS);
  } catch (error) {
    console.error(`\ninteractionHandler.js\n${error}\n`);

    await errorService.service(
      interaction, 
      'コマンドの実行中にエラーが発生しました。ログを確認してください。',
      error,
      CHANNELS
    );

    return;
  }
}

module.exports = {
  handleInteraction
};