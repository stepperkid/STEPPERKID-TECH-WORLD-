# TitanBot-Core 🛡️ WhatsApp Bot

## Overview
A Node.js WhatsApp bot built with the Baileys library. Supports group management, media tools, AI chat, stickers, and many other commands.

## Architecture
- **Runtime**: Node.js 20
- **Entry point**: `index.js` — starts the bot and a keep-alive HTTP server on port 5000
- **Bot logic**: `main.js` — handles all incoming WhatsApp messages and routes commands
- **Commands**: `davecore/` — individual command modules (100+ commands)
- **Utilities**: `lib/` — helper functions, store, sticker tools, converters
- **Config**: `config.js` — API keys and global config, `settings.js` — bot settings

## Setup
1. Set the `SESSION_ID` environment variable with a valid `TitanBot-Core:~` prefixed session ID, OR
2. Run the bot and choose login method (pairing code or session ID)

## Running
- Workflow: `node index.js`
- Keep-alive server listens on port 5000 (0.0.0.0)
- Bot connects to WhatsApp via WebSocket

## Key Dependencies
- `@whiskeysockets/baileys` — WhatsApp Web API
- `express` — Keep-alive HTTP server
- `jimp`, `sharp` — Image processing
- `fluent-ffmpeg` — Media conversion
- `@google/generative-ai` — AI chat features
