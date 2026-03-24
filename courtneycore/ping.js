const os = require('os');
const fs = require('fs');
const { performance } = require('perf_hooks');
const settings = require('../settings.js');
const { getBotName } = require('./setbotname');

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds % 86400 / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const secs = Math.floor(seconds % 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
}

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
    return `${bar} ${percent}%\n┃        (${usedMB}/${totalMB} MB)`;
}

async function pingCommand(sock, chatId, message) {
    try {
        const startTime = performance.now();

        const measuringMsg = await sock.sendMessage(chatId, {
            text: "```Measuring Speed...``` ⚡"
        }, { quoted: message });

        const latency = (performance.now() - startTime).toFixed(3);
        const botName = getBotName();
        const uptime = formatUptime(process.uptime());
        const platform = detectPlatform();
        const mode = getBotMode();
        const cpu = os.cpus()[0].model.split(' ')[0] + ' ' + os.cpus().length + '-Core';
        const ramBar = getRamBar();

        const premiumPing = 
`┏━━━━━━┫ ${botName} ┣━━━━━━┓
┃  ⚡ *BOT SPEED TEST* ⚡
┣━━━━━━━━━━━━━━━━━━━━━
┃  🚀 *${botName} Speed:* ${latency} ms
┃  🕒 *Uptime*     : ${uptime}
┃  💾 *RAM*        : ${ramBar}
┃  🖥️ *Platform*   : ${platform}
┃  ⚙️ *Processor*  : ${cpu}
┃  📟 *Version*    : v${settings.version || '1.0.5'}
┃  🌙 *Mode*       : ${mode}
┣━━━━━━━━━━━━━━━━━━━━━
┃  🟢 *Status* : Fully Active & Stable
┗━━━━━━━━━━━━━━━━━━━━━

> © 2025 ${botName} • Powered by NodeJS + Baileys`;

        await sock.sendMessage(chatId, {
            text: premiumPing,
            edit: measuringMsg.key
        });

        await sock.sendMessage(chatId, {
            react: { text: "⚡", key: measuringMsg.key }
        });

    } catch (error) {
        console.error('Error in premium ping command:', error);
        await sock.sendMessage(chatId, {
            text: "😭 Ping failed, bot always online! 💪"
        }, { quoted: message });
    }
}

module.exports = pingCommand;
