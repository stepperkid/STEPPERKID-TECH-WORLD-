const { ttdl } = require("ruhend-scraper");
const axios = require('axios');

const CYPHERX_BASE = 'https://media.cypherxbot.space';
const processedMessages = new Set();

const TIKTOK_PATTERNS = [
    /https?:\/\/(?:www\.)?tiktok\.com\//,
    /https?:\/\/(?:vm\.)?tiktok\.com\//,
    /https?:\/\/(?:vt\.)?tiktok\.com\//,
    /https?:\/\/(?:www\.)?tiktok\.com\/@/,
    /https?:\/\/(?:www\.)?tiktok\.com\/t\//
];

async function cypherxTikTok(url) {
    const res = await axios.get(`${CYPHERX_BASE}/download/tiktok/video?url=${encodeURIComponent(url)}`, {
        timeout: 25000,
        headers: { 'accept': 'application/json' }
    });
    if (res.data?.success && res.data?.result?.download_url) {
        return { url: res.data.result.download_url, title: res.data.result.title };
    }
    throw new Error('CypherxBot TikTok API failed');
}

async function siputzxTikTok(url) {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`, {
        timeout: 15000,
        headers: { 'accept': '*/*', 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.data?.status && res.data?.data) {
        const data = res.data.data;
        const videoUrl = data.urls?.[0] || data.video_url || data.url || data.download_url;
        if (videoUrl) return { url: videoUrl, title: data.metadata?.title || 'TikTok Video' };
    }
    throw new Error('Siputzx TikTok API failed');
}

async function tiktokCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, { text: "Please provide a TikTok link for the video." });
        }

        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url) {
            return await sock.sendMessage(chatId, { text: "Please provide a TikTok link for the video." });
        }

        if (!TIKTOK_PATTERNS.some(p => p.test(url))) {
            return await sock.sendMessage(chatId, {
                text: "That is not a valid TikTok link. Please provide a valid TikTok video link."
            });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        let videoUrl = null;
        let title = null;

        // Try CypherxBot first
        try {
            const data = await cypherxTikTok(url);
            videoUrl = data.url;
            title = data.title;
        } catch {
            // Try Siputzx
            try {
                const data = await siputzxTikTok(url);
                videoUrl = data.url;
                title = data.title;
            } catch {
                // Try ttdl fallback
                try {
                    const downloadData = await ttdl(url);
                    if (downloadData?.data?.length > 0) {
                        for (const media of downloadData.data.slice(0, 20)) {
                            const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(media.url) || media.type === 'video';
                            if (isVideo) {
                                await sock.sendMessage(chatId, {
                                    video: { url: media.url },
                                    mimetype: "video/mp4",
                                    caption: "TRUTH-MD™"
                                }, { quoted: message });
                            } else {
                                await sock.sendMessage(chatId, {
                                    image: { url: media.url },
                                    caption: "TRUTH-MD™"
                                }, { quoted: message });
                            }
                        }
                        return;
                    }
                } catch (e) { console.error("ttdl fallback failed:", e.message); }
            }
        }

        if (!videoUrl) {
            return await sock.sendMessage(chatId, {
                text: "❌ Failed to download TikTok video. All methods failed. Please try a different link."
            }, { quoted: message });
        }

        const caption = title ? `TRUTH-MD™\n\n📝 ${title}` : "TRUTH-MD™";

        try {
            const videoRes = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 100 * 1024 * 1024,
                headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tiktok.com/' }
            });
            const buf = Buffer.from(videoRes.data);
            if (buf.length === 0) throw new Error("Empty video buffer");
            await sock.sendMessage(chatId, { video: buf, mimetype: "video/mp4", caption }, { quoted: message });
        } catch {
            await sock.sendMessage(chatId, { video: { url: videoUrl }, mimetype: "video/mp4", caption }, { quoted: message });
        }

    } catch (error) {
        console.error('TikTok command error:', error);
        await sock.sendMessage(chatId, {
            text: "An error occurred while processing the request. Please try again later."
        }, { quoted: message });
    }
}

module.exports = tiktokCommand;
