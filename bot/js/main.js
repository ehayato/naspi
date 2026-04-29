const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
require('dotenv').config();

const { COLORS, CHANNELS, isDev } = require('./core/constants');
const { handleInteraction } = require('./handlers/interactionHandler');

const TOKEN = process.env.DISCORD_TOKEN;

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
    const channel = await client.channels.fetch(CHANNELS.STATUS).catch(() => null);
    if (channel && channel.isTextBased()) {
      const readyEmbed = new EmbedBuilder()
        .setColor(COLORS.ONLINE)
        .setTitle('🚀 Naspi System Online')
        .setDescription('サーバー管理BOTがオンラインになりました！')
        .addFields(
          { name: 'Environment', value: 'Node.js on Docker', inline: true },
          { name: 'Status', value: 'Online / System Ready.', inline: true },
          { name: 'Mode', value: isDev ? 'Development' : 'Production', inline: true  },
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

function main() {
  const client = createClient();
  client.once(Events.ClientReady, () => notifyReady(client));

  client.on(Events.InteractionCreate, async (interaction) => {
    await handleInteraction(interaction);
  });

  client.login(TOKEN).catch(err => console.error('login error:', err));
}

main();