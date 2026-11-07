/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExplanationResponse {
  word: string;
  translation: string;
  ipa: string;
  explanation: string;
  example: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generates candidate base forms (lemmas) for inflected English words
 * so dictionary lookups succeed even for -ed, -ing, -es, -ies, -s forms.
 */
export function guessClientLemmas(word: string, stem?: string): string[] {
  const candidates = new Set<string>();
  const clean = word.trim().toLowerCase();
  if (stem && stem.trim()) candidates.add(stem.trim().toLowerCase());
  if (clean) candidates.add(clean);

  if (clean.length > 4) {
    if (clean.endsWith("ies")) candidates.add(clean.slice(0, -3) + "y");
    if (clean.endsWith("es")) candidates.add(clean.slice(0, -2));
    if (clean.endsWith("s") && !clean.endsWith("ss")) candidates.add(clean.slice(0, -1));
    if (clean.endsWith("ed")) {
      candidates.add(clean.slice(0, -2));
      candidates.add(clean.slice(0, -1));
    }
    if (clean.endsWith("ing")) {
      candidates.add(clean.slice(0, -3));
      candidates.add(clean.slice(0, -3) + "e");
    }
    if (clean.endsWith("ly")) {
      candidates.add(clean.slice(0, -2));
    }
  }
  return Array.from(candidates);
}

/**
 * Look up a single word directly in the browser using autonomous public dictionary & translation APIs.
 */
async function lookupSingleWordClient(
  item: { word: string; stem?: string; context?: string; lang?: string },
  sourceLang: string,
  targetLang: string
): Promise<ExplanationResponse> {
  const sl = sourceLang === "auto" ? item.lang || "en" : sourceLang;
  const tl = targetLang || "uk";

  let translation = "";
  let ipa = "";
  let explanation = "";
  let example = "";

  const fetchTranslationMeta = async () => {
    try {
      const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&dt=md&dt=ex&q=${encodeURIComponent(item.word)}`;
      const transRes = await fetch(transUrl);
      if (transRes.ok) {
        const transData = await transRes.json();
        // 1. Part-of-speech synonyms (dt=bd)
        if (Array.isArray(transData?.[1]) && transData[1].length > 0) {
          const firstPosBlock = transData[1][0];
          if (Array.isArray(firstPosBlock?.[1]) && firstPosBlock[1].length > 0) {
            translation = firstPosBlock[1].slice(0, 3).join(", ");
          }
        }
        // 2. Primary translation (dt=t)
        if (!translation && transData?.[0]?.[0]?.[0]) {
          translation = transData[0][0][0];
        }
        // 3. Fallback definition (dt=md)
        if (Array.isArray(transData?.[12]) && transData[12].length > 0) {
          const defBlock = transData[12][0];
          const pos = defBlock?.[0] ? `(${defBlock[0]}) ` : "";
          const firstDef = defBlock?.[1]?.[0]?.[0];
          if (firstDef) explanation = pos + firstDef;
          const firstDefEx = defBlock?.[1]?.[0]?.[2];
          if (firstDefEx) example = String(firstDefEx).replace(/<\/?[^>]+(>|$)/g, "");
        }
        // 4. Fallback example sentence (dt=ex)
        if (!example && Array.isArray(transData?.[13]?.[0]) && transData[13][0].length > 0) {
          const rawEx = transData[13][0][0]?.[0];
          if (rawEx) example = String(rawEx).replace(/<\/?[^>]+(>|$)/g, "");
        }
      }
    } catch {
      // Fall back to MyMemory below
    }

    if (!translation) {
      try {
        const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(item.word)}&langpair=${sl}|${tl}`;
        const memRes = await fetch(myMemoryUrl);
        if (memRes.ok) {
          const memData = await memRes.json();
          if (memData?.responseData?.translatedText) {
            translation = memData.responseData.translatedText;
          }
        }
      } catch {
        // ignore
      }
    }
  };

  const fetchOpenDictionary = async () => {
    if (sl !== "en") return;
    const candidates = guessClientLemmas(item.word, item.stem);

    for (const candidate of candidates) {
      try {
        const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(candidate)}`;
        const dictRes = await fetch(dictUrl);
        if (!dictRes.ok) continue;

        const dictData = await dictRes.json();
        if (!Array.isArray(dictData) || dictData.length === 0) continue;

        let dictIpa = "";
        let dictExplanation = "";
        let dictExample = "";

        for (const entry of dictData) {
          if (!dictIpa) {
            dictIpa = entry.phonetic || "";
            if (!dictIpa && Array.isArray(entry.phonetics)) {
              const pWithText = entry.phonetics.find((p: any) => p.text);
              if (pWithText) dictIpa = pWithText.text;
            }
          }

          if (Array.isArray(entry.meanings)) {
            for (const m of entry.meanings) {
              const pos = m.partOfSpeech ? `(${m.partOfSpeech}) ` : "";
              if (Array.isArray(m.definitions)) {
                for (const d of m.definitions) {
                  if (!dictExplanation && d.definition) {
                    dictExplanation = pos + d.definition;
                  }
                  if (!dictExample && d.example) {
                    dictExample = d.example;
                  }
                }
              }
            }
          }
        }

        if (dictExplanation || dictIpa) {
          if (dictIpa) ipa = dictIpa;
          if (dictExplanation) explanation = dictExplanation;
          if (dictExample) example = dictExample;
          break;
        }
      } catch {
        // ignore
      }
    }
  };

  await Promise.all([fetchTranslationMeta(), fetchOpenDictionary()]);

  return {
    word: item.word,
    translation: translation || item.word,
    ipa: ipa || "",
    explanation: explanation || "",
    example: example || item.context || "",
  };
}

/**
 * Translates and enriches a batch of words 100% autonomously in the browser.
 */
export async function translateWordsBatch(
  wordsToTranslate: { word: string; stem?: string; context?: string; lang?: string }[],
  sourceLang: string,
  targetLang: string,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<ExplanationResponse[]> {
  const CONCURRENCY = 4;
  const total = wordsToTranslate.length;
  const results: ExplanationResponse[] = [];

  for (let i = 0; i < total; i += CONCURRENCY) {
    if (signal?.aborted) break;
    const chunk = wordsToTranslate.slice(i, i + CONCURRENCY);

    const chunkResults = await Promise.all(
      chunk.map((item) => lookupSingleWordClient(item, sourceLang, targetLang))
    );

    results.push(...chunkResults);
    onProgress(Math.min(i + CONCURRENCY, total), total);

    if (i + CONCURRENCY < total && !signal?.aborted) {
      await sleep(120);
    }
  }

  return results;
}
