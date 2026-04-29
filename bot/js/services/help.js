const CustomEmbedBuilder = require('../core/embedBuilder');

async function runHelp(interaction, allCommands) {
  const commandList = allCommands.map(cmd => {
    return `**/${cmd.data.name}**: ${cmd.data.desc}`;
  }).join('\n');

  const embed = new CustomEmbedBuilder()
    .setTitle('📝 利用可能なコマンド一覧')
    .setDesc(commandList)
    .build();
  
  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

module.exports = {
  run: runHelp
};