const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');

const CYPHERX_BASE = 'https://media.cypherxbot.space';

async function cypherxYTAudio(url) {
    const res = await axios.get(`${CYPHERX_BASE}/download/youtube/audio?url=${encodeURIComponent(url)}`, { timeout: 30000 });
    if (res.data?.success && res.data?.result?.download_url) {
        return { url: res.data.result.download_url, title: res.data.result.title };
    }
    throw new Error('CypherxBot audio API failed');
}

async function fallbackYTAudio(url) {
    const res = await axios.get(`https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(url)}`, { timeout: 30000 });
    if (res.data?.status && res.data?.result) {
        return { url: res.data.result, title: res.data.title };
    }
    throw new Error('Fallback audio API failed');
}

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

        let audioData;
        try {
            audioData = await cypherxYTAudio(video.url);
        } catch {
            audioData = await fallbackYTAudio(video.url);
        }

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const filePath = path.join(tempDir, `audio_${Date.now()}.mp3`);
        const audioResponse = await axios({ method: "get", url: audioData.url, responseType: "stream", timeout: 600000 });
        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);
        await new Promise((resolve, reject) => { writer.on("finish", resolve); writer.on("error", reject); });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        const fileBuffer = fs.readFileSync(filePath);
        const cleanTitle = (audioData.title || video.title).replace(/[^\w\s\-]/gi, '').trim();

        await sock.sendMessage(chatId, {
            document: fileBuffer,
            mimetype: "audio/mpeg",
            fileName: `${cleanTitle.substring(0, 100)}.mp3`,
            caption: `🎵 *${audioData.title || video.title}*`
        }, { quoted: message });

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("Play command error:", error);
        return await sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = playCommand;
