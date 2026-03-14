const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');
const fetch = require('node-fetch');

async function songCommand(sock, chatId, message) {
    try { 
        await sock.sendMessage(chatId, {
            react: { text: '🕳️', key: message.key }
        });         

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: '🎵 Provide a song name!\nExample:.song Not Like Us' 
            }, { quoted: message });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, { 
                text: `Song name too long! Max 100 chars.` 
            }, { quoted: message });
        }

        const searchResult = await (await yts(`${query} official`)).videos[0];
        if (!searchResult) {
            return sock.sendMessage(chatId, { 
                text: "Am sorry couldn't find that song try YouTube..!" 
            }, { quoted: message });
        }

        const video = searchResult;
        const apiUrl = `https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(video.url)}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.status || !apiData.result) throw new Error("API failed to fetch track!");

        // Send the audio directly with title as caption - quoted with original message
        await sock.sendMessage(chatId, {
            audio: { url: apiData.result },
            mimetype: "audio/mpeg",
            fileName: `${video.title}.mp3`,
            caption: `🎶 *${apiData.title || video.title}*`
        }, { quoted: message });

    } catch (error) {
        console.error("Song command error:", error);
        return await sock.sendMessage(chatId, { 
            text: `🚫 Error: ${error.message}` 
        }, { quoted: message });
    }
}

module.exports = songCommand;