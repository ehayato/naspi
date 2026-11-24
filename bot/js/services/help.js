const { CustomEmbedBuilder } = require('../core/embedBuilder');
const { COLORS } = require('../core/constants');
const { describeSchedule } = require('../core/services/history');

const data = {
  name: 'help',
  description: 'コマンドと操作、通知の見方を表示します',
  button: {
    label: 'ヘルプ',
    emoji: '❓',
    style: 'Secondary',
    group: 'main',
    order: 50
  }
}

// Embed のフィールド値は1024文字まで
const MAX_FIELD = 1024;

// チャンネルが取得できていればメンションにし、なければ名前だけを返す
const mention = (CHANNELS, key) => CHANNELS?.[key] ? `<#${CHANNELS[key].id}>` : `**${key}**`;

function commandLines(cmds) {
  return cmds.map(cmd => {
    const { emoji, label } = cmd.data.button ?? {};
    const button = label ? `（${emoji ?? ''}${label}）` : '';
    return `**/${cmd.data.name}**${button}: ${cmd.data.description}`;
  }).join('\n').slice(0, MAX_FIELD);
}

async function service(interaction, allCommands, CHANNELS) {
  const cmds = Object.values(allCommands);
  const main = cmds.filter(cmd => !cmd.data.devOnly);
  const dev = cmds.filter(cmd => cmd.data.devOnly);

  const embed = new CustomEmbedBuilder()
    .setTitle('📝 NASPI ヘルプ')
    .setDescription('NASPI は、Proton Drive と同期するクラウドのコピーと、ローカル専用の置き場、restic による世代バックアップを管理します。操作は `/` のコマンド、またはコントロールパネルのボタンから行えます。')
    .setColor(COLORS.INFO);

  embed.embedData.fields.push(
    { name: '📌 コマンド', value: commandLines(main) }
  );

  if (dev.length > 0) {
    embed.embedData.fields.push({ name: '🛠️ 開発モード専用', value: commandLines(dev) });
  }

  embed.embedData.fields.push(
    {
      name: '📢 通知チャンネル',
      value: [
        `${mention(CHANNELS, 'CLOUD')}: クラウドとローカルの動き（同期、Proton Drive の認証）`,
        `${mention(CHANNELS, 'BACKUP')}: ローカルと世代管理の動き（バックアップ、スナップショット）`,
        `${mention(CHANNELS, 'LOG')}: Bot のエラーログ`,
        `${mention(CHANNELS, 'STATUS')}: Bot の起動通知`,
        `${mention(CHANNELS, 'COCKPIT')}: コントロールパネル`
      ].join('\n')
    },
    {
      name: '⏰ 自動実行の時刻',
      value: [
        `**同期**: ${describeSchedule('sync')}（毎時 00 分と 30 分）`,
        `**バックアップ**: ${describeSchedule('backup')}`,
        '同期とバックアップは同時に動きません。バックアップ中は同期を見送り、同期中はバックアップが終わるのを待ちます。'
      ].join('\n')
    },
    {
      name: '🔔 自動で届く通知',
      value: [
        '・同期・バックアップの失敗と、回復したとき（失敗が続く間は最初の1回だけ）',
        '・バックアップで一部のファイルを読めなかったとき（不完全なスナップショットは世代に数えません）',
        '・Proton Drive の認証が切れたとき、回復したとき',
        '・毎朝 8:00 の日次レポート（CLOUD と BACKUP）'
      ].join('\n')
    },
    {
      name: '🧭 困ったときは',
      value: [
        '**Proton Drive の認証が切れた**: `rclone config` で `protondrive` を作り直す（2FA コードが必要）。`rclone.conf` が更新されると、自動で再開します。',
        '**バックアップが「already locked」で失敗**: 実行中でないことを確認して、ロック解除を実行します（開発モード）。',
        '**バックアップの中身を見たい**: ホストで `restic mount` を使います。手順は `docs/restic-restore-test.md` を参照してください。',
        '**復元できるか確かめたい**: 復元テストを実行します（開発モード）。'
      ].join('\n')
    }
  );

  await interaction.reply({
    embeds: [embed.build()],
    ephemeral: true
  });
}

module.exports = {
  data,
  service
};
