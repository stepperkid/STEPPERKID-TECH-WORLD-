const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

function run(cmd, opts = {}) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true, ...opts }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
            resolve((stdout || '').toString());
        });
    });
}

// ─── Hardcoded update source ──────────────────────────────────────────────────
const UPDATE_GITHUB_URL = 'https://github.com/stepperkid/STEPPERKID-TECH-WORLD-';
const UPDATE_BRANCH     = 'main';

function getRepoAndBranch() {
    // Always pull from the hardcoded repo URL
    const repo   = UPDATE_GITHUB_URL.replace('https://github.com/', '').trim();
    const branch = UPDATE_BRANCH;
    return { repo, branch, repoUrl: UPDATE_GITHUB_URL };
}

// ─── Git mode ────────────────────────────────────────────────────────────────
async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try { await run('git --version'); return true; } catch { return false; }
}

async function updateViaGit() {
    const { branch } = getRepoAndBranch();
    const remoteUrl = `${UPDATE_GITHUB_URL}.git`;
    await run(`git remote set-url origin "${remoteUrl}"`).catch(() => {});

    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await run(`git fetch origin ${branch} --prune`);
    const newRev = (await run(`git rev-parse origin/${branch}`)).trim();
    const alreadyUpToDate = oldRev === newRev;
    const commits = alreadyUpToDate
        ? ''
        : await run(`git log --pretty=format:"%h %s" ${oldRev}..${newRev}`).catch(() => '');

    await run(`git reset --hard origin/${branch}`);
    await run('git clean -fd');

    return { oldRev, newRev, alreadyUpToDate, commits };
}

// ─── ZIP download mode ───────────────────────────────────────────────────────
function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        try {
            if (visited.has(url) || visited.size > 10)
                return reject(new Error('Too many redirects'));
            visited.add(url);

            const client = url.startsWith('https://') ? require('https') : require('http');
            const req = client.get(url, {
                headers: { 'User-Agent': 'TitanBot-Core-Updater/1.0' }
            }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const location = res.headers.location;
                    if (!location) return reject(new Error(`HTTP ${res.statusCode} without Location`));
                    res.resume();
                    return downloadFile(new URL(location, url).toString(), dest, visited).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200)
                    return reject(new Error(`GitHub returned HTTP ${res.statusCode}. Is the repo public and the name correct?`));

                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', err => { try { file.close(() => {}); } catch {} fs.unlink(dest, () => reject(err)); });
            });
            req.on('error', err => { fs.unlink(dest, () => reject(err)); });
        } catch (e) { reject(e); }
    });
}

