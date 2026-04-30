const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const { COLORS, tempCHANNELS } = require('./core/constants');
const { handleInteraction } = require('./core/interactionHandler');
const hello = require('./core/services/hello');

function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
}

async function resolveChannels(client, tempChannels) {
  const resolved = {};
  for (const [key, channelId] of Object.entries(tempChannels)) {
    if (channelId) {
      resolved[key] = await client.channels.fetch(channelId).catch(() => null);
    }
  }
  return resolved;
}

function main() {
  const CHANNELS = {};
  const client = createClient();

  client.once(Events.ClientReady, async () => {
    Object.assign(CHANNELS, await resolveChannels(client, tempCHANNELS));
    hello.service(client, CHANNELS.STATUS);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    await handleInteraction(interaction, CHANNELS);
  });

  client.login(TOKEN).catch(err => console.error('login error:', err));
}

main();