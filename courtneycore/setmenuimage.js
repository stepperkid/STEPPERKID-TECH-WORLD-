const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const isOwnerOrSudo = require('../lib/isOwner');

const MENU_IMAGE_FILE = path.join(process.cwd(), 'data', 'menuimage.json');
const DEFAULT_IMAGE_URL = 'https://files.catbox.moe/8y619f.jpg';

function getMenuImage() {
    try {
        if (fs.existsSync(MENU_IMAGE_FILE)) {
            const data = JSON.parse(fs.readFileSync(MENU_IMAGE_FILE, 'utf-8'));
            return data.url || DEFAULT_IMAGE_URL;
        }
    } catch {}
    return DEFAULT_IMAGE_URL;
}

function saveMenuImage(url) {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(MENU_IMAGE_FILE, JSON.stringify({ url }, null, 2));
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
            saveMenuImage(DEFAULT_IMAGE_URL);
            await sock.sendMessage(chatId, {
                text: '🔄 *Menu image reset to default!*\n\nType *.menu* to see it.'
            }, { quoted: message });
            return;
        }

        if (arg === 'view') {
            const current = getMenuImage();
            await sock.sendMessage(chatId, {
                image: { url: current },
                caption: `📸 *Current menu image*\n🔗 URL: ${current}`
            }, { quoted: message });
            return;
        }

        if (arg.startsWith('http://') || arg.startsWith('https://')) {
            saveMenuImage(arg);
            await sock.sendMessage(chatId, {
                image: { url: arg },
                caption: '✅ *Menu image updated!*\n\nType *.menu* to see it in action.'
            }, { quoted: message });
            return;
        }

        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage
            || message.message?.imageMessage && message.message;

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

            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const tmpPath = path.join(tmpDir, `menuimage_${Date.now()}.jpg`);
            fs.writeFileSync(tmpPath, buffer);

            const axios = require('axios');
            const FormData = require('form-data');

            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', fs.createReadStream(tmpPath), 'menuimage.jpg');

            const uploadRes = await axios.post('https://catbox.moe/user.php', form, {
                headers: form.getHeaders(),
                timeout: 30000
            });

            fs.unlinkSync(tmpPath);

            const uploadedUrl = uploadRes.data?.trim();
            if (!uploadedUrl || !uploadedUrl.startsWith('http')) {
                throw new Error('Upload failed — no URL returned');
            }

            saveMenuImage(uploadedUrl);
            await sock.sendMessage(chatId, {
                image: { url: uploadedUrl },
                caption: `✅ *Menu image updated!*\n\n🔗 URL: ${uploadedUrl}\n\nType *.menu* to see it in action.`
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `*🖼️ Set Menu Image*\n\n` +
                  `Usage:\n` +
                  `• *.setmenuimage <url>* — set image from URL\n` +
                  `• *.setmenuimage* — reply to an image to upload & set it\n` +
                  `• *.setmenuimage view* — see current menu image\n` +
                  `• *.setmenuimage reset* — restore default image`
        }, { quoted: message });

    } catch (error) {
        console.error('setmenuimage error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Failed to update menu image!*\n\nError: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = { setMenuImageCommand, getMenuImage };
