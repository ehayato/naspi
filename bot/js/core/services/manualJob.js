const { CustomEmbedBuilder } = require('../embedBuilder');
const { COLORS, TIMEis } = require('../constants');
const { dockerExec } = require('./dockerExec');

// 二重実行を防ぐため、実行中のジョブ名を保持する
const running = new Set();

// 遅延応答のトークンは15分で失効するため、それより前に打ち切る
const REPLY_LIMIT_MS = 14 * 60 * 1000;
const OUTPUT_PREVIEW_CHARS = 1500;

function buildEmbed({ title, exitCode, output }) {
  const ok = exitCode === 0;
  const embed = new CustomEmbedBuilder()
    .setTitle(`${ok ? '✅' : '❌'} ${title}${ok ? '完了' : '失敗'}`)
    .setDescription(output ? `\`\`\`\n${output.slice(-OUTPUT_PREVIEW_CHARS)}\n\`\`\`` : '出力はありません')
    .setColor(ok ? COLORS.SUCCESS : COLORS.ERROR);

  embed.embedData.fields.push(
    { name: '終了コード', value: String(exitCode), inline: true },
    { name: '完了時刻', value: TIMEis(), inline: true }
  );
  return embed.build();
}

// 他コンテナのスクリプトを手動実行して、結果を実行者と通知チャンネルに返す
async function runJob(interaction, CHANNELS, { name, title, channelKey, container, cmd }) {
  if (running.has(name)) {
    await interaction.reply({ content: `${title}はすでに実行中です。`, ephemeral: true });
    return;
  }

  running.add(name);
  try {
    await interaction.deferReply({ flags: 64 });

    let timer;
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => resolve(null), REPLY_LIMIT_MS);
    });
    const result = await Promise.race([dockerExec(container, cmd), timeout]);
    clearTimeout(timer);

    if (!result) {
      await interaction.editReply({
        content: `${title}に時間がかかっています。コンテナ内では実行が続いている可能性があるため、\`docker logs ${container}\` で確認してください。`
      });
      return;
    }

    const embed = buildEmbed({ title, ...result });
    await interaction.editReply({ embeds: [embed] });

    // 手動実行の記録を通知チャンネルにも残す
    await CHANNELS[channelKey]?.send({ embeds: [embed] })
      .catch(err => console.error(`\nmanualJob.js\n${err}\n`));
  } finally {
    running.delete(name);
  }
}

module.exports = {
  runJob
};
