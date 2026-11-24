const { CustomEmbedBuilder } = require('../core/embedBuilder');

const data = {
  name: 'help',
  description: '利用可能なコマンド一覧を表示します',
  button: {
    label: 'ヘルプ',
    emoji: '❓',
    style: 'Secondary',
    group: 'main',
    order: 50
  }
}

async function service(interaction, allCommands) {
  // 通常の操作と、開発モード専用の操作を分けて表示する
  const line = cmd => `**/${cmd.data.name}**: ${cmd.data.description}`;
  const cmds = Object.values(allCommands);
  const dev = cmds.filter(cmd => cmd.data.devOnly);
  const commandList = [
    ...cmds.filter(cmd => !cmd.data.devOnly).map(line),
    ...(dev.length ? ['', '**開発モード専用**', ...dev.map(line)] : [])
  ].join('\n');

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
  data,
  service
};