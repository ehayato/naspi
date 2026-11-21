const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const { COLORS, tempCHANNELS } = require('./core/constants');
const COMMANDS = require('./core/commands');
const { handleInteraction } = require('./core/interactionHandler');
const HELLO = require('./core/services/hello');
const CONTROL_PANEL = require('./core/services/controlPanel');

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
    HELLO.service(client, CHANNELS.STATUS);

    if(CHANNELS.COCKPIT) {
      CONTROL_PANEL.service(CHANNELS.COCKPIT, COMMANDS);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    await handleInteraction(interaction, CHANNELS);
  });

  client.login(TOKEN).catch(err => console.error('login error:', err));
}

main();