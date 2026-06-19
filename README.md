<p align="center">
  <a href="https://github.com/ArtemTykhonenko/kindle-vocabulary-to-anki/blob/main/README.md">
    <img src="public/logo.png" alt="Kindle Vocabulary to Anki Logo" width="300"/>
  </a>
</p>

<h1 align="center">Kindle Vocabulary to Anki Sync Hub</h1>

<p align="center">
  <em>A beautiful, local-first web utility to transform your Kindle vocabulary into Anki flashcards.</em>
</p>

<p align="center">
  <b>English</b> | <a href="README.ru.md">Русский</a>
</p>

---

## 🌟 How it Works

**Kindle Vocabulary to Anki Sync Hub** is a powerful tool designed to seamlessly bridge the gap between your reading on Kindle and your language learning journey in Anki. 

At its core, this utility is built for **creating Anki flashcards with translations and definitions** from words you've looked up on your Kindle device.

1. **Upload your `vocab.db`**: Connect your Kindle and drop the vocabulary database file into the web app. The parsing happens 100% locally in your browser.
2. **Translate & Define**: We use free, AI-free lookup services (Google Translate, MyMemory, and Free Dictionary API) to fetch translations and definitions for your words.
3. **Review & Sync**: Review the generated cards, select the languages you need, and send them directly to Anki!

## ✨ Key Features

### 🃏 Flashcards Creation
The primary goal of the app is to let you generate high-quality flashcards with translations and definitions from your Kindle's lookup history.

### 🔄 Smart Anki Comparison
Avoid duplicates! The app can compare your Kindle vocabulary against your existing Anki database. If a word already exists in your Anki deck, it will be highlighted or skipped, ensuring you don't waste time on words you already know.

### ✏️ Edit and Export (Kindle Style)
Not only can you export to Anki, but you also have the ability to **edit the database and export it back in Kindle style**. This allows you to effectively manage and prune your Kindle's native `vocab.db` database, keeping your device clean and organized.

### 🔒 100% Offline & Private
Your database is parsed client-side using WebAssembly (`sql.js`). Your `vocab.db` never leaves your machine!

---

## 🚀 Run Locally

**Prerequisites**: [Node.js](https://nodejs.org/)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:3000` to start syncing!

## ☁️ Static Hosting (Serverless / Static Deployment)

This application can run **completely serverless/client-side** in your browser without any running Node backend. 

To deploy to static hosting (GitHub Pages, Vercel, Netlify, Cloudflare Pages, etc.):

1. Build the production assets:
   ```bash
   npm run build
   ```
2. Upload the contents of the `dist/` directory directly to your static hosting provider.
3. The frontend will automatically perform direct, sandboxed client-side fetches for translations and definitions.
