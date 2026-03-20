const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

/**
 * Sends detailed GitHub repository information with a banner image
 * @param {Object} sock - WhatsApp socket instance (e.g., from @whiskeysockets/baileys)
 * @param {String} chatId - Target chat ID
 * @param {Object} message - Original message object for quoting
 */
async function githubCommand(sock, chatId, message) {
  const repoUrl = 'https://api.github.com/repos/courtney250/TitanBot-Core';
  const imagePath = path.resolve('./image.jpg');

  // Check if image exists first
  if (!fs.existsSync(imagePath)) {
    return sock.sendMessage(
      chatId,
      { text: '⚠️ Bot image (image) not found in the bot directory!' },
      { quoted: message }
    );
  }

  try {
    const response = await fetch(repoUrl, {
      headers: {
        'User-Agent': 'TitanBot-Core-Bot', // Required by GitHub API
        'Accept': 'application/vnd.github.v3+json',
      },
      timeout: 10000, // 10 second timeout
    });

    // Handle rate limiting or other HTTP errors
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Try again later.');
      }
      if (response.status === 404) {
        throw new Error('Repository not found or is private.');
      }
      throw new Error(`GitHub API error: \( {response.status} \){response.statusText}`);
    }

    const data = await response.json();

    // Format the repository info beautifully
    const formatNumber = (num) => num.toLocaleString('en-US');

    const caption = `
*⚡ TitanBot-Core 🛡️ ⚡*

✨ *Repository* : \`${data.full_name}\`
⭐ *Stars* : ${formatNumber(data.stargazers_count)}
🍴 *Forks* : ${formatNumber(data.forks_count)}
👀 *Watchers* : ${formatNumber(data.watchers_count)}
📦 *Size* : ${(data.size / 1024).toFixed(2)} MB
📅 *Last Update* : ${moment(data.updated_at).tz('Asia/Jakarta').format('DD/MM/YYYY - HH:mm:ss')} (WIB)
🔗 *URL* : ${data.html_url}

> Powered by *TitanBot-Core 🛡️*
`.trim();

    const imageBuffer = fs.readFileSync(imagePath);

    await sock.sendMessage(
      chatId,
      {
        image: imageBuffer,
        caption: caption,
        mentions: message?.mentionedJid,
      },
      { quoted: message }
    );

  } catch (error) {
    console.error('GitHub Command Error:', error.message);

    let errorMsg = '❌ Failed to fetch repository information.';
    if (error.message.includes('rate limit')) errorMsg += '\nRate limit exceeded.';
    if (error.message.includes('not found')) errorMsg += '\nRepository may be private or deleted.';

    await sock.sendMessage(
      chatId,
      { text: errorMsg },
      { quoted: message }
    );
  }
}

module.exports = githubCommand;
