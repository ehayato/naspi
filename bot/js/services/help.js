const { CustomEmbedBuilder } = require('../core/embedBuilder');

async function runHelp(interaction, allCommands) {
  const commandList = Object.values(allCommands).map(cmd => {
    return `**/${cmd.data.name}**: ${cmd.data.description}`;
  }).join('\n');

  const embeds = new CustomEmbedBuilder()
    .setTitle('📝 利用可能なコマンド一覧')
    .setDescription(commandList)
    .build();
  
  await interaction.reply({
    embeds: [embeds],
    ephemeral: true
  });
}

module.exports = {  
  run: runHelp
};