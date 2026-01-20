# 🤖 EasyStep-BOT

EasyStep-BOT is a WhatsApp bot built with the Baileys library to help manage WhatsApp groups efficiently.
It supports multi-language (AR / EN), Admin & Owner permissions, and automatic command loading.

## 👋 Welcome Card Template

The welcome image is generated locally (no external image API) using `sharp`.

**Default template path:**
- `assets/welcome_template.jpg`

**Optional template from your own API/CDN:**
- Set `WELCOME_TEMPLATE_URL` in your `.env` (the image is downloaded and cached for 10 minutes).

## 🚀 Getting Started

### Requirements
- Node.js
- Git

### Installation
```bash
git clone <YOUR_REPOSITORY_URL>
cd <PROJECT_FOLDER>
npm install
node index.js
```

### Connect WhatsApp
Link your WhatsApp account using Linked Devices.

## ⚙️ Features
- Automatic command loading
- Multi-language support (Arabic / English)
- Admin & Owner permissions
- Anti-Link / Anti-Tag / Anti-Badword
- Welcome & Goodbye messages
- Islamic commands
- Egypt timezone (Africa/Cairo)
- Bot name: EasyStep-BOT

## 📜 License
MIT License

## ⚠️ Disclaimer
This is not an official WhatsApp bot. Use at your own risk.
