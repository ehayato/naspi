const { isDev, COLORS, TIMEis } = require("../constants");
const { CustomEmbedBuilder } = require("../embedBuilder");

async function service(CLIENT, CHANNEL) {
  console.log(`\nBot is ready! Logged in as ${CLIENT.user.tag}\n`);

  const embed = new CustomEmbedBuilder()
    .setTitle('🚀 Naspi System Online')
    .setDescription('サーバー管理BOTがオンラインになりました！')
    .setColor(COLORS.ONLINE);

  embed.embedData.fields.push(
    {
      name: '🕒 Wake-up',
      value: TIMEis,
      inline: false
    },
    {
      name: '⚙️ Mode',
      value: isDev ? 'Development' : 'Production',
      inline: false
    }
  );

  try{
    await CHANNEL.send({ embeds: [embed.build()] });
  } catch (e) {
    console.error(`\nhello.js\n${e}\n`);
  }
}

module.exports = {
  service
};