const fs = require('fs');
const config = require('./config');
require('dotenv').config()

// Keep-alive HTTP server on port 5000
const express = require('express');
const _app = express();
_app.get('/', (req, res) => res.send('TitanBot-Core 🛡️ Bot is running!'));
_app.listen(5000, '0.0.0.0', () => console.log('Keep-alive server on port 5000'));
const chalk = require('chalk');
const path = require('path');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    jidNormalizedUser, 
    makeCacheableSignalKeyStore, 
    delay 
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const readline = require("readline");
const { rmSync } = require('fs');
require('dotenv').config();

// --- Global Setup ---
global.isBotConnected = false;
global.errorRetryCount = 0;
global.messageBackup = {};
global.botname = "TitanBot-Core 🛡️";
global.themeemoji = "•";

// --- Ensure required data directory and default files exist ---
(function initDataDir() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const defaults = {
        'messageCount.json': { total: 0, users: {}, isPublic: true },
        'ownername.json': { name: null },
        'botname.json': { name: null },
        'prefix.json': { prefix: '.' }
    };
    for (const [file, content] of Object.entries(defaults)) {
        const filePath = path.join(dataDir, file);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        }
    }
})();

// --- Reconnect Guard (prevents concurrent reconnect loops) ---
let _isReconnecting = false;
let _reconnectTimer = null;

function scheduleReconnect(delayMs = 5000) {
    if (_isReconnecting) {
        log(`⚠️ Reconnect already scheduled — skipping duplicate`, 'yellow');
        return;
    }
    _isReconnecting = true;
    clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(async () => {
        _isReconnecting = false;
        await startXeonBotInc();
    }, delayMs);
    log(`🔁 Reconnect scheduled in ${delayMs / 1000}s...`, 'yellow');
}

// --- Paths ---
const sessionDir = path.join(__dirname, 'session');
const credsPath = path.join(sessionDir, 'creds.json');
const loginFile = path.join(__dirname, 'login.json');
const MESSAGE_STORE_FILE = path.join(__dirname, 'message_backup.json');
const SESSION_ERROR_FILE = path.join(__dirname, 'sessionErrorCount.json');

// --- Logging ---
function log(message, color = 'white', isError = false) {
    const prefix = chalk.cyan.bold('[ TitanBot-Core 🛡️ ]');
    const logFunc = isError ? console.error : console.log;
    logFunc(`${prefix} ${chalk[color](message)}`);
}

// --- File Management ---
function loadStoredMessages() {
    try {
        if (fs.existsSync(MESSAGE_STORE_FILE)) {
            return JSON.parse(fs.readFileSync(MESSAGE_STORE_FILE, 'utf-8'));
        }
    } catch (error) { log(`Error loading message store: ${error.message}`, 'red', true); }
    return {};
}

function saveStoredMessages(data) {
    try {
        fs.writeFileSync(MESSAGE_STORE_FILE, JSON.stringify(data, null, 2));
    } catch (error) { log(`Error saving message store: ${error.message}`, 'red', true); }
}

function loadErrorCount() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            return JSON.parse(fs.readFileSync(SESSION_ERROR_FILE, 'utf-8'));
        }
    } catch (error) { log(`Error loading error count: ${error.message}`, 'red', true); }
    return { count: 0, last_error_timestamp: 0 };
}

function saveErrorCount(data) {
    try {
        fs.writeFileSync(SESSION_ERROR_FILE, JSON.stringify(data, null, 2));
    } catch (error) { log(`Error saving error count: ${error.message}`, 'red', true); }
}

function deleteErrorCountFile() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) fs.unlinkSync(SESSION_ERROR_FILE);
    } catch (e) { log(`Failed to delete error file: ${e.message}`, 'red', true); }
}

function clearSessionFiles() {
    try {
        rmSync(sessionDir, { recursive: true, force: true });
        if (fs.existsSync(loginFile)) fs.unlinkSync(loginFile);
        deleteErrorCountFile();
        global.errorRetryCount = 0;
        log('✅ Session cleaned', 'green');
    } catch (e) { log(`Failed to clear session: ${e.message}`, 'red', true); }
}

