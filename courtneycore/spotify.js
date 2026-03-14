const axios = require('axios');

const CYPHERX_BASE = 'https://media.cypherxbot.space';

async function cypherxSpotify(spotifyUrl) {
    const res = await axios.get(`${CYPHERX_BASE}/download/spotify/audio?url=${encodeURIComponent(spotifyUrl)}`, {
        timeout: 30000,
        headers: { 'accept': 'application/json' }
    });
    if (res.data?.success && res.data?.result?.download_url) {
        return { url: res.data.result.download_url, title: res.data.result.title };
    }
    throw new Error('CypherxBot Spotify API failed');
}

async function spotifyCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() || '';

        const used = (rawText || '').split(/\s+/)[0] || '.spotify';
        const query = rawText.slice(used.length).trim();

        if (!query) {
            await sock.sendMessage(chatId, {
                text: 'Usage: .spotify <spotify_url or song/artist keywords>\nExample: .spotify https://open.spotify.com/track/...\nExample: .spotify con calma'
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: '🎵', key: message.key } });

        // If a direct Spotify URL is provided, use CypherxBot directly
        const isSpotifyUrl = query.startsWith('https://open.spotify.com/') || query.startsWith('https://spotify.com/');

        if (isSpotifyUrl) {
            try {
                const data = await cypherxSpotify(query);
                await sock.sendMessage(chatId, {
                    audio: { url: data.url },
                    mimetype: 'audio/mpeg',
                    fileName: `${(data.title || 'track').replace(/[\\/:*?"<>|]/g, '')}.mp3`,
                    caption: `🎵 *${data.title || 'Spotify Track'}*`
                }, { quoted: message });
                return;
            } catch (e) {
                console.error('[SPOTIFY] CypherxBot direct URL failed:', e.message);
            }
        }

        // Search via Okatsu API then pass URL to CypherxBot
        const { data } = await axios.get(`https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(query)}`, {
            timeout: 20000, headers: { 'user-agent': 'Mozilla/5.0' }
        });

        if (!data?.status || !data?.result) throw new Error('No result from Spotify search API');

        const r = data.result;

        // Try CypherxBot with the Spotify URL if available
        if (r.url) {
            try {
                const cypherData = await cypherxSpotify(r.url);
                const caption = `🎵 ${r.title || r.name || 'Unknown Title'}\n👤 ${r.artist || ''}\n⏱ ${r.duration || ''}`.trim();
                if (r.thumbnails) {
                    await sock.sendMessage(chatId, { image: { url: r.thumbnails }, caption }, { quoted: message });
                }
                await sock.sendMessage(chatId, {
                    audio: { url: cypherData.url },
                    mimetype: 'audio/mpeg',
                    fileName: `${(cypherData.title || r.title || r.name || 'track').replace(/[\\/:*?"<>|]/g, '')}.mp3`
                }, { quoted: message });
                return;
            } catch (e) {
                console.error('[SPOTIFY] CypherxBot with search URL failed:', e.message);
            }
        }

        // Fallback to direct audio URL from search API
        const audioUrl = r.audio;
        if (!audioUrl) {
            await sock.sendMessage(chatId, { text: 'No downloadable audio found for this query.' }, { quoted: message });
            return;
        }

        const caption = `🎵 ${r.title || r.name || 'Unknown Title'}\n👤 ${r.artist || ''}\n⏱ ${r.duration || ''}\n🔗 ${r.url || ''}`.trim();
        if (r.thumbnails) {
            await sock.sendMessage(chatId, { image: { url: r.thumbnails }, caption }, { quoted: message });
        } else if (caption) {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${(r.title || r.name || 'track').replace(/[\\/:*?"<>|]/g, '')}.mp3`
        }, { quoted: message });

    } catch (error) {
        console.error('[SPOTIFY] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'Failed to fetch Spotify audio. Try another query later.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;
