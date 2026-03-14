const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CYPHERX_BASE = 'https://media.cypherxbot.space';

async function cypherxFacebook(url) {
    const res = await axios.get(`${CYPHERX_BASE}/download/facebook/video?url=${encodeURIComponent(url)}`, {
        timeout: 25000,
        headers: { 'accept': 'application/json' }
    });
    if (res.data?.success && res.data?.result?.download_url) {
        return { url: res.data.result.download_url, title: res.data.result.title };
    }
    throw new Error('CypherxBot Facebook API failed');
}

async function hanggtsAPI(url) {
    const res = await axios.get(`https://api.hanggts.xyz/download/facebook?url=${encodeURIComponent(url)}`, {
        timeout: 20000,
        headers: { 'accept': '*/*', 'User-Agent': 'Mozilla/5.0' },
        maxRedirects: 5,
        validateStatus: s => s >= 200 && s < 500
    });
    const data = res.data;
    if (!data) throw new Error('No data from Hanggts');

    let fbvid = null;
    let title = null;

    if (data.result?.media) {
        fbvid = data.result.media.video_hd || data.result.media.video_sd;
        title = data.result.info?.title || data.result.title || data.title || "Facebook Video";
    } else if (typeof data.result === 'object' && data.result?.url) {
        fbvid = data.result.url; title = data.result.title || "Facebook Video";
    } else if (typeof data.result === 'string' && data.result.startsWith('http')) {
        fbvid = data.result; title = data.title || "Facebook Video";
    } else if (data.result?.download) {
        fbvid = data.result.download; title = data.result.title || "Facebook Video";
    } else if (data.data?.url) {
        fbvid = data.data.url; title = data.data.title || "Facebook Video";
    } else if (data.url) {
        fbvid = data.url; title = data.title || "Facebook Video";
    }

    if (!fbvid) throw new Error('Hanggts: no video URL extracted');
    return { url: fbvid, title };
}

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: "Please provide a Facebook video URL.\nExample: .fb https://www.facebook.com/..."
            }, { quoted: message });
        }

        if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
            return await sock.sendMessage(chatId, { text: "That is not a Facebook link." }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        // Resolve redirects
        let resolvedUrl = url;
        try {
            const res = await axios.get(url, { timeout: 20000, maxRedirects: 10, headers: { 'User-Agent': 'Mozilla/5.0' } });
            const possible = res?.request?.res?.responseUrl;
            if (possible) resolvedUrl = possible;
        } catch { }

        let videoData;
        // Try CypherxBot first
        try {
            videoData = await cypherxFacebook(resolvedUrl);
        } catch {
            try {
                videoData = await cypherxFacebook(url);
            } catch {
                // Fallback to Hanggts
                try {
                    videoData = await hanggtsAPI(resolvedUrl);
                } catch {
                    videoData = await hanggtsAPI(url);
                }
            }
        }

        if (!videoData?.url) {
            return await sock.sendMessage(chatId, {
                text: '❌ Failed to get video URL from Facebook.\n\nPossible reasons:\n• Video is private or deleted\n• Link is invalid\n• Video is not available for download'
            }, { quoted: message });
        }

        const caption = videoData.title ? `TRUTH-MD™\n\n📝 Title: ${videoData.title}` : "TRUTH-MD™";

        try {
            await sock.sendMessage(chatId, {
                video: { url: videoData.url },
                mimetype: "video/mp4",
                caption
            }, { quoted: message });
        } catch (urlError) {
            console.error('URL method failed:', urlError.message);

            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

            const videoRes = await axios({
                method: 'GET', url: videoData.url, responseType: 'stream', timeout: 60000,
                headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.facebook.com/' }
            });
            const writer = fs.createWriteStream(tempFile);
            videoRes.data.pipe(writer);
            await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

            if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size === 0) throw new Error('Download failed');

            await sock.sendMessage(chatId, { video: { url: tempFile }, mimetype: "video/mp4", caption }, { quoted: message });
            try { fs.unlinkSync(tempFile); } catch { }
        }

    } catch (error) {
        console.error('Facebook command error:', error);
        await sock.sendMessage(chatId, {
            text: "An error occurred. API might be down. Error: " + error.message
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
