const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const DATA_FILE = path.join(process.cwd(), 'data', 'ownername.json');

function getOwnerName() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            return data.name || 'Not set';
        }
    } catch {}
    return 'Not set';
}

function saveOwnerName(name) {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ name }, null, 2));
}

async function setOwnerNameCommand(sock, chatId, message, name) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can change the owner name!'
            }, { quoted: message });
            return;
        }

        if (!name || name.trim() === '') {
            const current = getOwnerName();
            await sock.sendMessage(chatId, {
                text: `*👤 Owner Name*\n\n` +
                      `Current: *${current}*\n\n` +
                      `Usage:\n` +
                      `• *.setownername <name>* — set a new owner name\n` +
                      `• *.setownername reset* — reset to "Not set"`
            }, { quoted: message });
            return;
        }

        if (name.trim().toLowerCase() === 'reset') {
            saveOwnerName('Not set');
            await sock.sendMessage(chatId, {
                text: '🔄 *Owner name reset to "Not set"*'
            }, { quoted: message });
            return;
        }

        const trimmed = name.trim();
        saveOwnerName(trimmed);
        await sock.sendMessage(chatId, {
            text: `✅ *Owner name set to: ${trimmed}*\n\nType *.menu* to see it updated.`
        }, { quoted: message });

    } catch (error) {
        console.error('setownername error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to set owner name: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = { setOwnerNameCommand, getOwnerName };
