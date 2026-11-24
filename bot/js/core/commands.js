const fs = require('fs');
const path = require('path');
const { isDev } = require('./constants');

const servicesPath = path.join(__dirname, '../services');
const serviceFiles = fs.readdirSync(servicesPath).filter(file => file.endsWith('.js'));

// ボタンの区分と、その表示順（コントロールパネルとヘルプはこの順に並べる）
//   main: 通常の操作（参照系 → 実行系 → ヘルプ）
//   dev : 開発モードだけで使う手動操作
const GROUP_ORDER = ['main', 'dev'];

const loaded = [];
for (const file of serviceFiles) {
  const command = require(path.join(servicesPath, file));

  if (!command.data || typeof command.service !== 'function') {
    console.warn(`⚠️ Error: "${file}" is missing 'data' or 'service' export.`);
    continue;
  }
  // 開発用のコマンドは、本番では登録しない
  if (command.data.devOnly && !isDev) continue;

  loaded.push(command);
}

const groupIndex = cmd => {
  const i = GROUP_ORDER.indexOf(cmd.data.button?.group ?? 'main');
  return i === -1 ? GROUP_ORDER.length : i;
};
const orderOf = cmd => cmd.data.button?.order ?? 999;
loaded.sort((a, b) => groupIndex(a) - groupIndex(b) || orderOf(a) - orderOf(b) || a.data.name.localeCompare(b.data.name));

const commands = {};
for (const command of loaded) {
  commands[command.data.name] = command;
  console.log(`✅ Success: "/${command.data.name}" command loaded.`);
}

module.exports = commands;
