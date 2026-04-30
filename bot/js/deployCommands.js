/*
 * プロジェクトルートで `node bot/js/deployCommands.js` を実行すること
*/

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const commands = require('./core/commands');
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// コマンドデータを配列に変換
const commandData = Object.values(commands).map(cmd => cmd.data);

async function deployCommands() {
  try {
    console.log(`🚀 ${commandData.length} 個のコマンドを登録中...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_APPLICATION_ID, 
        process.env.DISCORD_GUILD_ID
      ),
      { body: commandData },
    );
    
    console.log(`✅ 登録完了！ ${data.length} 個のコマンドが登録されました。`);
  } catch (error) {
    console.error("❌ 登録中にエラーが発生：", commandData, error);
  }
}

deployCommands();