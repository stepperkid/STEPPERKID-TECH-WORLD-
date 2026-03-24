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
  // The bot pulls updates directly from your public GitHub repository.
  // Repo format: "owner/repo"   Branch: branch to pull from
  // ────────────────────────────────────────────────────────────────────────────
  updateRepo:   process.env.UPDATE_REPO   || "stepperkid/STEPPERKID-TECH-WORLD-",
  updateBranch: process.env.UPDATE_BRANCH || "main",

  // ─── OPTIONAL SOCIAL LINKS ──────────────────────────────────────────────────
  facebookUrl: '',
  githubUrl:   'https://github.com/stepperkid/STEPPERKID-TECH-WORLD-',
  // ────────────────────────────────────────────────────────────────────────────
};

module.exports = settings;
