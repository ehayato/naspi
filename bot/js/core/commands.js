const CustomEmbedBuilder = require('./embedBuilder');

const helpService = require('../services/help');
const statusService = require('../services/statusService');
const backupService = require('../services/backupService');
const syncService = require('../services/syncService');
const colorsService = require('../services/colors');


// コマンド定義
const commands = {
  help: {
    data: { name: 'help', description: '利用可能なコマンド一覧を表示します' },
    button: { label: 'ヘルプ', emoji: '❓', style: 'PRIMARY' },
    execute: (interaction, allCommands) => helpService.run(interaction, allCommands)
  },
  status: {
    data: { name: 'status', description: 'システムの稼働状況を確認します' },
    button: { label: 'ステータス', emoji: '📊', style: 'SECONDARY' },
    execute: (interaction) => statusService.run(interaction)
  },
  backup: {
    data: { name: 'backup', description: 'NASのバックアップを実行します' },
    button: { label: 'バックアップ', emoji: '💾', style: 'DANGER' },
    execute: (interaction) => backupService.run(interaction)
  },
  sync: {
    data: { name: 'sync', description: 'クラウドとローカルの同期を実行します' },
    button: { label: '同期', emoji: '🔄', style: 'SUCCESS' },
    execute: (interaction) => syncService.run(interaction)
  },
  colors: {
    data: { name: 'colors', description: '利用可能なカラーコードを表示します' },
    button: { label: 'カラーコード', emoji: '🎨', style: 'PRIMARY' },
    execute: (interaction) => colorsService.run(interaction)
  }
};

module.exports = commands;