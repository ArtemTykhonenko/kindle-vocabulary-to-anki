/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word } from "../types";
import { renderFront, renderBack } from "./cardTemplates";

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";

export interface AnkiStatus {
  online: boolean;
  error?: string;
}

/**
 * Checks if Anki (with AnkiConnect add-on) is running on the user's local machine.
 */
export async function checkAnkiConnect(): Promise<AnkiStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({ action: "version", version: 6 }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { online: true };
    }
    return { online: false, error: `Invalid response status: ${response.status}` };
  } catch (err: any) {
    return {
      online: false,
      error: "Anki is not running or AnkiConnect add-on (ID: 2055492159) is not installed.",
    };
  }
}

/**
 * Pushes words to Anki via local AnkiConnect API.
 * Ensures the target deck is created first, then adds notes in bulk.
 */
export async function syncWordsToAnki(
  words: Word[],
  deckName: string = "Kindle Vocabulary"
): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
  const result = { successCount: 0, failedCount: 0, errors: [] as string[] };

  try {
    // 1. Create target deck if it doesn't exist
    const createDeckRes = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "createDeck",
        version: 6,
        params: { deck: deckName },
      }),
    });
    
    if (!createDeckRes.ok) {
      throw new Error(`Failed to create deck: ${deckName}`);
    }

    // 1.5. Detect the correct modelName (e.g. "Basic" in English Anki, "Простая" in Russian Anki, etc.)
    let modelName = "Basic";
    try {
      const modelNamesRes = await fetch(ANKI_CONNECT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "modelNames",
          version: 6
        })
      });
      if (modelNamesRes.ok) {
        const modelNamesJSON = await modelNamesRes.json();
        if (modelNamesJSON && Array.isArray(modelNamesJSON.result)) {
          const availableModels = modelNamesJSON.result as string[];
          const candidates = ["Basic", "Простая", "Einfach", "Básico", "Basic (and reversed card)", "Простая (с обратной карточкой)"];
          const found = candidates.find(c => availableModels.includes(c));
          if (found) {
            modelName = found;
          } else {
            // Fallback: look for any name containing common basic words
            const fuzzyFound = availableModels.find(m => {
              const lower = m.toLowerCase();
              return lower.includes("basic") || lower.includes("простая") || lower.includes("einfach") || lower.includes("básico");
            });
            if (fuzzyFound) {
              modelName = fuzzyFound;
            } else if (availableModels.length > 0) {
              modelName = availableModels[0]; // Fallback to first available model
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to retrieve available model names from AnkiConnect, falling back to default 'Basic':", err);
    }

    // 2. Format notes
    const notes = words.map((word) => {
      return {
        deckName: deckName,
        modelName: modelName,
        fields: {
          Front: renderFront(word).trim(),
          Back: renderBack(word).trim(),
        },
        tags: ["kindle_vocab", "kindle_vocab_to_anki"],
      };
    });

    // 3. Send bulk notes adding request via AnkiConnect
    const addNotesRes = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "addNotes",
        version: 6,
        params: { notes },
      }),
    });

    if (!addNotesRes.ok) {
      throw new Error("Failed to call AnkiConnect to add notes");
    }

    const responseJSON = await addNotesRes.json();
    if (responseJSON.error) {
      throw new Error(responseJSON.error);
    }

    const ratings: (number | null)[] = responseJSON.result;
    ratings.forEach((val) => {
      if (val !== null) {
        result.successCount++;
      } else {
        result.failedCount++;
      }
    });
  } catch (err: any) {
    result.errors.push(err.message || String(err));
    result.failedCount = words.length;
  }

  return result;
}
