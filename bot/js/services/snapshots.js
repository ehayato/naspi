// restic のスナップショット一覧（開発用）
const { execAndReply } = require('../core/services/execReply');

const data = {
  name: 'snapshots',
  description: 'restic のスナップショット（世代）の一覧を表示します（開発用）',
  devOnly: true,
  button: { label: '世代一覧', emoji: '🗂️', style: 'Secondary', group: 'dev', order: 20 }
}

async function service(interaction) {
  await execAndReply(interaction, {
    title: 'スナップショット一覧',
    container: 'naspi_restic',
    cmd: ['restic', '-r', '/backup/repo', 'snapshots', '--compact']
  });
}

module.exports = { data, service };
