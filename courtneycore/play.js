const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');
const ytdl = require('@distube/ytdl-core');

async function playCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '🎵', key: message.key } });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '🎵 Provide a song name!\nExample: .play Not Like Us'
            }, { quoted: message });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, {
                text: '📝 Song name too long! Max 100 chars.'
            }, { quoted: message });
        }

        const searchResult = (await yts(`${query} official`)).videos[0];
        if (!searchResult) {
            return sock.sendMessage(chatId, {
                text: "😕 Couldn't find that song. Try another one!"
            }, { quoted: message });
        }

        const video = searchResult;

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const filePath = path.join(tempDir, `audio_${Date.now()}.mp3`);

        const info = await ytdl.getInfo(video.url);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        if (!audioFormats.length) throw new Error('No audio format found');

        const bestAudio = audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

        const audioStream = ytdl(video.url, { format: bestAudio });
        const writer = fs.createWriteStream(filePath);
        audioStream.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
            audioStream.on('error', reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        const fileBuffer = fs.readFileSync(filePath);
        const cleanTitle = video.title.replace(/[^\w\s\-]/gi, '').trim();

        await sock.sendMessage(chatId, {
            document: fileBuffer,
            mimetype: "audio/mpeg",
            fileName: `${cleanTitle.substring(0, 100)}.mp3`,
            caption: `🎵 *${video.title}*\n> *STEPPERKID-TECH-WORLD*`
        }, { quoted: message });

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Play command error:", error.message);
        return await sock.sendMessage(chatId, {
            text: `🚫 Failed to download. Try another song.\nError: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = playCommand;
