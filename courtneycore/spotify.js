const axios = require('axios');

const FABDL_BASE = 'https://api.fabdl.com';

async function getSpotifyInfo(url) {
    const res = await axios.get(`${FABDL_BASE}/spotify/get?url=${encodeURIComponent(url)}`, { timeout: 20000 });
    if (res.data?.result) return res.data.result;
    throw new Error('Could not get Spotify track info');
}

async function convertSpotify(gid, trackId) {
    const res = await axios.get(`${FABDL_BASE}/spotify/mp3-convert-task/${gid}/${trackId}`, { timeout: 30000 });
    if (res.data?.result?.download_url) return `${FABDL_BASE}${res.data.result.download_url}`;
    throw new Error('Conversion failed or no download URL');
}

async function searchSpotify(query) {
    const res = await axios.get(`${FABDL_BASE}/spotify/search?q=${encodeURIComponent(query)}&limit=1`, { timeout: 15000 });
    const items = res.data?.result?.items;
    if (items?.length) return `https://open.spotify.com/track/${items[0].id}`;
    throw new Error('No search results found');
}

async function spotifyCommand(sock, chatId, message) {
    try {
        const rawText = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text || ''
        ).trim();

        const query = rawText.split(/\s+/).slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: '🎵 Usage: .spotify <spotify_url or song name>\nExample: .spotify Blinding Lights\nExample: .spotify https://open.spotify.com/track/...'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🎵', key: message.key } });

        let spotifyUrl = query;

        if (!query.startsWith('https://open.spotify.com/') && !query.startsWith('https://spotify.com/')) {
            await sock.sendMessage(chatId, { text: '🔍 Searching Spotify...' }, { quoted: message });
            spotifyUrl = await searchSpotify(query);
        }

        await sock.sendMessage(chatId, { text: '⏳ Fetching track info...' }, { quoted: message });

        const info = await getSpotifyInfo(spotifyUrl);
        const caption = `🎵 *${info.name}*\n👤 *${info.artists || 'Unknown'}*\n⏱ ${Math.floor((info.duration_ms || 0) / 60000)}:${String(Math.floor(((info.duration_ms || 0) % 60000) / 1000)).padStart(2, '0')}\n> *TitanBot-Core 🛡️*`;

        if (info.image) {
            try {
                await sock.sendMessage(chatId, { image: { url: info.image }, caption }, { quoted: message });
            } catch (e) {}
        }

        await sock.sendMessage(chatId, { text: '⬇️ Converting to MP3...' }, { quoted: message });

        const downloadUrl = await convertSpotify(info.gid, info.id);

        await sock.sendMessage(chatId, {
            audio: { url: downloadUrl },
            mimetype: 'audio/mpeg',
            fileName: `${(info.name || 'track').replace(/[\\/:*?"<>|]/g, '')}.mp3`
        }, { quoted: message });

    } catch (error) {
        console.error('[SPOTIFY] error:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch Spotify audio.\n' + error.message }, { quoted: message });
    }
}

module.exports = spotifyCommand;
