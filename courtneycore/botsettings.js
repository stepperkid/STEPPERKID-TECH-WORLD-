const { getBotName, setBotNameCommand } = require('./setbotname');
const { getOwnerName, setOwnerNameCommand } = require('./setownername');
const { loadPrefix, savePrefix } = require('./setprefix');
const isOwnerOrSudo = require('../lib/isOwner');

async function botSettingsCommand(sock, chatId, message, args, rawText) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            return await sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can access bot settings!'
            }, { quoted: message });
        }

        const sub = args[0]?.toLowerCase();

        if (!sub) {
            const currentPrefix = loadPrefix();
            const currentBotName = getBotName();
            const currentOwnerName = getOwnerName();

            return await sock.sendMessage(chatId, {
                text: `╭━━〔 *⚙️ BOT SETTINGS* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃ *Current Values:*
┃◈┃
┃◈┃ 🔹 *Prefix:* ${currentPrefix}
┃◈┃ 🔹 *Bot Name:* ${currentBotName}
┃◈┃ 🔹 *Owner Name:* ${currentOwnerName}
┃◈┃
┃◈┃ *Subcommands:*
┃◈┃
┃◈┃ • *.botsettings prefix <symbol>*
┃◈┃   Change command prefix
┃◈┃   _e.g. .botsettings prefix !_
┃◈┃
┃◈┃ • *.botsettings botname <name>*
┃◈┃   Change the bot's display name
┃◈┃   _e.g. .botsettings botname TitanBot_
┃◈┃
┃◈┃ • *.botsettings ownername <name>*
┃◈┃   Change the owner's display name
┃◈┃   _e.g. .botsettings ownername John_
┃◈┃
┃◈┃ • *.botsettings prefix reset*
┃◈┃ • *.botsettings botname reset*
┃◈┃ • *.botsettings ownername reset*
┃◈┃   Reset each setting to default
┃◈└───────────┈⊷
╰──────────────┈⊷`
            }, { quoted: message });
        }

        if (sub === 'prefix') {
            const value = rawText.replace(/^\.\s*botsettings\s+prefix\s*/i, '').trim();

            if (!value) {
                const current = loadPrefix();
                return await sock.sendMessage(chatId, {
                    text: `*⚙️ Prefix Settings*\n\nCurrent prefix: *${current}*\n\nUsage: .botsettings prefix <symbol>\nExample: .botsettings prefix !\n\n_Use .botsettings prefix . to reset to default_`
                }, { quoted: message });
            }

            if (value.toLowerCase() === 'reset') {
                savePrefix('.');
                global.botPrefix = '.';
                return await sock.sendMessage(chatId, {
                    text: `🔄 *Prefix reset to default: .*`
                }, { quoted: message });
            }

            if (value.length > 3) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Prefix must be 1-3 characters long!'
                }, { quoted: message });
            }

            const oldPrefix = loadPrefix();
            savePrefix(value);
            global.botPrefix = value;

            return await sock.sendMessage(chatId, {
                text: `✅ *Prefix Updated!*\n\nOld prefix: *${oldPrefix}*\nNew prefix: *${value}*\n\nAll commands now use: *${value}help*, *${value}ping*, etc.`
            }, { quoted: message });
        }

        if (sub === 'botname') {
            const value = rawText.replace(/^\.\s*botsettings\s+botname\s*/i, '').trim();
            return await setBotNameCommand(sock, chatId, message, value);
        }

        if (sub === 'ownername') {
            const value = rawText.replace(/^\.\s*botsettings\s+ownername\s*/i, '').trim();
            return await setOwnerNameCommand(sock, chatId, message, value);
        }

        await sock.sendMessage(chatId, {
            text: `❓ Unknown setting *"${sub}"*\n\nUse *.botsettings* to see all available settings.`
        }, { quoted: message });

    } catch (error) {
        console.error('[BOTSETTINGS] Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to process settings: ' + error.message
        }, { quoted: message });
    }
}

module.exports = { botSettingsCommand };