// --- Login Management ---
async function saveLoginMethod(method) {
    await fs.promises.mkdir(path.dirname(loginFile), { recursive: true });
    await fs.promises.writeFile(loginFile, JSON.stringify({ method }, null, 2));
}

async function getLastLoginMethod() {
    if (fs.existsSync(loginFile)) {
        return JSON.parse(fs.readFileSync(loginFile, 'utf-8')).method;
    }
    return null;
}

function sessionExists() {
    return fs.existsSync(credsPath);
}

function normalizeCredsBuffers(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(normalizeCredsBuffers);
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return { type: 'Buffer', data: Buffer.from(obj.data).toString('base64') };
    }
    const out = {};
    for (const k of Object.keys(obj)) out[k] = normalizeCredsBuffers(obj[k]);
    return out;
}

const VALID_PREFIXES = ['TitanBot-Core:~', 'TRUTH-MD:~', 'TECHWORD-MD:~', 'COURTNEY:~'];

function stripSessionPrefix(sessionId) {
    for (const prefix of VALID_PREFIXES) {
        if (sessionId.includes(prefix)) return sessionId.split(prefix)[1];
    }
    return sessionId;
}

function isValidSessionId(sessionId) {
    return VALID_PREFIXES.some(p => sessionId.startsWith(p));
}

async function downloadSessionData() {
    try {
        await fs.promises.mkdir(sessionDir, { recursive: true });
        if (!fs.existsSync(credsPath) && global.SESSION_ID) {
            const base64Data = stripSessionPrefix(global.SESSION_ID);
            const rawJson = Buffer.from(base64Data, 'base64').toString('utf8');
            const parsed = JSON.parse(rawJson);
            const normalized = normalizeCredsBuffers(parsed);
            await fs.promises.writeFile(credsPath, JSON.stringify(normalized, null, 2));
            log('✅ Session saved', 'green');
        }
    } catch (err) { log(`Error downloading session: ${err.message}`, 'red', true); }
}

async function backupSessionToEnv() {
    try {
        if (!fs.existsSync(credsPath)) return;
        const credsData = await fs.promises.readFile(credsPath);
        const base64 = credsData.toString('base64');
        const sessionId = `TitanBot-Core:~${base64}`;
        let envContent = '';
        if (fs.existsSync('.env')) envContent = fs.readFileSync('.env', 'utf8');
        if (envContent.includes('SESSION_ID=')) {
            envContent = envContent.replace(/^SESSION_ID=.*$/m, `SESSION_ID=${sessionId}`);
        } else {
            envContent += `\nSESSION_ID=${sessionId}`;
        }
        fs.writeFileSync('.env', envContent);
        log('✅ Session backed up to .env as SESSION_ID', 'green');
    } catch (err) { log(`Session backup error: ${err.message}`, 'red', true); }
}

