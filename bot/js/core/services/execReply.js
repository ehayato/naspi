const { CustomEmbedBuilder } = require('../embedBuilder');
const { COLORS } = require('../constants');
const { dockerExec } = require('./dockerExec');

const OUTPUT_PREVIEW_CHARS = 1500;

// 他コンテナのコマンドを実行し、結果を実行者にだけ表示する（チャンネルへは投稿しない）
async function execAndReply(interaction, { title, container, cmd }) {
  await interaction.deferReply({ flags: 64 });

  const { exitCode, output } = await dockerExec(container, cmd);
  const ok = exitCode === 0;
  const embed = new CustomEmbedBuilder()
    .setTitle(`${ok ? '✅' : '❌'} ${title}${ok ? '' : '（失敗）'}`)
    .setDescription(output ? `\`\`\`\n${output.slice(-OUTPUT_PREVIEW_CHARS)}\n\`\`\`` : '出力はありません')
    .setColor(ok ? COLORS.SUCCESS : COLORS.ERROR);
  embed.embedData.fields.push({ name: '終了コード', value: String(exitCode), inline: true });

  await interaction.editReply({ embeds: [embed.build()] });
}

module.exports = {
  execAndReply
};