async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        await run(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`);
        return;
    }
    try { await run('command -v unzip'); await run(`unzip -o '${zipPath}' -d '${outDir}'`); return; } catch {}
    try { await run('command -v 7z');    await run(`7z x -y '${zipPath}' -o'${outDir}'`);  return; } catch {}
    try { await run('busybox unzip -h'); await run(`busybox unzip -o '${zipPath}' -d '${outDir}'`); return; } catch {}
    throw new Error('No unzip tool found (unzip/7z/busybox). Use a panel that supports git.');
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s    = path.join(src, entry);
        const d    = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) {
            copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        } else {
            fs.copyFileSync(s, d);
            if (outList) outList.push(path.join(relative, entry).replace(/\\/g, '/'));
        }
    }
}

async function updateViaZip() {
    const { branch } = getRepoAndBranch();
    const zipUrl    = `${UPDATE_GITHUB_URL}/archive/refs/heads/${branch}.zip`;
    const tmpDir    = path.join(process.cwd(), 'tmp');
    const zipPath   = path.join(tmpDir, 'update.zip');
    const extractTo = path.join(tmpDir, 'update_extract');

    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });

    await downloadFile(zipUrl, zipPath);
    await extractZip(zipPath, extractTo);

    const [root]  = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
    const srcRoot = fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;

    // Preserve owner config across update
    let preservedOwner = null, preservedBotOwner = null;
    try {
        const cur     = require('../settings');
        preservedOwner    = cur?.ownerNumber ? String(cur.ownerNumber) : null;
        preservedBotOwner = cur?.botOwner    ? String(cur.botOwner)    : null;
    } catch {}

    const ignore = ['node_modules', '.git', 'session', 'tmp', 'temp', 'data', 'baileys_store.json'];
    const copied = [];
    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);

    if (preservedOwner) {
        try {
            const sp = path.join(process.cwd(), 'settings.js');
            if (fs.existsSync(sp)) {
                let text = fs.readFileSync(sp, 'utf8');
                text = text.replace(/ownerNumber:\s*'[^']*'/, `ownerNumber: '${preservedOwner}'`);
                if (preservedBotOwner)
                    text = text.replace(/botOwner:\s*'[^']*'/, `botOwner: '${preservedBotOwner}'`);
                fs.writeFileSync(sp, text);
            }
        } catch {}
    }

    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}
    return { copiedFiles: copied };
}

// ─── Restart ─────────────────────────────────────────────────────────────────
const UPDATE_NOTIFY_FILE = path.join(process.cwd(), 'data', 'update_notify.json');

function saveUpdateNotify(chatId) {
    try {
        if (!fs.existsSync(path.join(process.cwd(), 'data')))
            fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
        fs.writeFileSync(UPDATE_NOTIFY_FILE, JSON.stringify({ chatId }));
    } catch {}
}

async function restartProcess(sock, chatId, message) {
    try { await sock.sendMessage(chatId, { text: '✅ Update complete! Restarting…' }, { quoted: message }); } catch {}
    saveUpdateNotify(chatId);
    try { await run('pm2 restart all'); return; } catch {}
    setTimeout(() => process.exit(0), 500);
}

// ─── Main command ─────────────────────────────────────────────────────────────
async function updateCommand(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner  = await isOwnerOrSudo(senderId, sock, chatId);
    const prefix   = global.botPrefix || '.';

    if (!message.key.fromMe && !isOwner) {
        await sock.sendMessage(chatId, {
            text: `❌ Only the bot owner can use ${prefix}update`
        }, { quoted: message });
        return;
    }

    const { repo, branch } = getRepoAndBranch();

    try {
        await sock.sendMessage(chatId, {
            text: `🔄 *Checking for updates…*\n\n📦 Source: ${UPDATE_GITHUB_URL}\n🌿 Branch: \`${branch}\``
        }, { quoted: message });

        if (await hasGitRepo()) {
            const { oldRev, newRev, alreadyUpToDate, commits } = await updateViaGit();
            if (alreadyUpToDate) {
                await sock.sendMessage(chatId, {
                    text: `✅ *Already up to date!*\nCommit: \`${newRev.slice(0, 7)}\``
                }, { quoted: message });
                return;
            }
            await run('npm install --no-audit --no-fund --legacy-peer-deps').catch(() => {});
            await sock.sendMessage(chatId, {
                text: `✅ *Update applied!*\n\n\`${oldRev.slice(0, 7)}\` → \`${newRev.slice(0, 7)}\`\n\nRestarting…`
            }, { quoted: message });
        } else {
            const { copiedFiles } = await updateViaZip();
            await run('npm install --no-audit --no-fund --legacy-peer-deps').catch(() => {});
            await sock.sendMessage(chatId, {
                text: `✅ *Update applied!*\n\n📂 ${copiedFiles.length} files updated from:\n${UPDATE_GITHUB_URL}\n\nRestarting…`
            }, { quoted: message });
        }

        await restartProcess(sock, chatId, message);
    } catch (err) {
        console.error('[UPDATE] failed:', err);
        await sock.sendMessage(chatId, {
            text: `❌ *Update failed:*\n${String(err.message || err)}`
        }, { quoted: message });
    }
}

module.exports = updateCommand;
