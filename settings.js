const settings = {
  packname: 'TitanBot-Core 🛡️',
  author: 'TitanBot-Core',
  botName: "TitanBot-Core 🛡️",
  botOwner: 'COURTNEY🦅',           // Your display name
  ownerNumber: '254743037984',       // Your number without + (country code + number, no spaces)
  giphyApiKey: 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: "public",             // "public" or "private"
  maxStoreMessages: 20,
  storeWriteInterval: 10000,         // How often (ms) to save message store to disk
  description: "TitanBot-Core 🛡️ — A powerful WhatsApp bot for group management, AI, media and more.",
  version: "1.0.5",

  // ─── UPDATE SOURCE ──────────────────────────────────────────────────────────
  // When a user runs `.update`, the bot downloads and applies this zip file.
  // Set this to your GitHub repo zip URL (replace USERNAME and REPO below):
  //   GitHub format: https://github.com/USERNAME/REPO/archive/refs/heads/BRANCH.zip
  //
  // You can also override this at runtime without editing this file by setting
  // the UPDATE_ZIP_URL environment variable in Replit Secrets.
  //
  // Users can also pass a one-off URL directly: .update https://your-url.zip
  // ────────────────────────────────────────────────────────────────────────────
  updateZipUrl: process.env.UPDATE_ZIP_URL || "https://github.com/stepperkid254/TitanBot-Core-/archive/refs/heads/main.zip",

  // ─── OPTIONAL SOCIAL LINKS ──────────────────────────────────────────────────
  facebookUrl: '',   // e.g. https://facebook.com/yourpage
  githubUrl:   'https://github.com/stepperkid254/TitanBot-Core-',
  // ────────────────────────────────────────────────────────────────────────────
};

module.exports = settings;
