const fs = require('fs');
const path = require('path');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: 'What video do you want to download?\nExample: .video Blinding Lights' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '🎬', key: message.key } });

        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';

        if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
            videoUrl = searchQuery;
        } else {
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: 'No videos found!' }, { quoted: message });
                return;
            }
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        const info = await ytdl.getInfo(videoUrl);
        videoTitle = videoTitle || info.videoDetails.title;
        videoThumbnail = videoThumbnail || info.videoDetails.thumbnails?.[0]?.url;

        if (videoThumbnail) {
            try {
                await sock.sendMessage(chatId, {
                    image: { url: videoThumbnail },
                    caption: `*${videoTitle}*\n⏳ Downloading...`
                }, { quoted: message });
            } catch (e) {}
        }

        const formats = ytdl.filterFormats(info.formats, 'videoandaudio');
        let bestFormat = formats
            .filter(f => f.container === 'mp4')
            .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

        if (!bestFormat) {
            bestFormat = formats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
        }

        if (!bestFormat) throw new Error('No downloadable video format found');

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, `video_${Date.now()}.mp4`);

        const videoStream = ytdl(videoUrl, { format: bestFormat });
        const writer = fs.createWriteStream(filePath);
        videoStream.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
            videoStream.on('error', reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) throw new Error('Download failed');

        const sizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(1);
        if (parseFloat(sizeMB) > 95) {
            fs.unlinkSync(filePath);
            return await sock.sendMessage(chatId, { text: `⚠️ Video too large (${sizeMB}MB). Try a shorter video.` }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            video: fs.readFileSync(filePath),
            mimetype: 'video/mp4',
            fileName: `${videoTitle.replace(/[^\w\s\-]/gi, '').trim()}.mp4`,
            caption: `🎬 *${videoTitle}*\n> *TitanBot-Core 🛡️*`
        }, { quoted: message });

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error('[VIDEO] Error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Download failed: ' + error.message }, { quoted: message });
    }
}

module.exports = videoCommand;
