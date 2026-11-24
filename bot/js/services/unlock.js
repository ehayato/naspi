// restic の古いロックの削除（開発用）
const { execAndReply } = require('../core/services/execReply');

const data = {
  name: 'unlock',
  description: 'restic の古いロックを削除します。実行中のロックは削除されません（開発用）',
  devOnly: true,
  button: { label: 'ロック解除', emoji: '🔓', style: 'Danger', group: 'dev', order: 30 }
}

async function service(interaction) {
  await execAndReply(interaction, {
    title: 'ロック解除',
    container: 'naspi_restic',
    cmd: ['restic', '-r', '/backup/repo', 'unlock']
  });
}

module.exports = { data, service };
