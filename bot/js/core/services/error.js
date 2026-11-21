const { CustomEmbedBuilder } = require('../embedBuilder');
const { COLORS } = require('../constants');

async function service(interaction, message, rawError = null, CHANNELS) {
  // ユーザー向けのエラーメッセージを作成
  const userEmbed = new CustomEmbedBuilder()
    .setTitle('❌ エラー')
    .setDescription(message)
    .setColor(COLORS.ERROR)
    .build();

  const payload = {
    embeds: [userEmbed],
    ephemeral: true
  };
  // トークン期限切れ等で返信できなくてもプロセスを落とさず、ログ通知は続ける
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (replyError) {
    console.error(`\nerror.js\n${replyError}\n`);
  }

  // ボタン経由の場合は commandName が無いため customId から取り出す
  const commandName = interaction.commandName ?? interaction.customId?.replace('btn_', '');

  // ログチャンネルへのエラー通知
  const logEmbed = new CustomEmbedBuilder()
    .setTitle('🚨 エラーログ通知')
    .setDescription(`コマンド : \`/${commandName}\`\n内容 : ${message}`)
    .setColor(COLORS.ERROR)
    
  if (rawError) {
    logEmbed.embedData.fields.push({ 
      name: '🛠️ Stack Trace', 
      value: `\`\`\`js\n${rawError.stack?.slice(0, 500) || 'none'}\`\`\`` });
  }
  else {
    logEmbed.embedData.fields.push({ 
      name: '👤 User Info', 
      value: `ID: ${interaction.user.id}\nTag: ${interaction.user.tag}` });
  }

  try {
    await CHANNELS.LOG.send({ 
      embeds: [logEmbed.build()]
    });
  } catch (logError) {
    console.error(`\nerror.js\n${logError}\n`);
  }
}

module.exports = {
  service
};