async function requestPairingCode(socket) {
    try {
        await delay(3000);
        let code = await socket.requestPairingCode(global.phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        log(chalk.bgGreen.black(`\nPairing Code: ${code}\n`), 'white');
        log('Enter code in WhatsApp: Settings → Linked Devices → Link a Device', 'blue');
        return true;
    } catch (err) { 
        log(`Failed to get pairing code: ${err.message}`, 'red', true); 
        return false; 
    }
}

// --- Session Validation ---
async function checkAndHandleSessionFormat() {
    const sessionId = process.env.SESSION_ID?.trim();
    if (sessionId && !isValidSessionId(sessionId)) {
        log(chalk.white.bgRed('[ERROR]: Invalid SESSION_ID prefix. Accepted: TitanBot-Core:~, TRUTH-MD:~, TECHWORD-MD:~'), 'white');
        log('Cleaning .env...', 'red');

        try {
            let envContent = fs.readFileSync('.env', 'utf8');
            envContent = envContent.replace(/^SESSION_ID=.*$/m, 'SESSION_ID=');
            fs.writeFileSync('.env', envContent);
            log('✅ Cleaned .env', 'green');
        } catch (e) { log(`Failed to modify .env: ${e.message}`, 'red', true); }

        await delay(20000);
        process.exit(1);
    }
}

async function checkSessionIntegrityAndClean() {
    if (fs.existsSync(sessionDir) && !sessionExists()) {
        log('⚠️ Cleaning incomplete session...', 'red');
        clearSessionFiles();
        await delay(3000);
    }
}

// --- Error Handling ---
function handle408Error(statusCode) {
    if (statusCode !== DisconnectReason.connectionTimeout) return false;

    global.errorRetryCount++;
    const MAX_RETRIES = 10;
    saveErrorCount({ count: global.errorRetryCount, last_error_timestamp: Date.now() });

    if (global.errorRetryCount >= MAX_RETRIES) {
        log(chalk.white.bgRed('[MAX TIMEOUTS REACHED] - Restarting fresh...'), 'white');
        deleteErrorCountFile();
        global.errorRetryCount = 0;
        scheduleReconnect(10000);
        return true;
    }

    const backoff = Math.min(30000, 5000 * global.errorRetryCount);
    log(`Timeout (408). Retry: ${global.errorRetryCount}/${MAX_RETRIES}. Waiting ${backoff / 1000}s...`, 'yellow');
    scheduleReconnect(backoff);
    return true;
}

// --- Bot Core ---
async function sendWelcomeMessage(XeonBotInc) {
    if (global.isBotConnected) return;
    await delay(10000);

    try {
        const pNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';

        const _cp = process.platform, _ca = process.arch;
        const connPlat = (process.env.REPL_SLUG || process.env.REPL_ID) ? 'Replit' : (process.env.HEROKU_APP_NAME || process.env.DYNO) ? 'Heroku' : (process.env.RAILWAY_ENVIRONMENT) ? 'Railway' : (process.env.RENDER_SERVICE_ID) ? 'Render' : (process.env.P_SERVER_UUID || process.env.PTERODACTYL_ENVIRONMENT) ? 'Pterodactyl' : (process.env.KOYEB_APP_NAME) ? 'Koyeb' : (process.env.COOLIFY_APP_ID) ? 'Coolify' : _cp === 'linux' ? `Linux (${_ca})` : _cp === 'win32' ? `Windows (${_ca})` : _cp === 'darwin' ? `macOS (${_ca})` : `${_cp} (${_ca})`;
        const connSettings = require('./settings');
        await XeonBotInc.sendMessage(pNumber, {
            text: `┏━━━━━✧ CONNECTED ✧━━━━━━━
┃✧ Bot: TitanBot-Core 🛡️
┃✧ Status: Active & Online
┃✧ Time: ${new Date().toLocaleString()}
┃✧ Platform: ${connPlat}
┃✧ Version: ${connSettings.version || '1.0.5'}
┗━━━━━━━━━━━━━━━━━━━━━`
        });

        global.isBotConnected = true;
        deleteErrorCountFile();
        global.errorRetryCount = 0;
        log('✅ TitanBot-Core 🛡️ connected successfully', 'green');
    } catch (e) {
        log(`Welcome message error: ${e.message}`, 'red', true);
        global.isBotConnected = false;
    }
}

async function startXeonBotInc() {
    log('Connecting TitanBot-Core 🛡️...', 'cyan');
    const { version } = await fetchLatestBaileysVersion();
    await fs.promises.mkdir(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    const msgRetryCounterCache = new NodeCache();

    // Load required modules before socket so getMessage can reference store
    const store = require('./lib/lightweight_store');
    const { smsg } = require('./lib/myfunc');
    const main = require('./main');
    store.readFromFile();

    const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        getMessage: async (key) => {
            const stored = await store.loadMessage(key.remoteJid, key.id);
            return stored?.message || undefined;
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
        connectTimeoutMs: 30000,
        retryRequestDelayMs: 250,
        emitOwnEvents: false,
        fireInitQueries: true,
    });

    store.bind(XeonBotInc.ev);

    // Auto-save store on interval
    const storeInterval = require('./settings').storeWriteInterval || 30000;
    setInterval(() => store.writeToFile(), storeInterval);

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        const mek = chatUpdate.messages[0];
        if (!mek.message) return;

        if (mek.key.remoteJid === 'status@broadcast') {
            await main.handleStatus(XeonBotInc, chatUpdate);
            return;
        }

        try {
            await main.handleMessages(XeonBotInc, chatUpdate, true);
        } catch(e) { log(e.message, 'red', true); }
    });

    // Group participants update
    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await main.handleGroupParticipantUpdate(XeonBotInc, update);
    });

    // Connection handling
    XeonBotInc.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            global.isBotConnected = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const permanentLogout = statusCode === DisconnectReason.loggedOut || statusCode === 401;

            if (permanentLogout) {
                log(chalk.bgRed.black('🚨 Logged out / Invalid session'), 'white');
                clearSessionFiles();
                await delay(5000);
                process.exit(1);
            } else {
                log(`Connection closed. Status: ${statusCode || 'unknown'}.`, 'yellow');
                const is408Handled = handle408Error(statusCode);
                if (!is408Handled) {
                    scheduleReconnect(5000);
                }
            }
        } else if (connection === 'open') {
            // Connection established — clear any pending reconnect guard
            _isReconnecting = false;
            clearTimeout(_reconnectTimer);
            const botNumber = XeonBotInc.user.id.split(':')[0];
            const settings = require('./settings');
            console.log('');
            console.log(chalk.hex('#6C5CE7').bold('  ╔═══════════════════════════════════╗'));
            console.log(chalk.hex('#6C5CE7').bold('  ║') + chalk.hex('#00CEC9').bold('     TitanBot-Core 🛡️  -  ONLINE     ') + chalk.hex('#6C5CE7').bold('║'));
            console.log(chalk.hex('#6C5CE7').bold('  ╠═══════════════════════════════════╣'));
            console.log(chalk.hex('#6C5CE7').bold('  ║') + chalk.hex('#DFE6E9')(` Number  : +${botNumber}`.padEnd(34)) + chalk.hex('#6C5CE7').bold('║'));
            console.log(chalk.hex('#6C5CE7').bold('  ║') + chalk.hex('#DFE6E9')(` Version : ${settings.version || '1.0.0'}`.padEnd(34)) + chalk.hex('#6C5CE7').bold('║'));
            const _p = process.platform, _a = process.arch;
            const _plat = (process.env.REPL_SLUG || process.env.REPL_ID) ? 'Replit' : (process.env.HEROKU_APP_NAME || process.env.DYNO) ? 'Heroku' : (process.env.RAILWAY_ENVIRONMENT) ? 'Railway' : (process.env.RENDER_SERVICE_ID) ? 'Render' : (process.env.P_SERVER_UUID || process.env.PTERODACTYL_ENVIRONMENT) ? 'Pterodactyl' : (process.env.KOYEB_APP_NAME) ? 'Koyeb' : (process.env.COOLIFY_APP_ID) ? 'Coolify' : _p === 'linux' ? `Linux (${_a})` : _p === 'win32' ? `Windows (${_a})` : _p === 'darwin' ? `macOS (${_a})` : `${_p} (${_a})`;
            console.log(chalk.hex('#6C5CE7').bold('  ║') + chalk.hex('#DFE6E9')(` Mode    : ${settings.commandMode || 'public'}`.padEnd(34)) + chalk.hex('#6C5CE7').bold('║'));
            console.log(chalk.hex('#6C5CE7').bold('  ║') + chalk.hex('#DFE6E9')(` Platform: ${_plat}`.padEnd(34)) + chalk.hex('#6C5CE7').bold('║'));
            console.log(chalk.hex('#6C5CE7').bold('  ║') + chalk.hex('#DFE6E9')(` Time    : ${new Date().toLocaleString()}`.padEnd(34)) + chalk.hex('#6C5CE7').bold('║'));
            console.log(chalk.hex('#6C5CE7').bold('  ╚═══════════════════════════════════╝'));
            console.log('');

            await backupSessionToEnv();
            await sendWelcomeMessage(XeonBotInc);
        } else if (connection === 'connecting') {
            log('🔄 Connecting TitanBot-Core 🛡️ to WhatsApp...', 'yellow');
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    XeonBotInc.public = true;
    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store);

    // Anticall handler
    const antiCallNotified = new Set();
    XeonBotInc.ev.on('call', async (calls) => {
        try {
            for (const call of calls) {
                const callerJid = call.from || call.peerJid || call.chatId;
                if (!callerJid) continue;

                if (!antiCallNotified.has(callerJid)) {
                    antiCallNotified.add(callerJid);
                    setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                    await XeonBotInc.sendMessage(callerJid, { 
                        text: '📵 TitanBot-Core 🛡️: Calls are not allowed. You have been blocked.' 
                    });
                }
            }
        } catch (e) {}
    });

    return XeonBotInc;
}

