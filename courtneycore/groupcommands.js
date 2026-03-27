const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'groupsettings.json');

function loadSettings() {
    try {
        if (!fs.existsSync(SETTINGS_PATH)) return {};
        return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    } catch {
        return {};
    }
}

function saveSettings(data) {
    try {
        if (!fs.existsSync(path.dirname(SETTINGS_PATH))) {
            fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
        }
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to save group settings:', e.message);
    }
}

function getGroupSetting(chatId, key) {
    const settings = loadSettings();
    return settings[chatId]?.[key] ?? false;
}

function setGroupSetting(chatId, key, value) {
    const settings = loadSettings();
    if (!settings[chatId]) settings[chatId] = {};
    settings[chatId][key] = value;
    saveSettings(settings);
}

async function ensureGroupAdmin(sock, chatId, senderId, message) {
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) {
        await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        return false;
    }
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: '❌ Please make the bot an admin first.' }, { quoted: message });
        return false;
    }
    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
        return false;
    }
    return true;
}

// 1. .groupstatus — show current group open/closed status and info
async function groupStatusCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
    }
    try {
        const meta = await sock.groupMetadata(chatId);
        const isAnnouncement = meta.announce;
        const status = isAnnouncement ? '🔒 Closed (only admins can send)' : '🔓 Open (all members can send)';
        const text = `┌──「 *GROUP STATUS* 」
▢ *Name:* ${meta.subject}
▢ *Members:* ${meta.participants.length}
▢ *Admins:* ${meta.participants.filter(p => p.admin).length}
▢ *Status:* ${status}
▢ *Description:* ${meta.desc?.toString() || 'No description'}
└─────────────────`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Failed to get group status.' }, { quoted: message });
    }
}

// 2. .getgpp — fetch and send group profile picture
async function getGroupPPCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
    }
    try {
        const pp = await sock.profilePictureUrl(chatId, 'image');
        await sock.sendMessage(chatId, { image: { url: pp }, caption: '📸 Group profile picture' }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ No profile picture set for this group.' }, { quoted: message });
    }
}

// 3. .tagadmin — tag all group admins
async function tagAdminCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
    }
    try {
        const meta = await sock.groupMetadata(chatId);
        const admins = meta.participants.filter(p => p.admin);
        if (!admins.length) {
            return sock.sendMessage(chatId, { text: '❌ No admins found in this group.' }, { quoted: message });
        }
        const mentions = admins.map(a => a.id);
        const text = `👮 *Group Admins*\n\n${admins.map((a, i) => `${i + 1}. @${a.id.split('@')[0]}`).join('\n')}`;
        await sock.sendMessage(chatId, { text, mentions }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to tag admins.' }, { quoted: message });
    }
}

// 4. .open / .opengc — open group for all members
async function openGroupCommand(sock, chatId, senderId, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, { text: '🔓 Group is now *open*. All members can send messages.' }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to open group.' }, { quoted: message });
    }
}

// 5. .close / .closegc — close group to admins only
async function closeGroupCommand(sock, chatId, senderId, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    try {
        await sock.groupSettingUpdate(chatId, 'announcement');
        await sock.sendMessage(chatId, { text: '🔒 Group is now *closed*. Only admins can send messages.' }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to close group.' }, { quoted: message });
    }
}

// 6. .killall — kick all non-admin members
async function killAllCommand(sock, chatId, senderId, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    try {
        const meta = await sock.groupMetadata(chatId);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const nonAdmins = meta.participants.filter(p => !p.admin && p.id !== botId);
        if (!nonAdmins.length) {
            return sock.sendMessage(chatId, { text: '✅ No non-admin members to remove.' }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: `⚠️ Removing *${nonAdmins.length}* non-admin member(s)...` }, { quoted: message });
        for (const p of nonAdmins) {
            try { await sock.groupParticipantsUpdate(chatId, [p.id], 'remove'); } catch {}
        }
        await sock.sendMessage(chatId, { text: `✅ Done! Removed *${nonAdmins.length}* member(s).` });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to remove members.' }, { quoted: message });
    }
}

// 7. .antisticker [on/off] — toggle anti-sticker
async function antiStickerCommand(sock, chatId, senderId, userMessage, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    const args = userMessage.split(' ');
    const action = args[1]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
        return sock.sendMessage(chatId, { text: 'Usage: *.antisticker on* or *.antisticker off*' }, { quoted: message });
    }
    setGroupSetting(chatId, 'antisticker', action === 'on');
    await sock.sendMessage(chatId, {
        text: action === 'on' ? '🚫 Anti-sticker is now *ON*. Stickers will be deleted.' : '✅ Anti-sticker is now *OFF*.'
    }, { quoted: message });
}

