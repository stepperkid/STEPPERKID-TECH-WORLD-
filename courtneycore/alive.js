const fs = require('fs');
const settings = require("../settings");

function getBotMode() {
    try {
        const data = JSON.parse(fs.readFileSync('./data/messageCount.json', 'utf-8'));
        return data.isPublic === false ? 'Private' : 'Public';
    } catch {
        return settings.commandMode === 'private' ? 'Private' : 'Public';
    }
}

async function aliveCommand(sock, chatId, message) {
    try {
        const prefix = settings.prefix || ".";
        const version = settings.version || "1.0.5";
        const mode = getBotMode();

        const caption = `*─━┄๑⚡๑┄━─*\n` +
                        `    🟢 *TitanBot-Core 🛡️ IS ALIVE!* ⚡\n` +
                        `*─━┄๑⚡๑┄━─*\n\n` +
                        `✨ *Version:* ${version}\n` +
                        `🟢 *Status:* Online & Active\n` +
                        `🌙 *Mode:* ${mode}\n` +
                        `⚡ *Prefix:* \`${prefix}\`\n\n` +
                        `🔥 *Powerful Features:*\n` +
                        ` ➤ Group Management Tools\n` +
                        ` ➤ Antilink • Welcome • Goodbye\n` +
                        ` ➤ Downloader (YT, TT, IG, FB, etc)\n` +
                        ` ➤ Advanced AI Commands\n` +
                        ` ➤ Sticker Maker • Meme • Fun\n` +
                        ` ➤ 200+ Working Commands!\n\n` +
                        `📌 Type *${prefix}menu* or *${prefix}help* for commands\n\n` +
                        `> © 2025 TitanBot-Core 🛡️ - Powered by NodeJS`;

        await sock.sendMessage(chatId, {
            image: { url: "./image.jpg" },
            caption: caption,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: "120363409714698622@newsletter",
                    newsletterName: "TitanBot-Core 🛡️",
                    serverMessageId: -1
                }
            }
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            audio: { 
                url: "./courtney.mp3"
            },
            mimetype: "audio/mpeg",
            ptt: false,
            waveform: [0, 25, 50, 80, 100, 80, 50, 25, 10, 0, 10, 25, 40, 60, 80, 90, 80, 60, 40, 20, 0]
        }, { quoted: message });

    } catch (error) {
        console.error("Error in alive command:", error);
        await sock.sendMessage(chatId, {
            text: "😭 *Error occurred*, But online!\n\n> TitanBot-Core 🛡️ 💪"
        }, { quoted: message });
    }
}

module.exports = aliveCommand;
