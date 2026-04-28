const CustomEmbedBuilder = require('./embedBuilder');

const statusService = require('../services/statusService');
const backupService = require('../services/backupService');
const syncService = require('../services/syncService');

// コマンドの実行関数
async function statusExecute(interaction) {
  await statusService.run(interaction);
}

async function backupExecute(interaction) {
  await backupService.run(interaction);
}

async function syncExecute(interaction) {
  await syncService.run(interaction);
}

// helpコマンドはコマンド一覧を自動生成
async function helpExecute(interaction) {
  const { CustomEmbedBuilder } = require('../core/embedBuilder');
  const embed = new CustomEmbedBuilder()
    .setTitle('📝 利用可能なコマンド一覧')
    .setDes(commands.map(cmd => `**/${cmd.data.name}**: ${cmd.data.description}`).join('\n'))
    .build();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// コマンド定義
const commands = [
  {
    data: { name: 'status', description: 'システムの稼働状況を確認します' },
    execute: statusExecute
  },
  {
    data: { name: 'backup', description: 'NASのバックアップを実行します' },
    execute: backupExecute
  },
  {
    data: { name: 'sync', description: 'クラウドとローカルの同期を実行します' },
    execute: syncExecute
  },
  {
    data: { name: 'help', description: '利用可能なコマンド一覧を表示します' },
    execute: helpExecute
  }
];

module.exports = commands;