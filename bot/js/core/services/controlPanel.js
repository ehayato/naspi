const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CustomEmbedBuilder } = require('../embedBuilder');
const { COLORS, TIMEis } = require('../constants');

const PANEL_TITLE = '✈️ Control Panel';
// ピン留めされていないパネルも拾うため、直近のメッセージも調べる
const SCAN_LIMIT = 50;

// このBotが過去に送ったパネルを削除する
// bulkDelete は14日より古いメッセージが混ざると全体が失敗し、他人のメッセージも巻き込むため使わない
async function deletePreviousPanels(CHANNEL) {
  const botId = CHANNEL.client.user.id;
  const [pins, recent] = await Promise.all([
    CHANNEL.messages.fetchPins().then(res => res.items.map(item => item.message)),
    CHANNEL.messages.fetch({ limit: SCAN_LIMIT }).then(msgs => [...msgs.values()])
  ]);

  // ピン留めと直近の両方に含まれるものは1件として扱う
  const panels = new Map();
  for (const msg of [...pins, ...recent]) {
    if (msg.author.id === botId && msg.embeds[0]?.title === PANEL_TITLE) {
      panels.set(msg.id, msg);
    }
  }

  // 1件の失敗（すでに削除済みなど）で残りの削除を止めない
  const results = await Promise.allSettled([...panels.values()].map(msg => msg.delete()));
  results.filter(r => r.status === 'rejected')
    .forEach(r => console.error('\ncontrolPanel.js\n', r.reason));
}

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
    .setTitle(PANEL_TITLE)
    .setDescription('NASPIのコマンドをボタンで操作できます。')
    .setColor(COLORS.COCKPIT);

  embed.embedData.fields.push(
    { name: '📅 Latest Update', value: TIMEis(), inline: false }
  );

  // 取得や削除に失敗しても、新しいパネルの送信は続ける
  await deletePreviousPanels(CHANNEL).catch(err => console.error('\ncontrolPanel.js\n', err));

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
