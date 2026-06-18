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
      const CONCURRENCY = 5; // Process 5 words simultaneously to avoid rate-limiting
      
      for (let i = 0; i < items.length; i += CONCURRENCY) {
        const chunk = items.slice(i, i + CONCURRENCY);
        
        const chunkPromises = chunk.map(async (item) => {
          const word = item.word;
          const context = item.context || "";
          let sl = sourceLang === "auto" ? (item.lang || "en") : sourceLang;
          const tl = targetLang || "ru";

          let translation = "";
          let ipa = "";
          let explanation = "";
          let example = context;

          // Parallel fetch: Google Translate + Free Dictionary
          const fetchTranslation = async () => {
            try {
              const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(word)}`;
              const transRes = await fetch(transUrl);
              if (transRes.ok) {
                const transData = await transRes.json();
                if (transData && transData[0] && transData[0][0] && transData[0][0][0]) {
                  return transData[0][0][0];
                }
              }
            } catch (err) {
              console.error(`Google Translate proxy failed for "${word}":`, err);
            }

            // Fallback to MyMemory
            try {
              const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${sl}|${tl}`;
              const memRes = await fetch(myMemoryUrl);
              if (memRes.ok) {
                const memData = await memRes.json();
                if (memData && memData.responseData && memData.responseData.translatedText) {
                  return memData.responseData.translatedText;
                }
              }
            } catch (err) {
              console.error(`MyMemory Translate proxy failed for "${word}":`, err);
            }
            return "";
          };

          const fetchDictionary = async () => {
            if (sl !== "en") return { ipa: "", explanation: "", example: "" };
            try {
              const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
              const dictRes = await fetch(dictUrl);
              if (dictRes.ok) {
                const dictData = await dictRes.json();
                if (Array.isArray(dictData) && dictData.length > 0) {
                  const entry = dictData[0];
                  let foundIpa = entry.phonetic || "";
                  if (!foundIpa && entry.phonetics && Array.isArray(entry.phonetics)) {
                    const pWithText = entry.phonetics.find((p: any) => p.text);
                    if (pWithText) foundIpa = pWithText.text;
                  }

                  let foundExplanation = "";
                  if (entry.meanings && Array.isArray(entry.meanings) && entry.meanings.length > 0) {
                    const firstMeaning = entry.meanings[0];
                    const partOfSpeech = firstMeaning.partOfSpeech ? `(${firstMeaning.partOfSpeech}) ` : "";
                    if (firstMeaning.definitions && Array.isArray(firstMeaning.definitions) && firstMeaning.definitions.length > 0) {
                      foundExplanation = partOfSpeech + firstMeaning.definitions[0].definition;
                    }
                  }

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
                  return { ipa: foundIpa, explanation: foundExplanation, example: foundExample };
                }
              }
            } catch (err) {
              console.error(`Dictionary lookup proxy failed for "${word}":`, err);
            }
            return { ipa: "", explanation: "", example: "" };
          };

          const [transResult, dictResult] = await Promise.all([
            fetchTranslation(),
            fetchDictionary()
          ]);

          return {
            word,
            translation: transResult || word,
            ipa: dictResult.ipa || "",
            explanation: dictResult.explanation || "",
            example: dictResult.example || context || "",
          };
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);

        // Small delay between concurrent chunks to protect rate limits
        if (i + CONCURRENCY < items.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
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
