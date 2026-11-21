// resticバックアップ実行
const { runJob } = require('../core/services/manualJob');

const data = {
  name: 'backup',
  description: 'resticバックアップを今すぐ実行します',
  button: {
    label: 'バックアップ',
    emoji: '💾',
    style: 'Primary'
  }
}

async function service(interaction, _commands, CHANNELS) {
  await runJob(interaction, CHANNELS, {
    name: 'backup',
    title: 'バックアップ',
    channelKey: 'BACKUP',
    container: 'naspi_restic',
    cmd: ['/bin/sh', '/config/backup.sh', 'once']
  });
}

module.exports = {
  data,
  service
};
