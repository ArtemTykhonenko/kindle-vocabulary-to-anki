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
    .replace(/^[«"'"“`‘]+|[»"'"”`’]+$/g, "") // Remove surrounding quotes
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "") // Remove punctuation
    .replace(/\s+/g, " "); // Normalize whitespace
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
  
  const escapedStem = stem.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const escapedFull = cleanWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  
  try {
    const pattern = `\\b(${escapedFull}|${escapedStem}[a-z]*)\\b`;
    const regex = new RegExp(pattern, "gi");
    return text.replace(regex, '<span class="anki-highlight">$1</span>');
  } catch (err) {
    return text;
  }
}

/**
 * Renders the HTML structure and styles for the front of the flashcard.
 */
export function renderFront(word: Word): string {
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
  .anki-word {
    font-size: 1.85em;
    font-weight: 800;
    color: #1e1b4b;
    letter-spacing: -0.025em;
    margin: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
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
  <h1 class="anki-word">${word.word}</h1>
  ${word.ipa ? `<div class="anki-ipa">${word.ipa}</div>` : ""}
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
  <div class="anki-header">${word.word} ${word.ipa ? `• ${word.ipa}` : ""}</div>
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
