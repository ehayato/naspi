const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
require('dotenv').config();

const { COLORS } = require('./constants');

const TOKEN = process.env.DISCORD_TOKEN;
const CH_STATUS = process.env.CH_STATUS;

function hexToRgb(hex) {
  const s = String(hex || '').replace('#', '');
  if (s.length !== 6) return '';
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
}

async function notifyReady(client) {
  console.log(`Logged in as ${client.user.tag}!`);
  try {
    const channel = await client.channels.fetch(CH_STATUS).catch(() => null);
    if (channel && channel.isTextBased()) {
      const readyEmbed = new EmbedBuilder()
        .setColor(COLORS.ONLINE)
        .setTitle('🚀 Naspi System Online')
        .setDescription('サーバー管理BOTがオンラインになりました！')
        .addFields(
          { name: 'Environment', value: 'Node.js on Docker', inline: true },
          { name: 'Status', value: 'Online / System Ready.', inline: true }
        )
        .setTimestamp();
      await channel.send({ embeds: [readyEmbed] });
    } else {
      console.error('Status channel not found or not text-based');
    }
  } catch (err) {
    console.error('notifyReady error:', err);
  }
}

// カラーパレット確認用
function setupMessageHandler(client) {
  client.on('messageCreate', async (message) => {
    if (message.author?.bot) return;
    if (message.content === '!colors') {
      const embeds = Object.entries(COLORS).map(([name, color]) => {
        return new EmbedBuilder()
          .setTitle(`${name} Color Check`)
          .setColor(color)
          .setDescription(`Hex: ${color}\nRGB: ${hexToRgb(color)}`)
          .setTimestamp();
      });
      await message.channel.send({ content: 'カラーパレットの確認', embeds });
    }
  });
}

function main() {
  const client = createClient();
  client.once(Events.ClientReady, () => notifyReady(client));
  setupMessageHandler(client);
  client.login(TOKEN).catch(err => console.error('login error:', err));
}

main();