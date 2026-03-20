const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const DATA_FILE = path.join(process.cwd(), 'data', 'botname.json');
const DEFAULT_NAME = 'TitanBot-Core 🛡️';

function getBotName() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            return data.name || DEFAULT_NAME;
        }
    } catch {}
    return DEFAULT_NAME;
}

function saveBotName(name) {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ name }, null, 2));
}

async function setBotNameCommand(sock, chatId, message, name) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can change the bot name!'
            }, { quoted: message });
            return;
        }

        if (!name || name.trim() === '') {
            const current = getBotName();
            await sock.sendMessage(chatId, {
                text: `*🤖 Bot Name*\n\n` +
                      `Current: *${current}*\n\n` +
                      `Usage:\n` +
                      `• *.setbotname <name>* — set a new bot name\n` +
                      `• *.setbotname reset* — reset to default`
            }, { quoted: message });
            return;
        }

        if (name.trim().toLowerCase() === 'reset') {
            saveBotName(DEFAULT_NAME);
            await sock.sendMessage(chatId, {
                text: `🔄 *Bot name reset to default: ${DEFAULT_NAME}*`
            }, { quoted: message });
            return;
        }

        const trimmed = name.trim();
        saveBotName(trimmed);
        await sock.sendMessage(chatId, {
            text: `✅ *Bot name set to: ${trimmed}*\n\nType *.menu* to see it updated.`
        }, { quoted: message });

    } catch (error) {
        console.error('setbotname error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to set bot name: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = { setBotNameCommand, getBotName };
