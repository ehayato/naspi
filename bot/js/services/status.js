// ステータス表示のロジック
const os = require('os');
const fs = require('fs/promises');
const { CustomEmbedBuilder } = require('../core/embedBuilder');
const { COLORS } = require('../core/constants');

const data = {
  name: 'status',
  description: 'サーバーの現在の状態を表示します',
  button: {
    label: 'ステータス',
    emoji: '📊',
    style: 'PRIMARY'
  }
}

// docker-compose.yml で読み取り専用マウントしているストレージ
const STORAGES = [
  { name: 'Cloud-Sync', path: '/mnt/cloud' },
  { name: 'Local-NAS', path: '/mnt/local' }
];

const CPU_SAMPLE_MS = 500;

function formatBytes(bytes) {
  const GB = 1024 ** 3;
  return `${(bytes / GB).toFixed(1)}GB`;
}

function formatDuration(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}日${h}時間${m}分` : `${h}時間${m}分`;
}

function cpuTimes() {
  return os.cpus().reduce((acc, cpu) => {
    const t = cpu.times;
    acc.idle += t.idle;
    acc.total += t.user + t.nice + t.sys + t.idle + t.irq;
    return acc;
  }, { idle: 0, total: 0 });
}

// 一定時間あけて2回計測し、その間のCPU使用率を求める
async function getCpuUsage() {
  const start = cpuTimes();
  await new Promise(resolve => setTimeout(resolve, CPU_SAMPLE_MS));
  const end = cpuTimes();

  const total = end.total - start.total;
  if (total <= 0) return 0;
  return (1 - (end.idle - start.idle) / total) * 100;
}

// Raspberry PiのSoC温度（取得できない環境ではnull）
async function getCpuTemp() {
  try {
    const raw = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8');
    return Number(raw) / 1000;
  } catch {
    return null;
  }
}

async function getStorageUsage({ name, path }) {
  try {
    const st = await fs.statfs(path);
    const total = st.blocks * st.bsize;
    const used = total - st.bavail * st.bsize;
    const percent = total > 0 ? (used / total) * 100 : 0;
    return { name, value: `${formatBytes(used)} / ${formatBytes(total)} (${percent.toFixed(0)}%)` };
  } catch {
    return { name, value: '取得できません' };
  }
}

async function service(interaction) {
  // CPU計測で応答が遅れるため先に応答を保留する
  await interaction.deferReply({ flags: 64 });

  const [cpuUsage, cpuTemp, storages] = await Promise.all([
    getCpuUsage(),
    getCpuTemp(),
    Promise.all(STORAGES.map(getStorageUsage))
  ]);

  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();
  const load = os.loadavg().map(v => v.toFixed(2)).join(' / ');

  const embed = new CustomEmbedBuilder()
    .setTitle('📊 サーバーステータス')
    .setDescription('現在のサーバーの状態')
    .setColor(COLORS.INFO);

  embed.embedData.fields.push(
    { name: 'CPU使用率', value: `${cpuUsage.toFixed(1)}%`, inline: true },
    { name: 'CPU温度', value: cpuTemp === null ? '取得できません' : `${cpuTemp.toFixed(1)}℃`, inline: true },
    { name: 'ロードアベレージ (1/5/15分)', value: load, inline: true },
    { name: 'メモリ使用量', value: `${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${(usedMem / totalMem * 100).toFixed(0)}%)`, inline: false },
    ...storages.map(s => ({ name: `ストレージ: ${s.name}`, value: s.value, inline: true })),
    { name: 'サーバー稼働時間', value: formatDuration(os.uptime()), inline: true },
    { name: 'Bot稼働時間', value: formatDuration(process.uptime()), inline: true }
  );

  await interaction.editReply({
    embeds: [embed.build()]
  });
}

module.exports = {
  data,
  service
};
