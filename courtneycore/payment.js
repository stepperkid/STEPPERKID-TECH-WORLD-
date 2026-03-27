const fs = require('fs');
const path = require('path');

const PAYMENT_PATH = path.join(process.cwd(), 'data', 'payment.json');

function loadPayment() {
    try {
        if (!fs.existsSync(PAYMENT_PATH)) return {};
        return JSON.parse(fs.readFileSync(PAYMENT_PATH, 'utf-8'));
    } catch {
        return {};
    }
}

function savePayment(data) {
    try {
        const dir = path.dirname(PAYMENT_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(PAYMENT_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to save payment data:', e.message);
    }
}

async function setPaymentCommand(sock, chatId, senderId, userMessage, message) {
    const isOwnerOrSudo = require('../lib/isOwner');
    const allowed = await isOwnerOrSudo(senderId);
    if (!allowed) {
        return sock.sendMessage(chatId, { text: '❌ Only the bot owner can set payment details.' }, { quoted: message });
    }

    const args = userMessage.slice('.setpayment'.length).trim();
    if (!args) {
        return sock.sendMessage(chatId, {
            text: `📋 *SETPAYMENT USAGE*\n\n.setpayment <method> | <details>\n\nExample:\n.setpayment PayPal | paypal.me/yourname\n.setpayment MTN MoMo | 0812345678\n.setpayment Bank | GTBank — 0123456789 — John Doe`
        }, { quoted: message });
    }

    const parts = args.split('|').map(s => s.trim());
    if (parts.length < 2) {
        return sock.sendMessage(chatId, {
            text: '❌ Invalid format. Use:\n*.setpayment <method> | <details>*'
        }, { quoted: message });
    }

    const method = parts[0];
    const details = parts.slice(1).join('|').trim();

    const data = loadPayment();
    if (!data.methods) data.methods = [];

    const existing = data.methods.findIndex(m => m.method.toLowerCase() === method.toLowerCase());
    if (existing !== -1) {
        data.methods[existing] = { method, details };
    } else {
        data.methods.push({ method, details });
    }

    savePayment(data);
    await sock.sendMessage(chatId, {
        text: `✅ Payment method *${method}* has been saved successfully!`
    }, { quoted: message });
}

async function paymentCommand(sock, chatId, message) {
    const data = loadPayment();
    const methods = data.methods || [];

    if (!methods.length) {
        return sock.sendMessage(chatId, {
            text: '❌ No payment methods have been set yet.\nThe owner can add one using *.setpayment*'
        }, { quoted: message });
    }

    const list = methods.map((m, i) =>
        `▢ *${i + 1}. ${m.method}*\n   └ ${m.details}`
    ).join('\n\n');

    const text = `💳 *PAYMENT INFORMATION*\n\n${list}\n\n_Contact the owner after making payment._`;
    await sock.sendMessage(chatId, { text }, { quoted: message });
}

async function delPaymentCommand(sock, chatId, senderId, userMessage, message) {
    const isOwnerOrSudo = require('../lib/isOwner');
    const allowed = await isOwnerOrSudo(senderId);
    if (!allowed) {
        return sock.sendMessage(chatId, { text: '❌ Only the bot owner can delete payment details.' }, { quoted: message });
    }

    const args = userMessage.slice('.delpayment'.length).trim();
    const data = loadPayment();
    const methods = data.methods || [];

    if (!methods.length) {
        return sock.sendMessage(chatId, { text: '❌ No payment methods are set.' }, { quoted: message });
    }

    if (!args) {
        const list = methods.map((m, i) => `${i + 1}. ${m.method}`).join('\n');
        return sock.sendMessage(chatId, {
            text: `📋 *Saved Payment Methods*\n\n${list}\n\nTo delete: *.delpayment <number or method name>*\nTo delete all: *.delpayment all*`
        }, { quoted: message });
    }

    if (args.toLowerCase() === 'all') {
        data.methods = [];
        savePayment(data);
        return sock.sendMessage(chatId, { text: '✅ All payment methods have been deleted.' }, { quoted: message });
    }

    const index = parseInt(args) - 1;
    if (!isNaN(index) && index >= 0 && index < methods.length) {
        const removed = methods.splice(index, 1);
        data.methods = methods;
        savePayment(data);
        return sock.sendMessage(chatId, { text: `✅ Payment method *${removed[0].method}* has been deleted.` }, { quoted: message });
    }

    const nameIndex = methods.findIndex(m => m.method.toLowerCase() === args.toLowerCase());
    if (nameIndex !== -1) {
        const removed = methods.splice(nameIndex, 1);
        data.methods = methods;
        savePayment(data);
        return sock.sendMessage(chatId, { text: `✅ Payment method *${removed[0].method}* has been deleted.` }, { quoted: message });
    }

    await sock.sendMessage(chatId, { text: `❌ Payment method "*${args}*" not found.` }, { quoted: message });
}

module.exports = { setPaymentCommand, paymentCommand, delPaymentCommand };
