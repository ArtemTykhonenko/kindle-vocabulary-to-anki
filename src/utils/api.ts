/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word } from "../types";

export interface ExplanationResponse {
  word: string;
  translation: string;
  ipa: string;
  explanation: string;
  example: string;
}

/**
 * Check if the local backend server is reachable.
 */
export async function getBackendStatus(): Promise<{ status: string; mode: string }> {
  try {
    const res = await fetch("/api/status");
    if (!res.ok) throw new Error("Backend answered with status: " + res.status);
    return await res.json();
  } catch (err) {
    console.warn("Backend server not detected. Switching frontend to pure offline sandboxed mode.");
    serverUnavailable = true; // Set to true immediately to skip server-side lookup queries
    return { status: "error", mode: "offline" };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let serverUnavailable = false;

/**
 * Perform direct client-side lookup for a batch of words using public APIs.
 */
async function runClientFallback(
  chunk: { word: string; context?: string; lang?: string }[],
  sourceLang: string,
  targetLang: string
): Promise<ExplanationResponse[]> {
  const fallbackResults: ExplanationResponse[] = [];
  for (const item of chunk) {
    let sl = sourceLang === "auto" ? (item.lang || "en") : sourceLang;
    const tl = targetLang || "ru";

    let translation = "";
    let ipa = "";
    let explanation = "";
    let example = item.context || "";

    // 1. Direct fetch Google Translate (undocumented client gtx API)
    try {
      const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(item.word)}`;
      const transRes = await fetch(transUrl);
      if (transRes.ok) {
        const transData = await transRes.json();
        if (transData && transData[0] && transData[0][0] && transData[0][0][0]) {
          translation = transData[0][0][0];
        }
      }
    } catch (err) {
      console.warn("Client translation fetch failed:", err);
    }

    // Fallback: MyMemory API
    if (!translation) {
      try {
        const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(item.word)}&langpair=${sl}|${tl}`;
        const memRes = await fetch(myMemoryUrl);
        if (memRes.ok) {
          const memData = await memRes.json();
          if (memData && memData.responseData && memData.responseData.translatedText) {
            translation = memData.responseData.translatedText;
          }
        }
      } catch (err) {
        console.error("Client MyMemory translation fetch failed:", err);
      }
    }

    // 2. Direct fetch Free Dictionary API (English only)
    if (sl === "en") {
      try {
        const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(item.word)}`;
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
            ipa = foundIpa;

            if (entry.meanings && Array.isArray(entry.meanings) && entry.meanings.length > 0) {
              const firstMeaning = entry.meanings[0];
              const partOfSpeech = firstMeaning.partOfSpeech ? `(${firstMeaning.partOfSpeech}) ` : "";
              if (firstMeaning.definitions && Array.isArray(firstMeaning.definitions) && firstMeaning.definitions.length > 0) {
                explanation = partOfSpeech + firstMeaning.definitions[0].definition;
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
            if (foundExample) {
              example = foundExample;
            }
          }
        }
      } catch (err) {
        console.error("Client dictionary fetch failed:", err);
      }
    }

    fallbackResults.push({
      word: item.word,
      translation: translation || item.word,
      ipa: ipa || "",
      explanation: explanation || "",
      example: example || item.context || "",
    });

    // Gentle delay to protect rate-limits
    await sleep(200);
  }
  return fallbackResults;
}

/**
 * Translates a batch of words using the keyless server-side proxy.
 * Automatically falls back to direct client-side calls immediately if the server proxy is offline or returns error.
 */
export async function translateWordsBatch(
  wordsToTranslate: { word: string; context?: string; lang?: string }[],
  sourceLang: string,
  targetLang: string,
  onProgress: (done: number, total: number) => void
): Promise<ExplanationResponse[]> {
  const BATCH_SIZE = 5;
  const total = wordsToTranslate.length;
  const results: ExplanationResponse[] = [];

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = wordsToTranslate.slice(i, i + BATCH_SIZE);

    if (serverUnavailable) {
      const fallbackResults = await runClientFallback(chunk, sourceLang, targetLang);
      results.push(...fallbackResults);
      onProgress(Math.min(i + BATCH_SIZE, total), total);
      continue;
    }

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: chunk, sourceLang, targetLang }),
      });

      if (!res.ok) {
        throw new Error(`Server lookup returned status: ${res.status}`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        results.push(...data.results);
      } else {
        throw new Error("Invalid response format received from lookup API");
      }
    } catch (error: any) {
      console.warn("Local lookup proxy failed or unavailable, switching immediately to client-side direct translation mode:", error);
      serverUnavailable = true; // Flag server as offline to bypass server fetches in subsequent loops

      const fallbackResults = await runClientFallback(chunk, sourceLang, targetLang);
      results.push(...fallbackResults);
    }

    onProgress(Math.min(i + BATCH_SIZE, total), total);
    
    if (i + BATCH_SIZE < total) {
      await sleep(500);
    }
  }

  return results;
}
