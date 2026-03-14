const axios = require('axios');
const { sleep } = require('../lib/myfunc');

async function pairCommand(sock, chatId, message) {
    try {
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            "";

        const q = text.replace(/^\.pair\s*/i, "").trim();

        if (!q) {
            await sock.sendMessage(chatId, {
                text: "Please provide a WhatsApp number\nExample: .pair 2547xxxxxxx",
                contextInfo: { forwardingScore: 1, isForwarded: false }
            }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: "⚠️", key: message.key } });
            return;
        }

        const numbers = q.split(",")
            .map(v => v.replace(/[^0-9]/g, ""))
            .filter(v => v.length >= 6 && v.length <= 20);

        if (numbers.length === 0) {
            await sock.sendMessage(chatId, {
                text: "Invalid number format. Use digits only.",
                contextInfo: { forwardingScore: 1, isForwarded: true }
            }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
            return;
        }

        for (const number of numbers) {
            const whatsappID = `${number}@s.whatsapp.net`;
            const result = await sock.onWhatsApp(whatsappID);

            if (!result?.[0]?.exists) {
                await sock.sendMessage(chatId, {
                    text: `Number ${number} is not registered on WhatsApp`,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                });
                await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
                continue;
            }

            await sock.sendMessage(chatId, {
                text: `Generating code for: ${number}`,
                contextInfo: { forwardingScore: 1, isForwarded: false }
            }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: "⏳", key: message.key } });

            try {
                const response = await axios.get(
                    `https://techword-pair.onrender.com/code?number=${number}`,
                    { timeout: 20000 }
                );

                const code = response.data?.code;
                if (!code || code === "Service Unavailable") {
                    throw new Error("Service Unavailable");
                }

                await sleep(3000);
                await sock.sendMessage(chatId, {
                    text: `${code}`,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: "✅", key: message.key } });

                await sock.sendMessage(chatId, {
                    text: `How to link ${number}:\n1. Copy the code above\n2. Open WhatsApp\n3. Go to Settings > Linked Devices\n4. Tap Link a Device\n5. Enter the code\n6. Wait for it to load\n7. Done! Your device is linked.`,
                    contextInfo: { forwardingScore: 1, isForwarded: false }
                }, { quoted: message });

            } catch (apiError) {
                console.error("API Error:", apiError.message);
                const errorMessage =
                    apiError.message === "Service Unavailable"
                        ? "Service unavailable. Please try again later."
                        : "Failed to generate pairing code. Please try again later.";

                await sock.sendMessage(chatId, {
                    text: errorMessage,
                    contextInfo: { forwardingScore: 1, isForwarded: true }
                }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: "⚠️", key: message.key } });
            }
        }
    } catch (error) {
        console.error("Command Error:", error);
        await sock.sendMessage(chatId, {
            text: "An error occurred. Please try again later.",
            contextInfo: { forwardingScore: 1, isForwarded: true }
        });
        await sock.sendMessage(chatId, { react: { text: "⚠️", key: message.key } });
    }
}

module.exports = pairCommand;