// 8. .antiphoto [on/off] — toggle anti-photo
async function antiPhotoCommand(sock, chatId, senderId, userMessage, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    const args = userMessage.split(' ');
    const action = args[1]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
        return sock.sendMessage(chatId, { text: 'Usage: *.antiphoto on* or *.antiphoto off*' }, { quoted: message });
    }
    setGroupSetting(chatId, 'antiphoto', action === 'on');
    await sock.sendMessage(chatId, {
        text: action === 'on' ? '🚫 Anti-photo is now *ON*. Images will be deleted.' : '✅ Anti-photo is now *OFF*.'
    }, { quoted: message });
}

// 9. .antipromote [on/off] — detect unauthorized promotions
async function antiPromoteCommand(sock, chatId, senderId, userMessage, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    const args = userMessage.split(' ');
    const action = args[1]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
        return sock.sendMessage(chatId, { text: 'Usage: *.antipromote on* or *.antipromote off*' }, { quoted: message });
    }
    setGroupSetting(chatId, 'antipromote', action === 'on');
    await sock.sendMessage(chatId, {
        text: action === 'on' ? '🚫 Anti-promote is now *ON*. Unauthorized promotions will be reversed.' : '✅ Anti-promote is now *OFF*.'
    }, { quoted: message });
}

// 10. .antidemote [on/off] — detect unauthorized demotions
async function antiDemoteCommand(sock, chatId, senderId, userMessage, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    const args = userMessage.split(' ');
    const action = args[1]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
        return sock.sendMessage(chatId, { text: 'Usage: *.antidemote on* or *.antidemote off*' }, { quoted: message });
    }
    setGroupSetting(chatId, 'antidemote', action === 'on');
    await sock.sendMessage(chatId, {
        text: action === 'on' ? '🚫 Anti-demote is now *ON*. Unauthorized demotions will be reversed.' : '✅ Anti-demote is now *OFF*.'
    }, { quoted: message });
}

// 11. .antigroupmention [on/off] — block @everyone mentions
async function antiGroupMentionCommand(sock, chatId, senderId, userMessage, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    const args = userMessage.split(' ');
    const action = args[1]?.toLowerCase();
    if (!action || !['on', 'off'].includes(action)) {
        return sock.sendMessage(chatId, { text: 'Usage: *.antigroupmention on* or *.antigroupmention off*' }, { quoted: message });
    }
    setGroupSetting(chatId, 'antigroupmention', action === 'on');
    await sock.sendMessage(chatId, {
        text: action === 'on' ? '🚫 Anti-group-mention is now *ON*.' : '✅ Anti-group-mention is now *OFF*.'
    }, { quoted: message });
}

// 12. .link / .grouplink — get group invite link
async function groupLinkCommand(sock, chatId, senderId, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    try {
        const code = await sock.groupInviteCode(chatId);
        await sock.sendMessage(chatId, {
            text: `🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to get invite link.' }, { quoted: message });
    }
}

// 13. .creategroup — create a new group
async function createGroupCommand(sock, chatId, senderId, userMessage, message) {
    const parts = userMessage.split(' ');
    parts.shift();
    const groupName = parts.join(' ').trim();
    if (!groupName) {
        return sock.sendMessage(chatId, { text: 'Usage: *.creategroup <group name>*' }, { quoted: message });
    }
    try {
        const created = await sock.groupCreate(groupName, [senderId]);
        await sock.sendMessage(chatId, { text: `✅ Group *${groupName}* created successfully!` }, { quoted: message });
        const inviteCode = await sock.groupInviteCode(created.id);
        await sock.sendMessage(chatId, {
            text: `🔗 Invite link: https://chat.whatsapp.com/${inviteCode}`
        }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: `❌ Failed to create group: ${e.message}` }, { quoted: message });
    }
}

