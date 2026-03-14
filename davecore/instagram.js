const { igdl } = require("ruhend-scraper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const CYPHERX_BASE = 'https://media.cypherxbot.space';
const processedMessages = new Set();

const INSTAGRAM_PATTERNS = [
    /https?:\/\/(?:www\.)?instagram\.com\//,
    /https?:\/\/(?:www\.)?instagr\.am\//,
    /https?:\/\/(?:www\.)?instagram\.com\/p\//,
    /https?:\/\/(?:www\.)?instagram\.com\/reel\//,
    /https?:\/\/(?:www\.)?instagram\.com\/tv\//
];

async function cypherxInstagram(url) {
    const res = await axios.get(`${CYPHERX_BASE}/download/instagram/video?url=${encodeURIComponent(url)}`, {
        timeout: 25000,
        headers: { 'accept': 'application/json' }
    });
    if (res.data?.success && res.data?.result?.download_url) {
        return { url: res.data.result.download_url, title: res.data.result.title };
    }
    throw new Error('CypherxBot Instagram API failed');
}

async function downloadToFile(url, filePath) {
    const writer = fs.createWriteStream(filePath);
    const response = await axios({
        method: "GET", url, responseType: "stream", timeout: 45000,
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.instagram.com/", "Accept": "video/mp4,video/*,image/*,*/*;q=0.8" }
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", (err) => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); reject(err); });
        response.data.on("error", (err) => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); reject(err); });
    });
}

function extractUniqueMedia(mediaData) {
    const seen = new Set();
    return mediaData.filter(m => m.url && !seen.has(m.url) && seen.add(m.url));
}

async function instagramCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: "📷 *Instagram Downloader*\n\n💡 *Usage:*\n• .instagram <url>"
            }, { quoted: message });
        }

        const urlMatch = text.match(/https?:\/\/[^\s<>"']+/);
        const url = urlMatch ? urlMatch[0].replace(/[.,;!?)]+$/, "") : "";

        if (!INSTAGRAM_PATTERNS.some(p => p.test(url))) {
            return await sock.sendMessage(chatId, {
                text: "❌ Not a valid Instagram link\n\nProvide: instagram.com/p/... or instagram.com/reel/..."
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: "📥 *Downloading from Instagram...*" }, { quoted: message });

        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Try CypherxBot first
        try {
            const data = await cypherxInstagram(url);
            const isVideo = url.includes("/reel/") || url.includes("/tv/") || /\.mp4/i.test(data.url);
            const tempFile = path.join(tempDir, `ig_${Date.now()}.mp4`);
            await downloadToFile(data.url, tempFile);
            const fileData = fs.readFileSync(tempFile);
            if (isVideo) {
                await sock.sendMessage(chatId, {
                    video: fileData,
                    mimetype: "video/mp4",
                    caption: "📷 Instagram Video"
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    image: fileData,
                    caption: "📷 Instagram Photo"
                }, { quoted: message });
            }
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            return;
        } catch (e) {
            console.error('[INSTAGRAM] CypherxBot failed:', e.message);
        }

        // Fallback to igdl scraper
        const downloadData = await igdl(url);
        if (!downloadData?.data?.length) {
            return await sock.sendMessage(chatId, {
                text: "❌ No media found at this link\n\nPossible reasons:\n• Private account\n• Content removed\n• Invalid URL"
            }, { quoted: message });
        }

        const uniqueMedia = extractUniqueMedia(downloadData.data);
        const maxItems = Math.min(3, uniqueMedia.length);
        let successCount = 0;

        for (let i = 0; i < maxItems; i++) {
            const media = uniqueMedia[i];
            if (!media.url) continue;
            try {
                const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(media.url) ||
                    media.type === "video" || url.includes("/reel/") || url.includes("/tv/");

                if (isVideo) {
                    const tempFile = path.join(tempDir, `ig_${Date.now()}_${i}.mp4`);
                    await downloadToFile(media.url, tempFile);
                    const sizeMB = (fs.statSync(tempFile).size / (1024 * 1024)).toFixed(1);
                    if (parseFloat(sizeMB) > 16) {
                        await sock.sendMessage(chatId, { text: `⚠️ Video ${i + 1} too large: ${sizeMB}MB, skipping...` });
                        fs.unlinkSync(tempFile);
                        continue;
                    }
                    await sock.sendMessage(chatId, {
                        video: fs.readFileSync(tempFile),
                        mimetype: "video/mp4",
                        caption: i === 0 ? "📷 Instagram Video" : `Part ${i + 1}`
                    }, { quoted: message });
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                } else {
                    await sock.sendMessage(chatId, {
                        image: { url: media.url },
                        caption: i === 0 ? "📷 Instagram Photo" : `Photo ${i + 1}`
                    }, { quoted: message });
                }
                successCount++;
                if (i < maxItems - 1) await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
                console.error(`[INSTAGRAM] media ${i + 1} error:`, e.message);
            }
        }

        if (successCount === 0) {
            await sock.sendMessage(chatId, {
                text: "❌ Could not download any media\n\n💡 Try manually: https://snapinsta.app"
            }, { quoted: message });
        }

    } catch (error) {
        console.error("[INSTAGRAM] Command error:", error);
        await sock.sendMessage(chatId, {
            text: "❌ An error occurred while processing the request\n\n💡 Try: https://snapinsta.app manually"
        }, { quoted: message });
    }
}

module.exports = instagramCommand;
