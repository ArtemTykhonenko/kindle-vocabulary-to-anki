import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser limit increased for larger batches or settings
  app.use(express.json({ limit: "10mb" }));

  // API endpoint to check status (AI-Free Mode)
  app.get("/api/status", (req, res) => {
    res.json({
      status: "ok",
      mode: "AI-Free / Open Dictionaries",
    });
  });

  // API Route: Translate and look up definitions for a batch of words using public APIs
  app.post("/api/lookup", async (req, res) => {
    const { items, sourceLang, targetLang } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid request body. 'items' array is required." });
    }

    try {
      const results = [];
      for (const item of items) {
        const word = item.word;
        const context = item.context || "";
        
        let sl = sourceLang === "auto" ? (item.lang || "en") : sourceLang;
        const tl = targetLang || "ru";

        let translation = "";
        let ipa = "";
        let explanation = "";
        let example = context;

        // 1. Fetch translation using Google Translate GTX API
        try {
          const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(word)}`;
          const transRes = await fetch(transUrl);
          if (transRes.ok) {
            const transData = await transRes.json();
            if (transData && transData[0] && transData[0][0] && transData[0][0][0]) {
              translation = transData[0][0][0];
            }
          }
        } catch (err) {
          console.error(`Google Translate proxy failed for "${word}":`, err);
        }

        // Fallback translation using MyMemory API
        if (!translation) {
          try {
            const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${sl}|${tl}`;
            const memRes = await fetch(myMemoryUrl);
            if (memRes.ok) {
              const memData = await memRes.json();
              if (memData && memData.responseData && memData.responseData.translatedText) {
                translation = memData.responseData.translatedText;
              }
            }
          } catch (err) {
            console.error(`MyMemory Translate proxy failed for "${word}":`, err);
          }
        }

        // 2. Fetch definition and IPA using Free Dictionary API (only for English words)
        if (sl === "en") {
          try {
            const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
            const dictRes = await fetch(dictUrl);
            if (dictRes.ok) {
              const dictData = await dictRes.json();
              if (Array.isArray(dictData) && dictData.length > 0) {
                const entry = dictData[0];
                
                // Extract phonetic IPA
                let foundIpa = entry.phonetic || "";
                if (!foundIpa && entry.phonetics && Array.isArray(entry.phonetics)) {
                  const pWithText = entry.phonetics.find((p: any) => p.text);
                  if (pWithText) foundIpa = pWithText.text;
                }
                ipa = foundIpa;

                // Extract first available definition
                if (entry.meanings && Array.isArray(entry.meanings) && entry.meanings.length > 0) {
                  const firstMeaning = entry.meanings[0];
                  const partOfSpeech = firstMeaning.partOfSpeech ? `(${firstMeaning.partOfSpeech}) ` : "";
                  if (firstMeaning.definitions && Array.isArray(firstMeaning.definitions) && firstMeaning.definitions.length > 0) {
                    explanation = partOfSpeech + firstMeaning.definitions[0].definition;
                  }
                }

                // Extract example
                let foundExample = "";
                if (entry.meanings && Array.isArray(entry.meanings)) {
                  for (const m of entry.meanings) {
                    if (m.definitions && Array.isArray(m.definitions)) {
                      const defWithEx = m.definitions.find((d: any) => d.example);
                      if (defWithEx) {
                        foundExample = defWithEx.example;
                        break;
                      }
                    }
                  }
                }
                if (foundExample) {
                  example = foundExample;
                }
              }
            }
          } catch (err) {
            console.error(`Dictionary lookup proxy failed for "${word}":`, err);
          }
        }

        results.push({
          word,
          translation: translation || word,
          ipa: ipa || "",
          explanation: explanation || "",
          example: example || context || "",
        });

        // Add 150ms delay between words in proxy to protect rate limits
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      res.json({ success: true, results });
    } catch (err: any) {
      console.error("Lookup proxy error:", err);
      res.status(500).json({
        error: "Failed to perform word lookup",
        details: err.message || err,
      });
    }
  });

  // Serve static assets with Vite in dev, express.static in prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
