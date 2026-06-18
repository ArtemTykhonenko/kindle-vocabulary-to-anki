/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FreeDictResult {
  word: string;
  ipa?: string;
  explanation?: string;
  example?: string;
}

/**
 * Fetches phonetic IPA and English definition for a word without any authentication or API key.
 * Uses the free open public api.dictionaryapi.dev.
 */
export async function lookupFreeDictionary(word: string, context?: string): Promise<FreeDictResult> {
  const cleanWord = word.trim().replace(/[^a-zA-Z']/g, "");
  if (!cleanWord) {
    return { word };
  }

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord.toLowerCase())}`);
    if (!response.ok) {
      throw new Error(`Word not found in free dictionary: status ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Invalid response format from free dictionary");
    }

    const entry = data[0];
    
    // 1. Extract phonetic IPA
    let ipa = entry.phonetic || "";
    if (!ipa && entry.phonetics && Array.isArray(entry.phonetics)) {
      const phoneticWithText = entry.phonetics.find((p: any) => p.text);
      if (phoneticWithText) {
        ipa = phoneticWithText.text;
      }
    }

    // 2. Extract first available definition
    let explanation = "";
    if (entry.meanings && Array.isArray(entry.meanings) && entry.meanings.length > 0) {
      const firstMeaning = entry.meanings[0];
      const partOfSpeech = firstMeaning.partOfSpeech ? `(${firstMeaning.partOfSpeech}) ` : "";
      
      if (firstMeaning.definitions && Array.isArray(firstMeaning.definitions) && firstMeaning.definitions.length > 0) {
        explanation = partOfSpeech + firstMeaning.definitions[0].definition;
      }
    }

    // 3. Extract or fallback to contextual example
    let example = "";
    if (entry.meanings && Array.isArray(entry.meanings)) {
      for (const m of entry.meanings) {
        if (m.definitions && Array.isArray(m.definitions)) {
          const defWithExample = m.definitions.find((d: any) => d.example);
          if (defWithExample) {
            example = defWithExample.example;
            break;
          }
        }
      }
    }

    // Fall back to target context from Kindle if we couldn't find a dictionary example
    if (!example && context) {
      example = context;
    }

    return {
      word,
      ipa: ipa || undefined,
      explanation: explanation || undefined,
      example: example || undefined
    };
  } catch (error) {
    console.warn(`[Free Dictionary API] Failed looking up "${word}":`, error);
    // Return empty placeholders so user can fill them manually
    return {
      word,
      explanation: undefined,
      ipa: undefined,
      example: context || undefined
    };
  }
}
