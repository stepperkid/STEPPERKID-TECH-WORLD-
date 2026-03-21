const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/autobio.json');

function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ enabled: false, text: '' }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

let bioInterval = null;

async function startBioInterval(sock) {
    if (bioInterval) {
        clearInterval(bioInterval);
        bioInterval = null;
    }

    bioInterval = setInterval(async () => {
        try {
            const config = initConfig();
            if (!config.enabled || !config.text) return;

            const now = new Date();
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const bio = config.text
                .replace('{time}', time)
                .replace('{date}', date);

            await sock.updateProfileStatus(bio);
        } catch (e) {
            // silently ignore errors
        }
    }, 60000);
}

async function autoBioCommand(sock, chatId, msg, args) {
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
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return sock.sendMessage(chatId, { text: '✅ Auto Bio has been enabled!' });
    } else if (arg === 'off') {
        config.enabled = false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return sock.sendMessage(chatId, { text: '❌ Auto Bio has been disabled!' });
    } else if (arg === 'set') {
        const text = args.slice(1).join(' ');
        if (!text) return sock.sendMessage(chatId, { text: '❌ Please provide a bio text!\nYou can use {time} and {date} as placeholders.' });
        config.text = text;
        config.enabled = true;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return sock.sendMessage(chatId, { text: `✅ Auto Bio set to:\n${text}` });
    } else {
        const status = config.enabled ? 'enabled' : 'disabled';
        return sock.sendMessage(chatId, {
            text: `🔄 *Auto Bio Settings*\n\n📝 *Status:* ${status}\n💬 *Current Bio:* ${config.text || 'Not set'}\n\n*Commands:*\n.autobio on - Enable\n.autobio off - Disable\n.autobio set <text> - Set bio text\n\nPlaceholders: {time}, {date}`
        });
    }
}

module.exports = { startBioInterval, autoBioCommand };
