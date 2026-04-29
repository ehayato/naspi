const { CustomEmbedBuilder } = require("../core/embedBuilder");
const { COLORS } = require("../core/constants");

function hexToRgb(hex) {
  const s = String(hex || '').replace('#', '');
  if (s.length !== 6) return '';
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

async function runColors(interaction) {
  const embeds = Object.entries(COLORS).map(([name, color]) => {
    return new CustomEmbedBuilder()
      .setTitle(name)
      .setColor(color)
      .setDescription(`Hex: ${color}\nRGB: ${hexToRgb(color)}`)
      .build();
  });
  await interaction.reply({ 
    embeds: embeds,
    ephemeral: true });
}

module.exports = {
  run: runColors
};