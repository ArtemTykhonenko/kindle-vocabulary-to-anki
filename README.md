# Kindle Vocabulary to Anki Sync Hub (AI-Free Mode)

A beautiful, local-first web utility to extract and import your Kindle Vocabulary Builder database (`vocab.db`), translate words via free open-access translation engines, fetch definitions, and export/synchronize them directly with Anki flashcards.

## Key Features

- **100% Offline SQLite Engine**: Your database is parsed client-side using WebAssembly (SQL.js). No databases are uploaded.
- **AI-Free Lookup Proxy**: Translation uses public keyless services (Google Translate + MyMemory) and dictionary definitions (Free Dictionary API).
- **Direct Anki Integration**: Sync cards directly to Anki Desktop using the AnkiConnect add-on, or export as tab-separated TXT.
- **Multi-Language Selectors**: Select word source languages and target translation languages instantly.

## Run Locally

**Prerequisites**: [Node.js](https://nodejs.org/)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:3000` to start sync processes!

## Static Hosting (Serverless / Static Deployment)

This application can run **completely serverless/client-side** in your browser without any running Node backend. 

To deploy to static hosting (GitHub Pages, Vercel, Netlify, Cloudflare Pages, etc.):

1. Build the production assets:
   ```bash
   npm run build
   ```
2. Upload/deploy the contents of the `dist/` directory directly to your static hosting provider.
3. The frontend will automatically detect the absence of the backend proxy and perform direct, sandboxed client-side fetches for translations and definitions.

