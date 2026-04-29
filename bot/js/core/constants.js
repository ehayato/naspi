const isDev = process.env.NODE_ENV === 'development';

const DevelopmentChannels = {
  COCKPIT: process.env.DEV_CH_COCKPIT,
  STATUS: process.env.DEV_CH_STATUS,
  CLOUD: process.env.DEV_CH_CLOUD,
  BACKUP: process.env.DEV_CH_BACKUP,
  LOG: process.env.DEV_CH_LOG,
  TEST: process.env.DEV_CH_TEST
}
const ProductionChannels = {
  COCKPIT: process.env.PROD_CH_COCKPIT,
  STATUS: process.env.PROD_CH_STATUS,
  CLOUD: process.env.PROD_CH_CLOUD,
  BACKUP: process.env.PROD_CH_BACKUP,
  LOG: process.env.PROD_CH_LOG,
  TEST: '' // 本番ではテストチャンネルを使用しない
}

// 本番チャンネルを汚さないためにNODE_ENVでチャンネルIDを切り替える
const CHANNELS = isDev ? DevelopmentChannels : ProductionChannels;

const COLORS = {
  DEFAULT:  "#7f7f7f",
  COCKPIT:  "#8843E1",
  ONLINE:   "#3460FB",
  INFO:     "#57B8FF",
  RUNNING:  "#C000C0",
  SUCCESS:  "#259D63",
  WARNING:  "#B78F00",
  ERROR:    "#EC0000"
};

module.exports = {
  COLORS,
  CHANNELS,
  isDev
};