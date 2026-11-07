<p align="center">
  <a href="https://github.com/ArtemTykhonenko/kindle-vocabulary-to-anki/blob/main/README.md">
    <img src="public/favicon.svg" alt="Kindle Vocabulary to Anki Logo" width="88"/>
  </a>
</p>

<h1 align="center">Kindle Vocabulary to Anki</h1>

<p align="center">
  <em>A fast, 100% browser-based utility to turn your Kindle Vocabulary Builder (<code>vocab.db</code>) and custom word lists into styled Anki flashcards with translations, IPA phonetics, book quotes, examples, and audio pronunciation.</em>
</p>

<p align="center">
  <a href="https://www.kindle2anki.online"><b>kindle2anki.online</b></a> · <a href="https://www.kindletoanki.online"><b>kindletoanki.online</b></a>
</p>

<p align="center">
  <b>English</b> | <a href="README.uk.md">Українська</a>
</p>

---

## 🌟 How It Works

**Kindle Vocabulary to Anki** bridges the gap between reading on your Amazon Kindle e-reader and retaining vocabulary in Anki — operating **100% client-side in your browser** with zero servers and zero AI API keys required.

1. **1. Add Words**: Connect your Kindle via USB and drop `system/vocabulary/vocab.db` into the browser (or paste any custom list of words). Your SQLite database is parsed locally in WebAssembly (`sql.js`).
2. **2. Translate & Edit**: Automatically translate words (defaults to **English → Ukrainian**, with 14+ target languages supported including English, Ukrainian, Spanish, German, French, Polish, Russian, etc.) and enrich every card with **IPA phonetic transcriptions**, **dictionary definitions**, **original Kindle book quotes**, **usage examples**, and **human MP3 audio pronunciation**.
3. **3. Export to Anki & Clean Kindle**: Download a ready-to-study Anki deck (`.txt`) with automatic Light & Dark mode styling and embedded audio buttons, push directly to Anki Desktop via **AnkiConnect**, and download a clean `vocab.db` file to wipe old words from your Kindle Vocabulary Builder.

---

## ✨ Key Features

### 🃏 Rich, Ready-to-Study Anki Cards
Every card is automatically populated with:
- **Translation** in your chosen target language (default: Ukrainian `uk`).
- **IPA Phonetics** & **Part-of-Speech Definitions** via dictionary lookup with automatic stem/lemma resolution.
- **Highlighted Context Sentences**: preserves the exact sentence from the Kindle book where you tapped the word, plus an additional usage example.
- **Audio Pronunciation (`🔊`)**: works both in the web interface and inside exported Anki cards (powered by Oxford Dictionary MP3 CDN with Youdao & Web Speech API fallback).
- **Automatic Light & Dark Mode**: exported HTML cards adapt automatically to Anki Desktop, AnkiMobile, and AnkiDroid themes.

### 🧹 Kindle Vocabulary Cleaner (`vocab.db`)
Amazon Kindle does not provide a simple "Delete All" button for the Vocabulary Builder on the device. After exporting your flashcards, click **Download Clean vocab.db** on the Export screen and replace `system/vocabulary/vocab.db` on your Kindle via USB to start fresh.

### ⚡ Direct Sync with Anki Desktop (AnkiConnect)
In addition to 1-click `.txt` file export, you can push cards directly into Anki Desktop using the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on (`2055492159`). The Export screen includes a built-in 3-step setup guide and 1-click CORS JSON configuration for `kindle2anki.online` and `kindletoanki.online`.

### 🔒 100% Autonomous, Serverless & Private
- **No Backend Server**: runs as a pure static Single-Page Application (SPA).
- **No AI Dependencies**: relies on deterministic dictionary and translation APIs directly from the browser.
- **Local Persistence**: your active deck and original `vocab.db` binary are stored locally in your browser's `IndexedDB`.

---

## 🚀 Run Locally

**Prerequisites**: [Node.js](https://nodejs.org/) (v18+)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.

---

## ☁️ Static Deployment

Because the app is 100% client-side, you can deploy it to any static hosting provider (Vercel, Cloudflare Pages, Netlify, GitHub Pages):

1. Build the production bundle:
   ```bash
   npm run build
   ```
2. Deploy the generated `dist/` directory.
