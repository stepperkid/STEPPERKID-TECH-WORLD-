const { igdl } = require("ruhend-scraper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const processedMessages = new Set();

function extractUniqueMedia(mediaData) {
    const uniqueMedia = [];
    const seenUrls = new Set();
    for (const media of mediaData) {
        if (!media.url) continue;
        if (!seenUrls.has(media.url)) {
            seenUrls.add(media.url);
            uniqueMedia.push(media);
        }
    }
    return uniqueMedia;
}

async function downloadToFile(url, filePath) {
    const writer = fs.createWriteStream(filePath);
    const response = await axios({
        method: "GET",
        url: url,
        responseType: "stream",
        timeout: 45000,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.instagram.com/",
            "Accept": "video/mp4,video/*,image/*,*/*;q=0.8"
        }
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", (err) => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            reject(err);
        });
        response.data.on("error", (err) => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            reject(err);
        });
    });
}

async function instagramCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) {
            return;
        }
        processedMessages.add(message.key.id);
        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, {
                text: "📷 *Instagram Downloader*\n\n💡 *Usage:*\n• .instagram <url>\n\n📌 *Examples:*\n• .instagram https://instagram.com/reel/xyz\n• .instagram https://instagram.com/p/xyz\n• .instagram https://instagram.com/tv/xyz"
            }, { quoted: message });
        }

        const urlMatch = text.match(/https?:\/\/[^\s<>"']+/);
        const url = urlMatch ? urlMatch[0].replace(/[.,;!?)]+$/, "") : "";

        const instagramPatterns = [
            /https?:\/\/(?:www\.)?instagram\.com\//,
            /https?:\/\/(?:www\.)?instagr\.am\//,
            /https?:\/\/(?:www\.)?instagram\.com\/p\//,
            /https?:\/\/(?:www\.)?instagram\.com\/reel\//,
            /https?:\/\/(?:www\.)?instagram\.com\/tv\//
        ];

        const isValidUrl = instagramPatterns.some(pattern => pattern.test(url));

        if (!isValidUrl) {
            return await sock.sendMessage(chatId, {
                text: "❌ Not a valid Instagram link\n\nProvide: instagram.com/p/... or instagram.com/reel/..."
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: "📥 *Downloading from Instagram...*"
        }, { quoted: message });

        const downloadData = await igdl(url);

        if (!downloadData || !downloadData.data || downloadData.data.length === 0) {
            return await sock.sendMessage(chatId, {
                text: "❌ No media found at this link\n\nPossible reasons:\n• Private account\n• Content removed\n• Invalid URL"
            }, { quoted: message });
        }

        const uniqueMedia = extractUniqueMedia(downloadData.data);
        const maxItems = Math.min(3, uniqueMedia.length);
        let successCount = 0;

        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        for (let i = 0; i < maxItems; i++) {
            const media = uniqueMedia[i];
            const mediaUrl = media.url;
            if (!mediaUrl) continue;

            try {
                const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl) ||
                    media.type === "video" ||
                    url.includes("/reel/") ||
                    url.includes("/tv/");

                if (isVideo) {
                    const tempFile = path.join(tempDir, `ig_${Date.now()}_${i}.mp4`);
                    await downloadToFile(mediaUrl, tempFile);

                    const fileSize = fs.statSync(tempFile).size;
                    const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);

                    if (parseFloat(sizeMB) > 16) {
                        await sock.sendMessage(chatId, {
                            text: `⚠️ Video ${i + 1} too large: ${sizeMB}MB\nSkipping...`
                        });
                        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                        continue;
                    }

                    const videoData = fs.readFileSync(tempFile);
                    await sock.sendMessage(chatId, {
                        video: videoData,
                        mimetype: "video/mp4",
                        caption: i === 0 ? "📷 Instagram Video" : `Part ${i + 1}`
                    }, { quoted: message });

                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                } else {
                    await sock.sendMessage(chatId, {
                        image: { url: mediaUrl },
                        caption: i === 0 ? "📷 Instagram Photo" : `Photo ${i + 1}`
                    }, { quoted: message });
                }

                successCount++;

                if (i < maxItems - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (mediaError) {
                console.error(`📷 [INSTAGRAM] Error sending media ${i + 1}:`, mediaError.message);
                continue;
            }
        }

        if (successCount === 0) {
            await sock.sendMessage(chatId, {
                text: "❌ Could not download any media\n\n💡 Try manually: https://snapinsta.app"
            }, { quoted: message });
        }

    } catch (error) {
        console.error("📷 [INSTAGRAM] Command error:", error);

        let errorMsg = "❌ An error occurred while processing the request";
        if (error.message && error.message.includes("timeout")) {
            errorMsg += "\n⏱ Request timed out";
        } else if (error.message && error.message.includes("ENOTFOUND")) {
            errorMsg += "\n🌐 Network error";
        } else if (error.message && error.message.includes("scraper")) {
            errorMsg += "\n🔧 Scraper failed";
        }
        errorMsg += "\n\n💡 Try: https://snapinsta.app manually";

        await sock.sendMessage(chatId, {
            text: errorMsg
        }, { quoted: message });
    }
}

module.exports = instagramCommand;
