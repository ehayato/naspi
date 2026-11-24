// restic の復元テスト（開発用）
const { runJob } = require('../core/services/manualJob');

const data = {
  name: 'restoretest',
  description: 'restic の復元テストを今すぐ実行します（開発用）',
  devOnly: true,
  button: { label: '復元テスト', emoji: '🧪', style: 'Primary', group: 'dev', order: 10 }
}

async function service(interaction, _commands, CHANNELS) {
  await runJob(interaction, CHANNELS, {
    name: 'restoretest',
    title: '復元テスト',
    channelKey: 'BACKUP',
    container: 'naspi_restic',
    cmd: ['/bin/sh', '/config/restore-test.sh']
  });
}

module.exports = { data, service };
