const fs = require("fs");
const axios = require('axios');
const path = require('path');

async function gitcloneCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            react: { text: '📥', key: message.key }
        });

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) return await sock.sendMessage(chatId, {
            text: '🔗 Provide a GitHub repository URL!\nExample: .gitclone https://github.com/vinpink2/repo...'
        }, { quoted: message });

        if (!query.includes('github.com')) return await sock.sendMessage(chatId, {
            text: '❌ Not a valid GitHub link!'
        }, { quoted: message });

        // Extract GitHub username and repository name
        const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
        let [, user, repo] = query.match(regex) || [];

        if (!user || !repo) return await sock.sendMessage(chatId, {
            text: '⚠️ Invalid repository format. Use: https://github.com/username/repo...'
        }, { quoted: message });

        repo = repo.replace(/.git$/, '');
        const zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball`;

        // Get filename from GitHub API response
        const head = await axios.head(zipUrl);
        const contentDisp = head.headers['content-disposition'];
        const filenameMatch = contentDisp?.match(/attachment; filename=(.*)/);
        const filename = filenameMatch ? filenameMatch[1] : `${repo}.zip`;

        // Send the ZIP file
        await sock.sendMessage(chatId, {
            document: { url: zipUrl },
            fileName: `${repo}-main.zip`,
            mimetype: 'application/zip',
            caption: ``
        }, { quoted: message });

    } catch (error) {
        console.error("Gitclone command error:", error);
        
        let errorMessage = `🚫 Error: ${error.message}`;
        if (error.response?.status === 404) {
            errorMessage = "❌ Repository not found! Check the URL.";
        } else if (error.response?.status === 403) {
            errorMessage = "⏳ GitHub API rate limit exceeded. Try again later.";
        }

        return await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
