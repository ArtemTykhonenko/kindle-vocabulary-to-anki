/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word } from "../types";

/**
 * Normalizes a sentence by removing surrounding quotes, punctuation, and extra whitespace
 * to ensure robust matching and prevent duplication.
 */
function normalizeSentence(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .trim()
    .toLowerCase()
    .replace(/^[«"'"“`‘]+|[»"'"”`’]+$/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Wraps occurrences of the word (or its stem) in the text with a highlight span.
 */
function highlightWord(text: string | undefined | null, word: string): string {
  if (!text) return "";
  if (!word) return text;

  const cleanWord = word.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  let stem = cleanWord;

  if (cleanWord.length > 4) {
    if (cleanWord.endsWith("ed")) stem = cleanWord.slice(0, -2);
    else if (cleanWord.endsWith("ing")) stem = cleanWord.slice(0, -3);
    else if (cleanWord.endsWith("s")) stem = cleanWord.slice(0, -1);
  }

  const escapedStem = stem.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const escapedFull = cleanWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

  try {
    const pattern = `\\b(${escapedFull}|${escapedStem}[a-z]*)\\b`;
    const regex = new RegExp(pattern, "gi");
    return text.replace(regex, '<span class="anki-highlight">$1</span>');
  } catch {
    return text;
  }
}

/**
 * Plays real human dictionary MP3 pronunciation (Google/Oxford CDN -> Youdao Dictionary MP3)
 * with fallback to Web Speech API if offline and voices are available.
 */
export function playWordAudio(wordText: string, stemText?: string, lang: string = "en"): void {
  if (typeof window === "undefined") return;
  const rawWord = (wordText || "").trim();
  if (!rawWord) return;

  const rawStem = (stemText || rawWord).trim().toLowerCase();
  const cleanLower = rawWord.toLowerCase();
  const oxfordWordUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(cleanLower)}--_us_1.mp3`;
  const oxfordStemUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(rawStem)}--_us_1.mp3`;
  const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(rawWord)}&type=2`;

  const fallbackSpeech = () => {
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(rawWord);
        u.lang = lang.length === 2 ? `${lang}-${lang.toUpperCase()}` : lang || "en-US";
        u.rate = 0.92;
        window.speechSynthesis.speak(u);
      } catch {
        // Ignore speech errors
      }
    }
  };

  try {
    const a = new Audio(oxfordWordUrl);
    a.onerror = () => {
      const b = new Audio(oxfordStemUrl);
      b.onerror = () => {
        const c = new Audio(youdaoUrl);
        c.onerror = fallbackSpeech;
        c.play().catch(fallbackSpeech);
      };
      b.play().catch(() => {
        const c = new Audio(youdaoUrl);
        c.onerror = fallbackSpeech;
        c.play().catch(fallbackSpeech);
      });
    };
    a.play().catch(() => {
      a.onerror?.(new Event("error"));
    });
  } catch {
    fallbackSpeech();
  }
}

/**
 * Generates an inline onclick handler that works inside Anki Desktop (QtWebEngine),
 * AnkiMobile, and AnkiDroid.
 *
 * Why previous speechSynthesis failed in Anki Desktop:
 * In Anki's QtWebEngine, `window.speechSynthesis` is defined (truthy), so `if (window.speechSynthesis)`
 * always ran, but `speechSynthesis.getVoices()` is empty `[]` in QtWebEngine, producing zero sound.
 * Playing real MP3 audio from Oxford/Google CDN (`ssl.gstatic.com`) with fallback to Youdao MP3
 * works directly inside Anki's WebView.
 */
function buildInlineSpeakAttr(wordText: string, stemText?: string, lang: string = "en"): string {
  const rawWord = (wordText || "").trim();
  const rawStem = (stemText || rawWord).trim().toLowerCase();
  const encodedWord = encodeURIComponent(rawWord.toLowerCase());
  const encodedStem = encodeURIComponent(rawStem);
  const safeWordJs = rawWord.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "");
  const safeLang = (lang || "en").replace(/[^a-zA-Z-]/g, "");
  const bcp47 = safeLang === "en" ? "en-US" : safeLang;

  const oxfordWordUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodedWord}--_us_1.mp3`;
  const oxfordStemUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodedStem}--_us_1.mp3`;
  const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(rawWord)}&type=2`;

  return [
    `var a=new Audio('${oxfordWordUrl}');`,
    `a.onerror=function(){`,
    `var b=new Audio('${oxfordStemUrl}');`,
    `b.onerror=function(){`,
    `var c=new Audio('${youdaoUrl}');`,
    `c.onerror=function(){if(window.speechSynthesis){window.speechSynthesis.cancel();var u=new SpeechSynthesisUtterance('${safeWordJs}');u.lang='${bcp47}';window.speechSynthesis.speak(u);}};`,
    `c.play();`,
    `};`,
    `b.play();`,
    `};`,
    `a.play();`
  ].join("");
}

const SPEAKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;

/**
 * Renders the HTML structure and styles for the front of the flashcard.
 */
export function renderFront(word: Word): string {
  const speakOnClick = buildInlineSpeakAttr(word.word, word.stem, word.lang);
  const html = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap');
  
  .anki-card {
    font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(135deg, #f0f4ff 0%, #f8fafc 100%);
    color: #1e293b;
    border: 1px solid #dbe2f4;
    border-radius: 16px;
    padding: 32px 24px;
    box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.05), 0 4px 6px -2px rgba(79, 70, 229, 0.05);
    max-width: 480px;
    width: 95%;
    margin: 20px auto;
    text-align: center;
    box-sizing: border-box;
  }
  .anki-word-row {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .anki-word {
    font-size: 1.85em;
    font-weight: 800;
    color: #1e1b4b;
    letter-spacing: -0.025em;
    margin: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .anki-audio-btn {
    background: rgba(79, 70, 229, 0.08);
    border: 1px solid rgba(79, 70, 229, 0.18);
    color: #4f46e5;
    border-radius: 10px;
    padding: 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }
  .anki-audio-btn:hover {
    background: rgba(79, 70, 229, 0.16);
  }
  .anki-ipa {
    font-size: 1.1em;
    color: #4f46e5;
    font-weight: 500;
    margin-top: 10px;
    background-color: rgba(79, 70, 229, 0.06);
    border: 1px solid rgba(79, 70, 229, 0.1);
    padding: 4px 14px;
    border-radius: 9999px;
    display: inline-block;
  }
  .anki-book {
    font-size: 0.8em;
    color: #64748b;
    margin-top: 24px;
    font-style: italic;
    font-weight: 500;
  }
  @media (prefers-color-scheme: dark) {
    .anki-card {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #f1f5f9;
      border-color: #334155;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    }
    .anki-word {
      color: #ffffff;
    }
    .anki-audio-btn {
      background: rgba(165, 180, 252, 0.12);
      border-color: rgba(165, 180, 252, 0.25);
      color: #a5b4fc;
    }
    .anki-ipa {
      color: #a5b4fc;
      background-color: rgba(165, 180, 252, 0.1);
      border-color: rgba(165, 180, 252, 0.15);
    }
    .anki-book {
      color: #94a3b8;
    }
  }
</style>
<div class="anki-card">
  <div class="anki-word-row">
    <h1 class="anki-word">${word.word}</h1>
    <button type="button" class="anki-audio-btn" title="Pronounce" onclick="${speakOnClick}">${SPEAKER_SVG}</button>
  </div>
  ${word.ipa ? `<div><div class="anki-ipa">${word.ipa}</div></div>` : ""}
  ${word.bookTitle ? `<div class="anki-book">Book: ${word.bookTitle}</div>` : ""}
</div>
  `;
  return html.replace(/\s+/g, " ").trim();
}

/**
 * Renders the HTML structure and styles for the back of the flashcard.
 */
export function renderBack(word: Word): string {
  const contextNorm = normalizeSentence(word.context);
  const exampleNorm = normalizeSentence(word.example);
  const showExample = word.example && exampleNorm !== contextNorm;

  const highlightedContext = highlightWord(word.context, word.word);
  const highlightedExample = highlightWord(word.example, word.word);
  const speakOnClick = buildInlineSpeakAttr(word.word, word.stem, word.lang);

  const html = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap');

  .anki-card {
    font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(135deg, #f0f4ff 0%, #f8fafc 100%);
    color: #1e293b;
    border: 1px solid #dbe2f4;
    border-radius: 16px;
    padding: 32px 24px;
    box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.05), 0 4px 6px -2px rgba(79, 70, 229, 0.05);
    max-width: 480px;
    width: 95%;
    margin: 20px auto;
    text-align: left;
    box-sizing: border-box;
  }
  .anki-header {
    font-size: 1.15em;
    color: #64748b;
    font-weight: 600;
    margin: 0 0 6px 0;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .anki-audio-btn {
    background: rgba(79, 70, 229, 0.08);
    border: 1px solid rgba(79, 70, 229, 0.18);
    color: #4f46e5;
    border-radius: 8px;
    padding: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .anki-translation {
    font-size: 1.8em;
    font-weight: 800;
    color: #4f46e5;
    margin: 0 0 24px 0;
    text-align: center;
    letter-spacing: -0.02em;
    line-height: 1.2;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .anki-label {
    font-size: 0.72em;
    font-weight: 800;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 20px 0 6px 0;
  }
  .anki-context {
    background-color: #fefce8;
    border-left: 3px solid #ca8a04;
    padding: 12px;
    border-radius: 0 8px 8px 0;
    font-style: italic;
    color: #713f12;
    line-height: 1.5;
    font-size: 0.95em;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  }
  .anki-explanation {
    background-color: #faf5ff;
    border-left: 3px solid #a855f7;
    padding: 12px;
    border-radius: 0 8px 8px 0;
    color: #3b0764;
    line-height: 1.5;
    font-size: 0.95em;
    margin: 0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  }
  .anki-example {
    background-color: #f0fdf4;
    border-left: 3px solid #22c55e;
    padding: 12px;
    border-radius: 0 8px 8px 0;
    color: #14532d;
    line-height: 1.5;
    font-size: 0.95em;
    margin: 0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  }
  .anki-highlight {
    color: #4f46e5;
    font-weight: 700;
    background-color: rgba(79, 70, 229, 0.08);
    padding: 0 4px;
    border-radius: 4px;
  }
  .anki-book {
    font-size: 0.75em;
    color: #94a3b8;
    margin-top: 24px;
    font-style: italic;
    font-weight: 500;
    text-align: center;
  }
  @media (prefers-color-scheme: dark) {
    .anki-card {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #f1f5f9;
      border-color: #334155;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    }
    .anki-header {
      color: #94a3b8;
    }
    .anki-audio-btn {
      background: rgba(165, 180, 252, 0.12);
      border-color: rgba(165, 180, 252, 0.25);
      color: #a5b4fc;
    }
    .anki-translation {
      color: #818cf8;
    }
    .anki-label {
      color: #94a3b8;
    }
    .anki-context {
      background-color: rgba(202, 138, 4, 0.15);
      border-left-color: #facc15;
      color: #fef08a;
    }
    .anki-explanation {
      background-color: rgba(88, 28, 135, 0.15);
      border-left-color: #c084fc;
      color: #f3e8ff;
    }
    .anki-example {
      background-color: rgba(6, 78, 59, 0.25);
      border-left-color: #4ade80;
      color: #d1fae5;
    }
    .anki-highlight {
      color: #818cf8;
      background-color: rgba(129, 140, 248, 0.15);
    }
    .anki-book {
      color: #64748b;
    }
  }
</style>
<div class="anki-card">
  <div class="anki-header">
    <span>${word.word} ${word.ipa ? `• ${word.ipa}` : ""}</span>
    <button type="button" class="anki-audio-btn" title="Pronounce" onclick="${speakOnClick}">${SPEAKER_SVG}</button>
  </div>
  <div class="anki-translation">${word.translation || "No translation"}</div>
  
  ${word.context ? `
    <div class="anki-label">Original Kindle Context</div>
    <div class="anki-context">${highlightedContext}</div>
  ` : ""}

  ${word.explanation ? `
    <div class="anki-label">Definition</div>
    <div class="anki-explanation">${word.explanation}</div>
  ` : ""}

  ${showExample ? `
    <div class="anki-label">Usage Example</div>
    <div class="anki-example">${highlightedExample}</div>
  ` : ""}
  
  ${word.bookTitle ? `
    <div class="anki-book">From: ${word.bookTitle}</div>
  ` : ""}
</div>
  `;
  return html.replace(/\s+/g, " ").trim();
}
