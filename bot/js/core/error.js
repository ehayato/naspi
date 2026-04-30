const { CustomEmbedBuilder } = require('./embedBuilder');
const { COLORS, CHANNELS } = require('./constants');

async function runError(interaction, message, rawError = null) {
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
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }

  // ログチャンネルへのエラー通知
  const logChannelId = CHANNELS.LOG;
  if (logChannelId) {
    const logChannel = interaction.client.channels.cache.get(logChannelId);
    if (logChannel && logChannel.isTextBased()) {
      const logEmbed = new CustomEmbedBuilder()
        .setTitle('🚨 エラーログ通知')
        .setDescription(`コマンド : \`/${interaction.commandName}\`\n内容 : ${message}`)
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
        await logChannel.send({ 
          embeds: [logEmbed.build()]
        });
      } catch (logError) {
        console.error(`\n${logError}\n`);
      }
    }
  }
}

module.exports = {
  run: runError
};