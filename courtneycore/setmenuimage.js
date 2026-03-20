const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const isOwnerOrSudo = require('../lib/isOwner');

const DATA_DIR = path.join(process.cwd(), 'data');
const MENU_IMAGE_FILE = path.join(DATA_DIR, 'menuimage.json');
const MENU_IMAGE_PATH = path.join(DATA_DIR, 'menuimage.jpg');
const DEFAULT_IMAGE_URL = 'https://files.catbox.moe/8y619f.jpg';

function getMenuImage() {
    try {
        if (fs.existsSync(MENU_IMAGE_PATH)) {
            return { type: 'file', path: MENU_IMAGE_PATH };
        }
        if (fs.existsSync(MENU_IMAGE_FILE)) {
            const data = JSON.parse(fs.readFileSync(MENU_IMAGE_FILE, 'utf-8'));
            if (data.url) return { type: 'url', url: data.url };
        }
    } catch {}
    return { type: 'url', url: DEFAULT_IMAGE_URL };
}

function getMenuImageForSend() {
    const img = getMenuImage();
    if (img.type === 'file') {
        try {
            return fs.readFileSync(img.path);
        } catch {}
    }
    return { url: img.url || DEFAULT_IMAGE_URL };
}

function saveMenuImageUrl(url) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(MENU_IMAGE_PATH)) fs.unlinkSync(MENU_IMAGE_PATH);
    fs.writeFileSync(MENU_IMAGE_FILE, JSON.stringify({ url }, null, 2));
}

function saveMenuImageFile(buffer) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(MENU_IMAGE_FILE)) fs.unlinkSync(MENU_IMAGE_FILE);
    fs.writeFileSync(MENU_IMAGE_PATH, buffer);
}

async function setMenuImageCommand(sock, chatId, message, args) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can change the menu image!'
            }, { quoted: message });
            return;
        }

        const arg = (args || '').trim();

        if (arg === 'reset') {
            if (fs.existsSync(MENU_IMAGE_PATH)) fs.unlinkSync(MENU_IMAGE_PATH);
            if (fs.existsSync(MENU_IMAGE_FILE)) fs.unlinkSync(MENU_IMAGE_FILE);
            await sock.sendMessage(chatId, {
                text: '🔄 *Menu image reset to default!*\n\nType *.menu* to see it.'
            }, { quoted: message });
            return;
        }

        if (arg === 'view') {
            const imgData = getMenuImageForSend();
            await sock.sendMessage(chatId, {
                image: imgData,
                caption: `📸 *Current menu image*`
            }, { quoted: message });
            return;
        }

        if (arg.startsWith('http://') || arg.startsWith('https://')) {
            saveMenuImageUrl(arg);
            await sock.sendMessage(chatId, {
                image: { url: arg },
                caption: '✅ *Menu image updated!*\n\nType *.menu* to see it in action.'
            }, { quoted: message });
            return;
        }

        const imageMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
            || message.message?.imageMessage;

        if (imageMsg) {
            await sock.sendMessage(chatId, {
                text: '⬇️ *Downloading image...*'
            }, { quoted: message });

            const stream = await downloadContentFromMessage(imageMsg, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            saveMenuImageFile(buffer);

            await sock.sendMessage(chatId, {
                image: buffer,
                caption: '✅ *Menu image updated and saved locally!*\n\nType *.menu* to see it in action.'
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `*🖼️ Set Menu Image*\n\n` +
                  `Usage:\n` +
                  `• *.setmenuimage <url>* — set image from a URL\n` +
                  `• *.setmenuimage* — reply to an image to save it\n` +
                  `• *.setmenuimage view* — preview current menu image\n` +
                  `• *.setmenuimage reset* — restore default image`
        }, { quoted: message });

    } catch (error) {
        console.error('setmenuimage error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Failed to update menu image!*\n\nError: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = { setMenuImageCommand, getMenuImage, getMenuImageForSend };
