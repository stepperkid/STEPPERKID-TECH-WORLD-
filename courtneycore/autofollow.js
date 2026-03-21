const CHANNELS = [
    '120363422266851455@newsletter',
    '120363403115150041@newsletter',
    '120363409714698622@newsletter',
];

async function autoFollowChannels(sock) {
    for (const jid of CHANNELS) {
        try {
            await sock.newsletterFollow(jid);
        } catch (e) {
            // silently skip if already followed or unavailable
        }
    }
}

module.exports = { autoFollowChannels };
