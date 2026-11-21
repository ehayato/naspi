const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const { COLORS, tempCHANNELS } = require('./core/constants');
const { resolveChannels, warnMissingChannels } = require('./core/channels');
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

function main() {
  const CHANNELS = {};
  const client = createClient();

  // チャンネルの取得が終わる前に届いたインタラクションが、空のCHANNELSで処理されないようにする
  let channelsResolved;
  const channelsReady = new Promise(resolve => { channelsResolved = resolve; });

  client.once(Events.ClientReady, async () => {
    Object.assign(CHANNELS, await resolveChannels(client, tempCHANNELS));
    warnMissingChannels(tempCHANNELS);
    channelsResolved();

    if (CHANNELS.STATUS) {
      HELLO.service(client, CHANNELS.STATUS);
    }

    if(CHANNELS.COCKPIT) {
      CONTROL_PANEL.service(CHANNELS.COCKPIT, COMMANDS);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    await channelsReady;
    await handleInteraction(interaction, CHANNELS);
  });

  client.login(TOKEN).catch(err => console.error('login error:', err));
}

main();