const fs = require('fs');
const { getBotName } = require('./setbotname');
const { getOwnerName } = require('./setownername');
const { loadPrefix } = require('./setprefix');
const isOwnerOrSudo = require('../lib/isOwner');

function readJsonSafe(path, fallback) {
    try {
        return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (_) {
        return fallback;
    }
}

async function getSettingsCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            return await sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can use this command!'
            }, { quoted: message });
        }

        const isGroup = chatId.endsWith('@g.us');
        const dataDir = './data';

        // --- Bot Config Values ---
        const currentPrefix = loadPrefix();
        const currentBotName = getBotName();
        const currentOwnerName = getOwnerName();

        // --- Live Status Values ---
        const mode = readJsonSafe(`${dataDir}/messageCount.json`, { isPublic: true });
        const autoStatus = readJsonSafe(`${dataDir}/autoStatus.json`, { enabled: false });
        const autoread = readJsonSafe(`${dataDir}/autoread.json`, { enabled: false });
        const autotyping = readJsonSafe(`${dataDir}/autotyping.json`, { enabled: false });
        const pmblocker = readJsonSafe(`${dataDir}/pmblocker.json`, { enabled: false });
        const anticall = readJsonSafe(`${dataDir}/anticall.json`, { enabled: false });
        const userGroupData = readJsonSafe(`${dataDir}/userGroupData.json`, {
            antilink: {}, antibadword: {}, welcome: {}, goodbye: {}, chatbot: {}, antitag: {}
        });
        const autoReaction = Boolean(userGroupData.autoReaction);

        // --- Per-group features ---
        const groupId = isGroup ? chatId : null;
        const antilinkOn = groupId ? Boolean(userGroupData.antilink?.[groupId]) : false;
        const antibadwordOn = groupId ? Boolean(userGroupData.antibadword?.[groupId]) : false;
        const welcomeOn = groupId ? Boolean(userGroupData.welcome?.[groupId]) : false;
        const goodbyeOn = groupId ? Boolean(userGroupData.goodbye?.[groupId]) : false;
        const chatbotOn = groupId ? Boolean(userGroupData.chatbot?.[groupId]) : false;
        const antitagCfg = groupId ? (userGroupData.antitag?.[groupId]) : null;

        const on = '✅ ON';
        const off = '❌ OFF';

        let text = `╭━━〔 *⚙️ BOT SETTINGS* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃ *⚙️ Configuration*
┃◈┃
┃◈┃ 🔹 *Prefix:* ${currentPrefix}
┃◈┃ 🔹 *Bot Name:* ${currentBotName}
┃◈┃ 🔹 *Owner Name:* ${currentOwnerName}
┃◈┃
┃◈┃ *📊 Live Status*
┃◈┃
┃◈┃ 🔸 *Mode:* ${mode.isPublic ? 'Public' : 'Private'}
┃◈┃ 🔸 *Auto Status:* ${autoStatus.enabled ? on : off}
┃◈┃ 🔸 *Autoread:* ${autoread.enabled ? on : off}
┃◈┃ 🔸 *Autotyping:* ${autotyping.enabled ? on : off}
┃◈┃ 🔸 *PM Blocker:* ${pmblocker.enabled ? on : off}
┃◈┃ 🔸 *Anticall:* ${anticall.enabled ? on : off}
┃◈┃ 🔸 *Auto Reaction:* ${autoReaction ? on : off}`;

        if (groupId) {
            const al = userGroupData.antilink?.[groupId];
            const ab = userGroupData.antibadword?.[groupId];
            text += `
┃◈┃
┃◈┃ *👥 Group Settings*
┃◈┃ 🔸 *Antilink:* ${antilinkOn ? `${on} (${al?.action || 'delete'})` : off}
┃◈┃ 🔸 *Antibadword:* ${antibadwordOn ? `${on} (${ab?.action || 'delete'})` : off}
┃◈┃ 🔸 *Welcome:* ${welcomeOn ? on : off}
┃◈┃ 🔸 *Goodbye:* ${goodbyeOn ? on : off}
┃◈┃ 🔸 *Chatbot:* ${chatbotOn ? on : off}
┃◈┃ 🔸 *Antitag:* ${antitagCfg?.enabled ? `${on} (${antitagCfg?.action || 'delete'})` : off}`;
        } else {
            text += `
┃◈┃
┃◈┃ _💡 Run inside a group to see_
┃◈┃ _per-group settings._`;
        }

        text += `
┃◈┃
┃◈┃ *🛠️ Change Config:*
┃◈┃ • *.botsettings prefix <sym>*
┃◈┃ • *.botsettings botname <name>*
┃◈┃ • *.botsettings ownername <name>*
┃◈└───────────┈⊷
╰──────────────┈⊷`;

        await sock.sendMessage(chatId, { text }, { quoted: message });

    } catch (error) {
        console.error('[GETSETTINGS] Error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to load settings: ' + error.message
        }, { quoted: message });
    }
}

module.exports = getSettingsCommand;
