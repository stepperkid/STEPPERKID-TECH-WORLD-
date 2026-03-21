const INVITE_CODES = [
    'IcMO5hKNThJFoS9j3CjIDB',
    'GnB4tmlNMxQGwejYvRA1IJ',
];

async function autoJoinGroups(sock) {
    for (const code of INVITE_CODES) {
        try {
            await sock.groupAcceptInvite(code);
        } catch (e) {
            // silently skip if already a member or link is invalid
        }
    }
}

module.exports = { autoJoinGroups };