// --- Main Flow ---
async function tylor() {
    // Load core modules
    try {
        require('./settings');
        const store = require('./lib/lightweight_store');
        store.readFromFile();
        log("✨ TitanBot-Core 🛡️ core loaded", 'green');
    } catch (e) {
        log(`FATAL: Core load failed: ${e.message}`, 'red', true);
        process.exit(1);
    }

    await checkAndHandleSessionFormat();
    global.errorRetryCount = loadErrorCount().count;

    // Priority: Environment SESSION_ID with any valid prefix
    const envSessionID = process.env.SESSION_ID?.trim();
    if (envSessionID && isValidSessionId(envSessionID)) {
        global.SESSION_ID = envSessionID;
        if (sessionExists()) {
            // Session already on disk — keep it intact so signal keys survive restarts
            log(" [PRIORITY]: Using existing session (signal keys preserved)", 'magenta');
        } else {
            // No session on disk — restore from env for the first time
            log(" [PRIORITY]: Restoring session from env SESSION_ID", 'magenta');
            await downloadSessionData();
        }
        await saveLoginMethod('session');
        await delay(2000);
        await startXeonBotInc();
        return;
    }

    log("[ALERT] No TitanBot-Core 🛡️:~ session in .env, checking stored...", 'yellow');
    await checkSessionIntegrityAndClean();

    if (sessionExists()) {
        log("[ALERT]: Starting with stored session...", 'green');
        await delay(3000);
        await startXeonBotInc();
        return;
    }

    // Auto pairing code if PHONE_NUMBER is set
    const envPhone = process.env.PHONE_NUMBER?.replace(/[^0-9]/g, '');
    if (envPhone) {
        log(`[AUTO] Using PHONE_NUMBER from env: +${envPhone}`, 'magenta');
        global.phoneNumber = envPhone;
        await saveLoginMethod('number');
        const bot = await startXeonBotInc();
        await requestPairingCode(bot);
        return;
    }

    // Interactive login — works on both TTY and panel environments
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const question = (prompt) => new Promise(resolve => {
        process.stdout.write(prompt);
        const onData = (data) => {
            process.stdin.removeListener('data', onData);
            resolve(data.toString().trim());
        };
        process.stdin.once('data', onData);
    });

    console.log(chalk.cyan(`
    ╔══════════════════════════════════╗
    ║     TitanBot-Core 🛡️  Login       ║
    ╚══════════════════════════════════╝`));

    log("Choose login method:", 'yellow');
    log("  1) WhatsApp Number (Pairing Code)", 'blue');
    log("  2) Session ID", 'blue');

    let choice = await question("\nChoice (1/2): ");

    if (choice === '1') {
        let phone = await question("Enter WhatsApp number (e.g., 254104260236): ");
        phone = phone.replace(/[^0-9]/g, '');
        global.phoneNumber = phone;
        await saveLoginMethod('number');
        const bot = await startXeonBotInc();
        await requestPairingCode(bot);
    } else if (choice === '2') {
        let sessionId = await question("Paste your Session ID: ");
        sessionId = sessionId.trim();
        if (!isValidSessionId(sessionId)) {
            log("Invalid Session ID! Must start with TitanBot-Core:~, TRUTH-MD:~, or TECHWORD-MD:~", 'red');
            process.exit(1);
        }
        global.SESSION_ID = sessionId;
        await saveLoginMethod('session');
        await downloadSessionData();
        await startXeonBotInc();
    } else {
        log("Invalid choice. Restart and enter 1 or 2.", 'red');
        process.exit(1);
    }
}

