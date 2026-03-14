const axios = require('axios');
const yts = require('yt-search');

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

async function songCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { react: { text: '🕳️', key: message.key } });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '🎵 Provide a song name!\nExample: .song Not Like Us'
            }, { quoted: message });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, {
                text: 'Song name too long! Max 100 chars.'
            }, { quoted: message });
        }

        const searchResult = (await yts(`${query} official`)).videos[0];
        if (!searchResult) {
            return sock.sendMessage(chatId, {
                text: "Am sorry couldn't find that song try YouTube..!"
            }, { quoted: message });
        }

        const video = searchResult;

        let audioData;
        try {
            audioData = await cypherxYTAudio(video.url);
        } catch {
            audioData = await fallbackYTAudio(video.url);
        }

        await sock.sendMessage(chatId, {
            audio: { url: audioData.url },
            mimetype: "audio/mpeg",
            fileName: `${(audioData.title || video.title).replace(/[^\w\s\-]/gi, '').trim()}.mp3`,
            caption: `🎶 *${audioData.title || video.title}*`
        }, { quoted: message });

    } catch (error) {
        console.error("Song command error:", error);
        return await sock.sendMessage(chatId, {
            text: `🚫 Error: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = songCommand;
