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

/** Parse the documented AI-generated JSON shape into the app's existing Word model. */
export function parseAiVocabularyJson(json: string): Word[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("The file is not valid JSON. Check for missing commas or quotation marks.");
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
  const words = entries.map((entry, index): Word => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Entry ${index + 1} must be a JSON object.`);
    }

    const item = entry as AiVocabularyEntry;
    const word = optionalText(item.word);
    if (!word) throw new Error(`Entry ${index + 1} is missing the required "word" field.`);

    const lang = optionalText(item.lang) || "en";
    const id = `ai:${lang.toLowerCase()}:${word.toLocaleLowerCase()}`;
    if (seen.has(id)) throw new Error(`Duplicate word "${word}" for language "${lang}".`);
    seen.add(id);

    return {
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
    };
  });

  return words;
}
