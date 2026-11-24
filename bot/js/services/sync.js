// rclone同期実行
const { isDev } = require('../core/constants');
const { runJob } = require('../core/services/manualJob');

const data = {
  name: 'sync',
  description: 'Proton Driveとの同期を今すぐ実行します',
  button: {
    label: '同期',
    emoji: '🔄',
    style: 'Primary',
    group: 'main',
    order: 30
  }
}

async function service(interaction, _commands, CHANNELS) {
  // 開発モードではbisyncが停止し、クラウドを直接マウントしている
  if (isDev) {
    await interaction.reply({
      content: '開発モードではクラウドを直接マウントしているため、同期は行いません。',
      ephemeral: true
    });
    return;
  }

  await runJob(interaction, CHANNELS, {
    name: 'sync',
    title: '同期',
    channelKey: 'CLOUD',
    container: 'naspi_rclone',
    cmd: ['/bin/sh', '/config/rclone/sync.sh', 'once']
  });
}

module.exports = {
  data,
  service
};
