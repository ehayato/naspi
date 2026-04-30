const fs = require('fs');
const { type } = require('os');
const path = require('path');

const commands = {};
const servicesPath = path.join(__dirname, '../services');

const serviceFiles = fs.readdirSync(servicesPath).filter(file => file.endsWith('.js'));

for (const file of serviceFiles) {
  const command = require(path.join(servicesPath, file));

  if (command.data && typeof command.run === 'function') {
    commands[command.data.name] = command;

    console.log(`✅ Success: "/${command.data.name}" command loaded.`);
  } else {
    console.warn(`⚠️ Error: "${file}" is missing 'data' or 'run' export.`);
  }
}

module.exports = commands;