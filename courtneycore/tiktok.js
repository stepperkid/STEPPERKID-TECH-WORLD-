const axios = require('axios');

const processedMessages = new Set();

const TIKTOK_PATTERNS = [
    /https?:\/\/(?:www\.)?tiktok\.com\//,
    /https?:\/\/(?:vm\.)?tiktok\.com\//,
    /https?:\/\/(?:vt\.)?tiktok\.com\//,
    /https?:\/\/(?:www\.)?tiktok\.com\/@/,
    /https?:\/\/(?:www\.)?tiktok\.com\/t\//
];

async function tikwmDownload(url) {
    const params = new URLSearchParams({ url, count: 1, cursor: 0, web: 1, hd: 1 });
    const res = await axios.post('https://www.tikwm.com/api/', params.toString(), {
        timeout: 20000,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.tikwm.com/'
        }
    });
    if (res.data?.code === 0 && res.data?.data) {
        const d = res.data.data;
        const videoUrl = d.hdplay || d.play || d.wmplay;
        if (!videoUrl) throw new Error('No video URL in TikWM response');
        return { url: videoUrl, title: d.title || 'TikTok Video', cover: d.cover };
    }
    throw new Error('TikWM API failed: ' + JSON.stringify(res.data).slice(0, 100));
}

async function tiktokCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) return await sock.sendMessage(chatId, { text: "Please provide a TikTok link." }, { quoted: message });

        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url) return await sock.sendMessage(chatId, { text: "Please provide a TikTok link.\nExample: .tiktok https://vm.tiktok.com/..." }, { quoted: message });

        if (!TIKTOK_PATTERNS.some(p => p.test(url))) {
            return await sock.sendMessage(chatId, { text: "❌ Not a valid TikTok link." }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        const data = await tikwmDownload(url);

        const caption = `🎵 *${data.title}*\n> *STEPPERKID-TECH-WORLD*`;

        if (data.cover) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: data.cover },
                    caption: `*${data.title}*\n⏳ Downloading...`
                }, { quoted: message });
            } catch (e) {}
        }

        await sock.sendMessage(chatId, {
            video: { url: data.url },
            mimetype: 'video/mp4',
            caption
        }, { quoted: message });

    } catch (error) {
        console.error('TikTok command error:', error.message);
        await sock.sendMessage(chatId, {
            text: "❌ Failed to download TikTok video.\n" + error.message
        }, { quoted: message });
    }
}

module.exports = tiktokCommand;
