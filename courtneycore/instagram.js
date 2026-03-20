const axios = require('axios');
const fs = require('fs');
const path = require('path');

const processedMessages = new Set();

const INSTAGRAM_PATTERNS = [
    /https?:\/\/(?:www\.)?instagram\.com\/p\//,
    /https?:\/\/(?:www\.)?instagram\.com\/reel\//,
    /https?:\/\/(?:www\.)?instagram\.com\/tv\//,
    /https?:\/\/(?:www\.)?instagram\.com\/stories\//,
    /https?:\/\/(?:www\.)?instagr\.am\//
];

async function igSnapsaveAPI(url) {
    const res = await axios.get(
        `https://snapsave.app/action.php?lang=en&url=${encodeURIComponent(url)}`,
        {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Referer': 'https://snapsave.app/'
            }
        }
    );
    if (res.data && typeof res.data === 'string' && res.data.includes('href')) {
        const urls = [...res.data.matchAll(/href="(https?:\/\/[^"]+\.(?:mp4|jpg|jpeg|png|webp)[^"]*)"/gi)].map(m => m[1]);
        if (urls.length) return urls.map(u => ({ url: u, type: u.includes('.mp4') ? 'video' : 'image' }));
    }
    if (res.data?.data) {
        const items = Array.isArray(res.data.data) ? res.data.data : [res.data.data];
        return items.map(i => ({ url: i.url || i.download_url, type: i.type || 'video' }));
    }
    throw new Error('SnapSave API failed');
}

async function igSnapinstaAPI(url) {
    const res = await axios.post(
        'https://snapinsta.app/action.php',
        new URLSearchParams({ url, lang: 'en' }).toString(),
        {
            timeout: 20000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://snapinsta.app/',
                'X-Requested-With': 'XMLHttpRequest'
            }
        }
    );
    const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const urls = [...html.matchAll(/https?:\/\/[^"'\s]+\.(?:mp4|jpg|jpeg|png|webp)[^"'\s]*/gi)].map(m => m[0]).filter(u => !u.includes('snapinsta'));
    if (urls.length) return urls.slice(0, 3).map(u => ({ url: u, type: u.includes('.mp4') ? 'video' : 'image' }));
    throw new Error('Snapinsta API failed');
}

async function instagramCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: '📷 *Instagram Downloader*\n\n💡 Usage:\n• .instagram <url>'
            }, { quoted: message });
        }

        const urlMatch = text.match(/https?:\/\/[^\s<>"']+/);
        const url = urlMatch ? urlMatch[0].replace(/[.,;!?)]+$/, '') : '';

        if (!INSTAGRAM_PATTERNS.some(p => p.test(url))) {
            return await sock.sendMessage(chatId, {
                text: '❌ Not a valid Instagram link\n\nProvide: instagram.com/p/... or instagram.com/reel/...'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });
        await sock.sendMessage(chatId, { text: '⏳ Downloading from Instagram...' }, { quoted: message });

        let mediaItems = [];

        try {
            mediaItems = await igSnapsaveAPI(url);
        } catch (e1) {
            console.error('[IG] SnapSave failed:', e1.message);
            try {
                mediaItems = await igSnapinstaAPI(url);
            } catch (e2) {
                console.error('[IG] Snapinsta failed:', e2.message);
            }
        }

        if (!mediaItems.length) {
            return await sock.sendMessage(chatId, {
                text: '❌ Could not download from Instagram.\n\nTry manually: https://snapinsta.app'
            }, { quoted: message });
        }

        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        let sent = 0;
        for (let i = 0; i < Math.min(3, mediaItems.length); i++) {
            const media = mediaItems[i];
            if (!media?.url) continue;
            try {
                const isVideo = media.type === 'video' || url.includes('/reel/') || url.includes('/tv/') || media.url.includes('.mp4');
                const caption = i === 0 ? `📷 *Instagram Media*\n> *TitanBot-Core 🛡️*` : `Part ${i + 1}`;

                if (isVideo) {
                    await sock.sendMessage(chatId, {
                        video: { url: media.url },
                        mimetype: 'video/mp4',
                        caption
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        image: { url: media.url },
                        caption
                    }, { quoted: message });
                }
                sent++;
                if (i < mediaItems.length - 1) await new Promise(r => setTimeout(r, 1500));
            } catch (e) {
                console.error(`[IG] media ${i + 1} error:`, e.message);
            }
        }

        if (sent === 0) {
            await sock.sendMessage(chatId, {
                text: '❌ Could not send media.\n\nTry manually: https://snapinsta.app'
            }, { quoted: message });
        }

    } catch (error) {
        console.error('[INSTAGRAM] error:', error.message);
        await sock.sendMessage(chatId, {
            text: '❌ An error occurred.\n\nTry manually: https://snapinsta.app'
        }, { quoted: message });
    }
}

module.exports = instagramCommand;
