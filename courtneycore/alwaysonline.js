const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/alwaysonline.json');

function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

function isAlwaysOnlineEnabled() {
    try {
        return initConfig().enabled;
    } catch {
        return false;
    }
}

let alwaysOnlineInterval = null;

function startAlwaysOnline(sock) {
    if (alwaysOnlineInterval) {
        clearInterval(alwaysOnlineInterval);
        alwaysOnlineInterval = null;
    }

    alwaysOnlineInterval = setInterval(async () => {
        try {
            if (isAlwaysOnlineEnabled()) {
                await sock.sendPresenceUpdate('available');
            }
        } catch (e) {
            // silently ignore errors
        }
    }, 10000);
}

async function alwaysOnlineCommand(sock, chatId, msg, args) {
    const isOwnerOrSudo = require('../lib/isOwner');
    const senderId = msg.key.participant || msg.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

    if (!msg.key.fromMe && !isOwner) {
        return sock.sendMessage(chatId, { text: '❌ This command is only for the owner!' });
    }

    const config = initConfig();
    const arg = (args[0] || '').toLowerCase();

    if (arg === 'on') {
        config.enabled = true;
    } else if (arg === 'off') {
        config.enabled = false;
    } else {
        config.enabled = !config.enabled;
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await sock.sendMessage(chatId, {
        text: `✅ Always Online has been ${config.enabled ? 'enabled' : 'disabled'}!`
    });
}

module.exports = { startAlwaysOnline, alwaysOnlineCommand, isAlwaysOnlineEnabled };
