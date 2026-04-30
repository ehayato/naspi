const { COLORS, isDev } = require("./constants");
const { CustomEmbedBuilder } = require("./embedBuilder");

async function service(CLIENT, CHANNEL) {
  console.log(`\nBot is ready! Logged in as ${CLIENT.user.tag}\n`);

  const embed = new CustomEmbedBuilder()
    .setTitle('🚀 Naspi System Online')
    .setDescription('サーバー管理BOTがオンラインになりました！')
    .setColor(COLORS.ONLINE);

  embed.embedData.fields.push({
    name: 'Mode',
    value: isDev ? 'Development' : 'Production',
    inline: true
  });

  try{
    await CHANNEL.send({ embeds: [embed.build()] });
  } catch (e) {
    console.error(`\nHello Error:\n${e}\n`);
  }
}

module.exports = {
  run: service
};