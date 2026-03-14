const fs = require("fs");
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');
const fetch = require('node-fetch');

async function playCommand(sock, chatId, message) {
    try { 
        await sock.sendMessage(chatId, {
            react: { text: '🎵', key: message.key }
        });         

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: '🎵 Provide a song name!\nExample:.play Not Like Us' 
            }, { quoted: message });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, { 
                text: `📝 Song name too long! Max 100 chars.` 
            }, { quoted: message });
        }

        const searchResult = await (await yts(`${query} official`)).videos[0];
        if (!searchResult) {
            return sock.sendMessage(chatId, { 
                text: "😕 Couldn't find that song. Try another one!" 
            }, { quoted: message });
        }

        const video = searchResult;
        const apiUrl = `https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(video.url)}`;
        const response = await axios.get(apiUrl);
        const apiData = response.data;

        if (!apiData.status || !apiData.result) throw new Error("API failed to fetch track!");

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download MP3
        const audioResponse = await axios({ 
            method: "get", 
            url: apiData.result, 
            responseType: "stream", 
            timeout: 600000 
        });
        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);
        await new Promise((resolve, reject) => { 
            writer.on("finish", resolve); 
            writer.on("error", reject); 
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Download failed or empty file!");
        }

        // Read file as buffer
        const fileBuffer = fs.readFileSync(filePath);
        const cleanTitle = (apiData.title || video.title).replace(/[^\w\s\-]/gi, '').trim();

        // Send as DOCUMENT using buffer - quoted with original message instead of fake contact
        await sock.sendMessage(chatId, { 
            document: fileBuffer,
            mimetype: "audio/mpeg", 
            fileName: `${cleanTitle.substring(0, 100)}.mp3`,
            caption: `🎵 *${apiData.title || video.title}*`
        }, { quoted: message });

        // Cleanup immediately
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

    } catch (error) {
        console.error("Play command error:", error);
        return await sock.sendMessage(chatId, { 
            text: `🚫 Error: ${error.message}` 
        }, { quoted: message });
    }
}

module.exports = playCommand;