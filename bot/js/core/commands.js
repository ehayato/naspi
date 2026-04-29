const CustomEmbedBuilder = require('./embedBuilder');

const helpService = require('../services/help');
const statusService = require('../services/statusService');
const backupService = require('../services/backupService');
const syncService = require('../services/syncService');


// コマンド定義
const commands = {
  help: {
    data: { name: 'help', description: '利用可能なコマンド一覧を表示します' },
    execute: (interaction, allCommands) => helpService.run(interaction, allCommands)
  },
  status: {
    data: { name: 'status', description: 'システムの稼働状況を確認します' },
    execute: (interaction) => statusService.run(interaction)
  },
  backup: {
    data: { name: 'backup', description: 'NASのバックアップを実行します' },
    execute: (interaction) => backupService.run(interaction)
  },
  sync: {
    data: { name: 'sync', description: 'クラウドとローカルの同期を実行します' },
    execute: (interaction) => syncService.run(interaction)
  },
};

module.exports = commands;