// 14. .approveall — approve all pending join requests
async function approveAllCommand(sock, chatId, senderId, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    try {
        const requests = await sock.groupRequestParticipantsList(chatId);
        if (!requests || !requests.length) {
            return sock.sendMessage(chatId, { text: '✅ No pending join requests.' }, { quoted: message });
        }
        const ids = requests.map(r => r.jid);
        await sock.groupRequestParticipantsUpdate(chatId, ids, 'approve');
        await sock.sendMessage(chatId, { text: `✅ Approved *${ids.length}* pending request(s).` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to approve requests. Make sure the group uses approval mode.' }, { quoted: message });
    }
}

// 15. .rejectall — reject all pending join requests
async function rejectAllCommand(sock, chatId, senderId, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    try {
        const requests = await sock.groupRequestParticipantsList(chatId);
        if (!requests || !requests.length) {
            return sock.sendMessage(chatId, { text: '✅ No pending join requests.' }, { quoted: message });
        }
        const ids = requests.map(r => r.jid);
        await sock.groupRequestParticipantsUpdate(chatId, ids, 'reject');
        await sock.sendMessage(chatId, { text: `🚫 Rejected *${ids.length}* pending request(s).` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to reject requests. Make sure the group uses approval mode.' }, { quoted: message });
    }
}

// 16. .pendingrequests — list all pending join requests
async function pendingRequestsCommand(sock, chatId, senderId, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    try {
        const requests = await sock.groupRequestParticipantsList(chatId);
        if (!requests || !requests.length) {
            return sock.sendMessage(chatId, { text: '✅ No pending join requests.' }, { quoted: message });
        }
        const list = requests.map((r, i) => `${i + 1}. +${r.jid.split('@')[0]}`).join('\n');
        await sock.sendMessage(chatId, {
            text: `📋 *Pending Join Requests* (${requests.length})\n\n${list}`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to get pending requests.' }, { quoted: message });
    }
}

// 17. .muteall — mute all non-admin members (close group)
async function muteAllCommand(sock, chatId, senderId, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    try {
        await sock.groupSettingUpdate(chatId, 'announcement');
        await sock.sendMessage(chatId, { text: '🔇 All members have been *muted*. Only admins can send messages.' }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to mute members.' }, { quoted: message });
    }
}

// 18. .unmuteall — unmute all members (open group)
async function unmuteAllCommand(sock, chatId, senderId, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, { text: '🔊 All members have been *unmuted*. Everyone can send messages.' }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to unmute members.' }, { quoted: message });
    }
}

// 19. .addmember — add a member by phone number
async function addMemberCommand(sock, chatId, senderId, userMessage, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    const parts = userMessage.split(' ');
    const phone = parts[1]?.replace(/[^0-9]/g, '');
    if (!phone) {
        return sock.sendMessage(chatId, { text: 'Usage: *.addmember <phone number>*\nExample: .addmember 2348012345678' }, { quoted: message });
    }
    const jid = `${phone}@s.whatsapp.net`;
    try {
        await sock.groupParticipantsUpdate(chatId, [jid], 'add');
        await sock.sendMessage(chatId, { text: `✅ Added *+${phone}* to the group.` }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: `❌ Failed to add member. They may not be on WhatsApp or the number is wrong.` }, { quoted: message });
    }
}

// 20. .groupsize — show total number of members
async function groupSizeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
    }
    try {
        const meta = await sock.groupMetadata(chatId);
        const total = meta.participants.length;
        const admins = meta.participants.filter(p => p.admin).length;
        const members = total - admins;
        await sock.sendMessage(chatId, {
            text: `👥 *Group Size*\n\n• Total: *${total}*\n• Admins: *${admins}*\n• Members: *${members}*`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to get group size.' }, { quoted: message });
    }
}

// 21. .getgdesc — get group description
async function getGroupDescCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
    }
    try {
        const meta = await sock.groupMetadata(chatId);
        const desc = meta.desc?.toString() || 'No description set.';
        await sock.sendMessage(chatId, { text: `📌 *Group Description*\n\n${desc}` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to get group description.' }, { quoted: message });
    }
}

// 22. .kickbots — kick all bot participants from the group
async function kickBotsCommand(sock, chatId, senderId, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    try {
        const meta = await sock.groupMetadata(chatId);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const onlineCheck = async (jid) => {
            try {
                const status = await sock.fetchStatus(jid);
                return status?.status === null || status?.status === undefined;
            } catch {
                return false;
            }
        };
        const bots = meta.participants.filter(p => {
            const num = p.id.split('@')[0];
            return p.id !== botId && (num.length > 13 || num.startsWith('0') === false && num.length < 5);
        });
        if (!bots.length) {
            return sock.sendMessage(chatId, { text: '✅ No bots detected in this group.' }, { quoted: message });
        }
        for (const b of bots) {
            try { await sock.groupParticipantsUpdate(chatId, [b.id], 'remove'); } catch {}
        }
        await sock.sendMessage(chatId, { text: `✅ Removed *${bots.length}* suspected bot(s).` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to kick bots.' }, { quoted: message });
    }
}

// 23. .locksettings / .unlockettings — lock/unlock group settings to admins only
async function lockSettingsCommand(sock, chatId, senderId, userMessage, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    const lock = userMessage.startsWith('.locksettings');
    try {
        await sock.groupSettingUpdate(chatId, lock ? 'locked' : 'unlocked');
        await sock.sendMessage(chatId, {
            text: lock ? '🔒 Group settings are now *locked* to admins only.' : '🔓 Group settings are now *unlocked*.'
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to update group settings lock.' }, { quoted: message });
    }
}

// 24. .promote (tagadmin alias to promote specific user) — already exists, this adds .tagall alias
async function mentionAllCommand(sock, chatId, userMessage, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
    }
    try {
        const meta = await sock.groupMetadata(chatId);
        const members = meta.participants;
        const mentions = members.map(m => m.id);
        const text = `📢 *Attention Everyone!*\n\n${members.map((m, i) => `${i + 1}. @${m.id.split('@')[0]}`).join('\n')}`;
        await sock.sendMessage(chatId, { text, mentions }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to mention all members.' }, { quoted: message });
    }
}

// 25. .groupannounce <text> — send an announcement to the group
async function groupAnnounceCommand(sock, chatId, senderId, userMessage, message) {
    if (!(await ensureGroupAdmin(sock, chatId, senderId, message))) return;
    const parts = userMessage.split(' ');
    parts.shift();
    const text = parts.join(' ').trim();
    if (!text) {
        return sock.sendMessage(chatId, { text: 'Usage: *.groupannounce <your message>*' }, { quoted: message });
    }
    try {
        const meta = await sock.groupMetadata(chatId);
        await sock.sendMessage(chatId, {
            text: `📢 *ANNOUNCEMENT*\n\n${text}\n\n— *${meta.subject}* Admin`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Failed to send announcement.' }, { quoted: message });
    }
}

// ── Message detection handlers ──

async function handleAntiStickerDetection(sock, chatId, message) {
    if (!getGroupSetting(chatId, 'antisticker')) return;
    const msg = message.message;
    if (!msg?.stickerMessage) return;
    try {
        await sock.sendMessage(chatId, { delete: message.key });
    } catch {}
}

async function handleAntiPhotoDetection(sock, chatId, message, senderId) {
    if (!getGroupSetting(chatId, 'antiphoto')) return;
    const msg = message.message;
    if (!msg?.imageMessage) return;
    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    if (isSenderAdmin) return;
    try {
        await sock.sendMessage(chatId, { delete: message.key });
        await sock.sendMessage(chatId, { text: `@${senderId.split('@')[0]} Photos are not allowed in this group.`, mentions: [senderId] });
    } catch {}
}

async function handleAntiGroupMentionDetection(sock, chatId, message, senderId) {
    if (!getGroupSetting(chatId, 'antigroupmention')) return;
    const msg = message.message;
    const text = msg?.extendedTextMessage?.text || msg?.conversation || '';
    if (!text.includes('@everyone') && !text.includes('@all')) return;
    const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
    if (isSenderAdmin) return;
    try {
        await sock.sendMessage(chatId, { delete: message.key });
        await sock.sendMessage(chatId, { text: `@${senderId.split('@')[0]} Group mentions are not allowed.`, mentions: [senderId] });
    } catch {}
}

async function handleAntiPromoteDetection(sock, groupId, participants, action) {
    if (!getGroupSetting(groupId, 'antipromote')) return;
    if (action !== 'promote') return;
    try {
        await sock.groupParticipantsUpdate(groupId, participants, 'demote');
        await sock.sendMessage(groupId, { text: `⚠️ Unauthorized promotion detected and reversed for: @${participants.map(p => p.split('@')[0]).join(', @')}`, mentions: participants });
    } catch {}
}

async function handleAntiDemoteDetection(sock, groupId, participants, action) {
    if (!getGroupSetting(groupId, 'antidemote')) return;
    if (action !== 'demote') return;
    try {
        await sock.groupParticipantsUpdate(groupId, participants, 'promote');
        await sock.sendMessage(groupId, { text: `⚠️ Unauthorized demotion detected and reversed for: @${participants.map(p => p.split('@')[0]).join(', @')}`, mentions: participants });
    } catch {}
}

module.exports = {
    groupStatusCommand,
    getGroupPPCommand,
    tagAdminCommand,
    openGroupCommand,
    closeGroupCommand,
    killAllCommand,
    antiStickerCommand,
    antiPhotoCommand,
    antiPromoteCommand,
    antiDemoteCommand,
    antiGroupMentionCommand,
    groupLinkCommand,
    createGroupCommand,
    approveAllCommand,
    rejectAllCommand,
    pendingRequestsCommand,
    muteAllCommand,
    unmuteAllCommand,
    addMemberCommand,
    groupSizeCommand,
    getGroupDescCommand,
    kickBotsCommand,
    lockSettingsCommand,
    mentionAllCommand,
    groupAnnounceCommand,
    handleAntiStickerDetection,
    handleAntiPhotoDetection,
    handleAntiGroupMentionDetection,
    handleAntiPromoteDetection,
    handleAntiDemoteDetection,
};
