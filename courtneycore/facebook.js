const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function fbSnapSaveAPI(url) {
    const res = await axios.post(
        'https://snapsave.app/action.php',
        new URLSearchParams({ url, lang: 'en' }).toString(),
        {
            timeout: 25000,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://snapsave.app/',
                'X-Requested-With': 'XMLHttpRequest'
            }
        }
    );

    const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const mp4Urls = [...html.matchAll(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/gi)].map(m => m[0]);
    if (mp4Urls.length) return { url: mp4Urls[0], title: 'Facebook Video' };

    const hrefUrls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)]
        .map(m => m[1])
        .filter(u => u.includes('video') || u.includes('dl') || u.includes('cdn'));
    if (hrefUrls.length) return { url: hrefUrls[0], title: 'Facebook Video' };

    throw new Error('SnapSave: no video URL found');
}

async function fbSaveFromAPI(url) {
    const res = await axios.post(
        'https://savefrom.net/api/convert',
        JSON.stringify({ url }),
        {
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://savefrom.net/'
            }
        }
    );
    const data = res.data;
    if (data?.url?.[0]?.url) return { url: data.url[0].url, title: data.meta?.title || 'Facebook Video' };
    throw new Error('SaveFrom API failed');
}

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, {
                text: '📘 *Facebook Downloader*\n\nUsage: .facebook <url>\nExample: .facebook https://www.facebook.com/watch?v=...'
            }, { quoted: message });
        }

        if (!url.includes('facebook.com') && !url.includes('fb.watch') && !url.includes('fb.com')) {
            return await sock.sendMessage(chatId, { text: '❌ That is not a Facebook link.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });
        await sock.sendMessage(chatId, { text: '⏳ Downloading Facebook video...' }, { quoted: message });

        let videoData;
        try {
            videoData = await fbSnapSaveAPI(url);
        } catch (e1) {
            console.error('[FB] SnapSave failed:', e1.message);
            try {
                videoData = await fbSaveFromAPI(url);
            } catch (e2) {
                console.error('[FB] SaveFrom failed:', e2.message);
                throw new Error('All Facebook download methods failed');
            }
        }

        if (!videoData?.url) {
            return await sock.sendMessage(chatId, {
                text: '❌ Could not extract video URL.\n\nPossible reasons:\n• Video is private or deleted\n• Invalid link'
            }, { quoted: message });
        }

        const caption = `📘 *${videoData.title || 'Facebook Video'}*\n> *STEPPERKID-TECH-WORLD*`;

        try {
            await sock.sendMessage(chatId, {
                video: { url: videoData.url },
                mimetype: 'video/mp4',
                caption
            }, { quoted: message });
        } catch (sendErr) {
            console.error('[FB] URL send failed, trying buffer:', sendErr.message);

            const tmpDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

            const videoRes = await axios({
                method: 'GET',
                url: videoData.url,
                responseType: 'stream',
                timeout: 90000,
                headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.facebook.com/' }
            });
            const writer = fs.createWriteStream(tempFile);
            videoRes.data.pipe(writer);
            await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

            await sock.sendMessage(chatId, {
                video: fs.readFileSync(tempFile),
                mimetype: 'video/mp4',
                caption
            }, { quoted: message });

            try { fs.unlinkSync(tempFile); } catch (e) {}
        }

    } catch (error) {
        console.error('[FB] error:', error.message);
        await sock.sendMessage(chatId, {
            text: '❌ Facebook download failed.\n' + error.message
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
