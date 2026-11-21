const { isDev } = require('./constants');

// 通知先として実際に使っているチャンネル。未設定だと該当する通知が送られない
// （TEST は現状どこからも使っていないため任意）
const REQUIRED_CHANNELS = ['COCKPIT', 'STATUS', 'CLOUD', 'BACKUP', 'LOG'];

const ENV_PREFIX = isDev ? 'DEV_CH_' : 'PROD_CH_';

// チャンネルIDから実際のチャンネルを取得する（取得できないものは含めない）
async function resolveChannels(client, tempChannels) {
  const resolved = {};
  for (const [key, channelId] of Object.entries(tempChannels)) {
    if (!channelId) continue;

    try {
      resolved[key] = await client.channels.fetch(channelId);
    } catch (err) {
      console.warn(`⚠️ チャンネル ${key} (${channelId}) を取得できません: ${err.message}`);
    }
  }
  return resolved;
}

// 使うチャンネルが未設定のまま、通知が黙って失われないよう起動時に知らせる
// （IDが設定済みで取得に失敗したものは resolveChannels が警告済みのため、ここでは扱わない）
function warnMissingChannels(tempChannels) {
  const missing = REQUIRED_CHANNELS.filter(key => !tempChannels[key]);

  for (const key of missing) {
    console.warn(`⚠️ ${key} チャンネルが未設定です。.env の ${ENV_PREFIX}${key} を設定してください（該当する通知は送信されません）`);
  }
  return missing;
}

module.exports = {
  REQUIRED_CHANNELS,
  resolveChannels,
  warnMissingChannels
};
