const fs = require('fs');
const os = require('os');
const settings = require('../settings');

function detectPlatform() {
  const p = process.platform;
  const arch = process.arch;
  if (process.env.REPL_SLUG || process.env.REPL_ID) return 'Replit';
  if (process.env.HEROKU_APP_NAME || process.env.DYNO) return 'Heroku';
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) return 'Railway';
  if (process.env.RENDER_SERVICE_ID) return 'Render';
  if (process.env.P_SERVER_UUID || process.env.PTERODACTYL_ENVIRONMENT) return 'Pterodactyl';
  if (process.env.VERCEL) return 'Vercel';
  if (process.env.CODESPACE_NAME) return 'GitHub Codespaces';
  if (process.env.KOYEB_APP_NAME) return 'Koyeb';
  if (process.env.COOLIFY_APP_ID) return 'Coolify';
  if (p === 'linux') return `Linux (${arch})`;
  if (p === 'win32') return `Windows (${arch})`;
  if (p === 'darwin') return `macOS (${arch})`;
  return `${p} (${arch})`;
}

function getUptime() {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

function getBotMode() {
  try {
    const data = JSON.parse(fs.readFileSync('./data/messageCount.json', 'utf-8'));
    return data.isPublic === false ? 'Private' : 'Public';
  } catch {
    return settings.commandMode === 'private' ? 'Private' : 'Public';
  }
}

function getRamBar() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const percent = Math.round((usedMem / totalMem) * 100);
  const barLength = 15;
  const filled = Math.round((percent / 100) * barLength);
  const empty = barLength - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const usedMB = (usedMem / 1024 / 1024).toFixed(0);
  const totalMB = (totalMem / 1024 / 1024).toFixed(0);
  return `${bar} ${percent}% (${usedMB}/${totalMB} MB)`;
}

function buildMenu() {
  const mode = getBotMode();
  const uptime = getUptime();
  const ramBar = getRamBar();
  const time = new Date().toLocaleString();

  return `╭━━━〔 *STEPPERKID-TECH-WORLD* 〕━━━┈⊷
┃★╭──────────────
┃★│ *Owner* : *COURTNEY*
┃★│ *Bot* : *STEPPERKID-TECH-WORLD*
┃★│ *Time* : *${time}*
┃★│ *Platform* : *${detectPlatform()}*
┃★│ *Mode* : *${mode}*
┃★│ *Prefix* : *[.]*
┃★│ *Uptime* : *${uptime}*
┃★│ *Version* : *${settings.version || '1.0.5'}*
┃★│ *RAM* : ${ramBar}
┃★╰──────────────
╰━━━━━━━━━━━━━━━┈⊷

╭━━〔 *DOWNLOAD MENU* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• facebook
┃◈┃• mediafire
┃◈┃• tiktok
┃◈┃• twitter
┃◈┃• insta
┃◈┃• apk
┃◈┃• img
┃◈┃• pinterest 
┃◈┃• spotify
┃◈┃• play
┃◈┃• ytmp3
┃◈┃• ytmp4
┃◈┃• song
┃◈┃• audio
┃◈┃• video
┃◈┃• ssweb
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *GROUP MENU* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• grouplink
┃◈┃• add
┃◈┃• remove
┃◈┃• kick
┃◈┃• promote 
┃◈┃• demote
┃◈┃• revoke
┃◈┃• setwelcome
┃◈┃• setgoodbye
┃◈┃• delete 
┃◈┃• ginfo
┃◈┃• mute
┃◈┃• unmute
┃◈┃• lockgc
┃◈┃• unlockgc
┃◈┃• tag
┃◈┃• hidetag
┃◈┃• tagall
┃◈┃• tagadmins
┃◈┃• ban
┃◈┃• warn
┃◈┃• warnings
┃◈┃• antilink
┃◈┃• antibadword
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *OWNER MENU* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• owner
┃◈┃• menu
┃◈┃• vv
┃◈┃• block
┃◈┃• unblock
┃◈┃• setpp
┃◈┃• restart
┃◈┃• shutdown
┃◈┃• alive
┃◈┃• ping 
┃◈┃• jid
┃◈┃• chjid
┃◈┃• mode
┃◈┃• update
┃◈┃• settings
┃◈┃•autostatus
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *FUN MENU* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• joke
┃◈┃• quote
┃◈┃• fact
┃◈┃• truth
┃◈┃• dare
┃◈┃• insult
┃◈┃• ship
┃◈┃• character
┃◈┃• kiss
┃◈┃• hug
┃◈┃• pat
┃◈┃• poke
┃◈┃• 8ball
┃◈┃• flirt
┃◈┃• shayari
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *CONVERT MENU* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• sticker
┃◈┃• emojimix
┃◈┃• take
┃◈┃• tomp3
┃◈┃• tts
┃◈┃• trt
┃◈┃• tinyurl
┃◈┃• url
┃◈┃• blur
┃◈┃• removebg
┃◈┃• remini
┃◈┃• crop
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *AI MENU* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• ai
┃◈┃• gpt
┃◈┃• gemini
┃◈┃• meta
┃◈┃• imagine 
┃◈┃• flux
┃◈┃• sora
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *MAIN MENU* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• ping
┃◈┃• alive
┃◈┃• runtime
┃◈┃• uptime 
┃◈┃• repo
┃◈┃• owner
┃◈┃• menu
┃◈┃• help
┃◈┃• tts
┃◈┃• weather
┃◈┃• news
┃◈┃• lyrics
┃◈┃• ss
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *ANIME MENU* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• waifu
┃◈┃• neko
┃◈┃• loli
┃◈┃• maid
┃◈┃• animegirl
┃◈┃• foxgirl
┃◈┃• naruto
┃◈┃• cry
┃◈┃• wink
┃◈┃• facepalm
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *TEXT PRO MENU* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• metallic
┃◈┃• ice
┃◈┃• snow
┃◈┃• neon
┃◈┃• devil
┃◈┃• thunder
┃◈┃• hacker
┃◈┃• glitch
┃◈┃• fire
┃◈└───────────┈⊷
╰──────────────┈⊷

╭━━〔 *DOWNLOADER* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• instagram
┃◈┃• facebook
┃◈┃• tiktok
┃◈┃• play
┃◈┃• spotify
┃◈└───────────┈⊷
╰──────────────┈⊷

> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ COURTNEY | STEPPERKID-TECH-WORLD`.trim();
}

const helpCommand = async (sock, chatId, message) => {
  if (!sock || !chatId) return console.error('Missing sock or chatId');

  try {
    const quoted = message || null;
    const menuText = buildMenu();
    
    await sock.sendMessage(chatId, {
      image: { url: 'https://files.catbox.moe/8y619f.jpg' },
      caption: menuText,
      contextInfo: {
        mentionedJid: message?.sender ? [message.sender] : [],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363409714698622@newsletter',
          newsletterName: 'STEPPERKID-TECH-WORLD',
          serverMessageId: 143
        }
      }
    }, { quoted });

  } catch (error) {
    console.error('helpCommand Error:', error);
    const menuText = buildMenu();
    await sock.sendMessage(chatId, { 
      text: menuText,
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '0029VbCafMZBA1f42UxcYW0D@newsletter',
          newsletterName: 'STEPPERKID-TECH-WORLD',
          serverMessageId: 143
        }
      }
    }, { quoted: message });
  }
};

module.exports = helpCommand;
