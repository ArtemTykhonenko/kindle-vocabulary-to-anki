import { Word } from "../types";

type AiVocabularyEntry = {
  word?: unknown;
  lang?: unknown;
  translation?: unknown;
  ipa?: unknown;
  explanation?: unknown;
  example?: unknown;
  context?: unknown;
};

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * Strips markdown code fences if present (e.g. ```json ... ```)
 */
export function cleanCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceRegex = /^```(?:json|txt)?\s*([\s\S]*?)\s*```$/i;
  const match = trimmed.match(fenceRegex);
  return match ? match[1].trim() : trimmed;
}

/** Parse AI-generated JSON into Word items. */
export function parseAiVocabularyJson(json: string): Word[] {
  const cleaned = cleanCodeFences(json);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("The text is not valid JSON. Check for missing commas or quotation marks.");
  }

  const entries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { words?: unknown }).words)
      ? (parsed as { words: unknown[] }).words
      : null;

  if (!entries) {
    throw new Error('Expected a JSON array of words or an object with a "words" array.');
  }
  if (entries.length === 0) throw new Error("The JSON file contains no words.");

  const seen = new Set<string>();
  const words: Word[] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const item = entry as AiVocabularyEntry;
    const word = optionalText(item.word);
    if (!word) continue;

    const lang = optionalText(item.lang) || "en";
    const id = `word:${lang.toLowerCase()}:${word.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);

    words.push({
      id,
      word,
      stem: word,
      lang,
      wordTimestamp: Date.now(),
      translation: optionalText(item.translation),
      ipa: optionalText(item.ipa),
      explanation: optionalText(item.explanation),
      example: optionalText(item.example),
      context: optionalText(item.context),
      status: "new",
      addedAt: Date.now(),
    });
  }

  if (words.length === 0) {
    throw new Error("No valid words found in JSON.");
  }

  return words;
}

/**
 * Parses plain text lists of words (one per line, with optional translations like `word - translation`).
 */
export function parsePlainTextWords(text: string): Word[] {
  const lines = text.split(/\r?\n/);
  const seen = new Set<string>();
  const words: Word[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for delimiter like " - ", " : ", " = ", "\t"
    let wordPart = line;
    let translationPart: string | undefined = undefined;

    const separatorMatch = line.match(/^([^\-:=–—\t]+)\s*[\-:=–—\t]\s*(.+)$/);
    if (separatorMatch) {
      wordPart = separatorMatch[1].trim();
      translationPart = separatorMatch[2].trim();
    } else if (line.includes(",")) {
      // Multiple comma-separated words on a line
      const commaParts = line.split(",").map((s) => s.trim()).filter(Boolean);
      for (const cp of commaParts) {
        const cleanW = cp.replace(/^[\d\.\-\*\•\)]+\s*/, "").trim(); // strip bullets/numbers
        if (cleanW && cleanW.length < 60) {
          const id = `word:en:${cleanW.toLowerCase()}`;
          if (!seen.has(id)) {
            seen.add(id);
            words.push({
              id,
              word: cleanW,
              stem: cleanW,
              lang: "en",
              wordTimestamp: Date.now(),
              status: "new",
              addedAt: Date.now(),
            });
          }
        }
      }
      continue;
    }

    // Strip leading numbering or bullet points like "1. ", "- ", "* "
    wordPart = wordPart.replace(/^[\d\.\-\*\•\)]+\s*/, "").trim();
    if (!wordPart || wordPart.length > 80) continue;

    const id = `word:en:${wordPart.toLowerCase()}`;
    if (!seen.has(id)) {
      seen.add(id);
      words.push({
        id,
        word: wordPart,
        stem: wordPart,
        lang: "en",
        wordTimestamp: Date.now(),
        translation: translationPart || undefined,
        status: "new",
        addedAt: Date.now(),
      });
    }
  }

  return words;
}

/**
 * Universal parser: tries JSON first (with or without markdown fences),
 * and falls back seamlessly to line-by-line / text parsing.
 */
export function parseAnyWordsInput(input: string): Word[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Input is empty. Please enter or paste some words.");
  }

  // Attempt JSON parsing if it looks like JSON
  const cleaned = cleanCodeFences(trimmed);
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    try {
      return parseAiVocabularyJson(cleaned);
    } catch {
      // Fall through to plain text parsing
    }
  }

  // Try plain text parsing
  const words = parsePlainTextWords(trimmed);
  if (words.length === 0) {
    throw new Error("Could not extract any words. Please check your text format.");
  }

  return words;
}
