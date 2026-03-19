const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome } = require('../lib/index');
const { channelInfo } = require('../lib/messageConfig');

async function welcomeCommand(sock, chatId, message, match) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
        return;
    }

    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleWelcome(sock, chatId, message, matchText);
}

async function handleJoinEvent(sock, id, participants) {
    const isWelcomeEnabled = await isWelcomeOn(id);
    if (!isWelcomeEnabled) return;

    const customMessage = await getWelcome(id);
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc?.toString() || 'No description available';

    for (const participant of participants) {
        try {
            const participantString = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const userNumber = participantString.split('@')[0];

            // Get display name
            let displayName = userNumber;
            try {
                const groupParticipant = groupMetadata.participants.find(p => p.id === participantString);
                if (groupParticipant?.name) displayName = groupParticipant.name;
            } catch (e) { console.log('Name fetch minor error'); }

            // Default or custom message
            let finalMessage = customMessage || `╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @\( {displayName} 👋\n┃Member count: # \){groupMetadata.participants.length}\n┃𝚃𝙸𝙼𝙴: \( {new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}⏰\n╰━━━━━━━━━━━━━━━╯\n\n*@ \){displayName}* Welcome to *\( {groupName}*! 🎉\n*Group 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽*\n \){groupDesc}\n\n> *STEPPERKID-TECH-WORLD*`;

            finalMessage = finalMessage
                .replace(/{user}/g, `@${displayName}`)
                .replace(/{group}/g, groupName)
                .replace(/{description}/g, groupDesc);

            // Try to get profile picture
            let profilePicUrl = null;
            try {
                profilePicUrl = await sock.profilePictureUrl(participantString, 'image');
            } catch (e) {
                console.log('No profile picture found, using background only');
            }

            // Send with background image + optional avatar overlay
            await sock.sendMessage(id, {
                image: { url: './welcome.jpg' }, // Your beautiful gaming background
                caption: finalMessage,
                mentions: [participantString],
                ...(profilePicUrl ? { mentionedJid: [participantString], contextInfo: { mentionedJid: [participantString] } } : {}),
                // Optional: Add avatar as thumbnail or sticker if you want more advanced
                ...channelInfo
            });

        } catch (error) {
            console.error('Error in welcome:', error);
            // Ultimate fallback
            await sock.sendMessage(id, {
                text: `Welcome @\( {userNumber} to \){groupName}! 🎉`,
                mentions: [participantString],
                ...channelInfo
            });
        }
    }
}

module.exports = { welcomeCommand, handleJoinEvent };