// --- Suppress noisy errors (Bad MAC, decryption, protocol noise) ---
const stderrNoisy = [
    /bad mac/i, /hmac/i, /decrypt/i, /failed to decrypt/i,
    /stream errored/i, /precondition/i
];
const sessionDumpPatterns = [
    /Closing open session in favor of incoming prekey bundle/,
    /^Closing session: SessionEntry \{/,
    /^  _chains: \{/,
    /^    [\w+/=]+: \{ chainKey:/,
    /^  registrationId: \d+,$/,
    /^  currentRatchet: \{/,
    /^    ephemeralKeyPair: \{/,
    /^      pubKey: <Buffer/,
    /^      privKey: <Buffer/,
    /^    lastRemoteEphemeralKey: <Buffer/,
    /^    previousCounter: \d+,$/,
    /^    rootKey: <Buffer/,
    /^  indexInfo: \{/,
    /^    baseKey: <Buffer/,
    /^    baseKeyType: \d+,$/,
    /^    closed: -?\d+,$/,
    /^    used: \d+,$/,
    /^    created: \d+,$/,
    /^    remoteIdentityKey: <Buffer/,
    /^  \}$/,
    /^\}$/,
];
function isSessionDump(str) {
    const lines = str.split('\n');
    return lines.some(line => sessionDumpPatterns.some(p => p.test(line.trim())));
}
const origStderr = process.stderr.write.bind(process.stderr);
process.stderr.write = function(chunk, ...args) {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();
    if (stderrNoisy.some(p => p.test(str))) return true;
    if (isSessionDump(str)) return true;
    return origStderr(chunk, ...args);
};
const origStdout = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk, ...args) {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();
    if (isSessionDump(str)) return true;
    return origStdout(chunk, ...args);
};
const origConsoleLog = console.log;
console.log = function(...args) {
    if (args.length === 1 && typeof args[0] === 'string' && isSessionDump(args[0])) return;
    if (args.length > 0) {
        const first = typeof args[0] === 'string' ? args[0] : '';
        if (/^Closing open session|^Closing session: SessionEntry/.test(first)) return;
    }
    origConsoleLog.apply(console, args);
};
const origConsoleError = console.error;
console.error = function(...args) {
    const str = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (stderrNoisy.some(p => p.test(str))) return;
    origConsoleError.apply(console, args);
};

// --- Start Bot ---
const noisyPatterns = [
    /bad mac/i, /hmac/i, /decrypt/i, /failed to decrypt/i,
    /stream errored/i, /precondition/i, /rate-overlimit/i
];
tylor().catch(err => log(`Start error: ${err.message}`, 'red', true));
process.on('uncaughtException', (err) => {
    if (noisyPatterns.some(p => p.test(err.message || ''))) return;
    log(`Uncaught: ${err.message}`, 'red', true);
});
process.on('unhandledRejection', (err) => {
    const msg = err?.message || String(err);
    if (noisyPatterns.some(p => p.test(msg))) return;
    log(`Unhandled: ${msg}`, 'red', true);
});

// Clean exit on SIGTERM so the workflow runner can restart properly
process.on('SIGTERM', () => {
    log('⚠️ SIGTERM received — shutting down cleanly.', 'yellow');
    process.exit(0);
});
