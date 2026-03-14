const fs = require('fs');

const PREFIX_FILE = './data/prefix.json';

function loadPrefix() {
    try {
        const data = JSON.parse(fs.readFileSync(PREFIX_FILE, 'utf8'));
        return data.prefix || '.';
    } catch { return '.'; }
}

function savePrefix(prefix) {
    fs.writeFileSync(PREFIX_FILE, JSON.stringify({ prefix }, null, 2));
}

async function setPrefixCommand(sock, chatId, message, isOwner) {
    try {
        if (!isOwner) {
            return await sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can change the prefix!'
            }, { quoted: message });
        }

        const text = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() || '';

        const parts = text.trim().split(/\s+/);
        const newPrefix = parts[1];

        if (!newPrefix) {
            const current = loadPrefix();
            return await sock.sendMessage(chatId, {
                text: `*⚙️ Prefix Settings*\n\n` +
                      `Current prefix: *${current}*\n\n` +
                      `Usage: .setprefix <symbol>\n` +
                      `Example: .setprefix !\n` +
                      `Example: .setprefix /\n` +
                      `Example: .setprefix #\n\n` +
                      `_Use .setprefix . to reset to default_`
            }, { quoted: message });
        }

        if (newPrefix.length > 3) {
            return await sock.sendMessage(chatId, {
                text: '❌ Prefix must be 1-3 characters long!'
            }, { quoted: message });
        }

        const oldPrefix = loadPrefix();
        savePrefix(newPrefix);
        global.botPrefix = newPrefix;

        await sock.sendMessage(chatId, {
            text: `✅ *Prefix Updated!*\n\n` +
                  `Old prefix: *${oldPrefix}*\n` +
                  `New prefix: *${newPrefix}*\n\n` +
                  `All commands now use: *${newPrefix}help*, *${newPrefix}ping*, etc.`
        }, { quoted: message });

    } catch (error) {
        console.error('[SETPREFIX] Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to update prefix: ' + error.message
        }, { quoted: message });
    }
}

module.exports = { setPrefixCommand, loadPrefix, savePrefix };
