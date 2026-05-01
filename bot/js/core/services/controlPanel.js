const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CustomEmbedBuilder } = require('../embedBuilder');
const { COLORS, TIMEis } = require('../constants');

async function sendControlPanel(CHANNEL, ALLCMDs) {
  const pannelCmds = Object.values(ALLCMDs).filter(cmd => cmd.data.button);
  const buttons = pannelCmds.map(cmd => {
    return new ButtonBuilder()
      .setCustomId(`btn_${cmd.data.name}`)
      .setLabel(cmd.data.button.label || cmd.data.name)
      .setEmoji(cmd.data.button.emoji || '🔸')
      .setStyle(ButtonStyle[cmd.data.button.style] || ButtonStyle.Primary);
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  const embed = new CustomEmbedBuilder()
    .setTitle('✈️ Control Panel')
    .setDescription('NASPIのコマンドをボタンで操作できます。')
    .setColor(COLORS.COCKPIT);

  embed.embedData.fields.push(
    { name: '📅 Latest Update', value: TIMEis, inline: false }
  );

  await CHANNEL.bulkDelete(10).catch(() => {});

  const sendMsg = await CHANNEL.send({
    embeds: [embed.build()],
    components: rows
  });
  await sendMsg.pin().catch(err => console.error('\ncontrolPanel.js\n', err));

  const msg = await CHANNEL.messages.fetch({ limit: 5 });
  const sysMsg = msg.find(m => m.type === 6);
  if (sysMsg) {
    await sysMsg.delete().catch(() => {});
  }
}

module.exports = {
  service: sendControlPanel
}
