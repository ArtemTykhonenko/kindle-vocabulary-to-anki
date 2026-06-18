/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word } from "../types";

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
      const frontHTML = `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
          <div style="font-size: 2.2em; font-weight: bold; color: #1e293b; margin-bottom: 8px;">${word.word}</div>
          ${word.ipa ? `<div style="font-size: 1.2em; color: #64748b; font-family: 'Courier New', Courier, monospace;">${word.ipa}</div>` : ""}
          ${word.bookTitle ? `<div style="font-size: 0.8em; color: #94a3b8; margin-top: 15px; font-style: italic;">Book: ${word.bookTitle}</div>` : ""}
        </div>
      `;

      const backHTML = `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 10px; max-width: 500px; margin: 0 auto;">
          <div style="font-size: 1.8em; font-weight: bold; color: #2563eb; margin-bottom: 20px;">${word.translation || "No translation"}</div>
          
          ${
            word.context
              ? `
            <div style="background-color: #f8fafc; border-left: 3px solid #cbd5e1; padding: 12px; margin: 15px 0; text-align: left; border-radius: 4px;">
              <div style="font-size: 0.85em; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; tracking-wide: 0.05em;">Original Kindle Context:</div>
              <div style="font-size: 1em; color: #334155; font-style: italic; line-height: 1.4;">${word.context}</div>
            </div>
            `
              : ""
          }

          ${
            word.explanation
              ? `
            <div style="margin: 15px 0; text-align: left;">
              <span style="font-weight: bold; color: #1e293b; font-size: 0.9em; text-transform: uppercase;">Definition:</span>
              <p style="font-size: 1.05em; color: #334155; margin: 4px 0 0 0; line-height: 1.4;">${word.explanation}</p>
            </div>
            `
              : ""
          }

          ${
            word.example
              ? `
            <div style="margin: 15px 0; text-align: left; background-color: #f0fdf4; border: 1px dashed #bbf7d0; padding: 12px; border-radius: 4px;">
              <span style="font-weight: bold; color: #166534; font-size: 0.85em; text-transform: uppercase;">Usage Example:</span>
              <p style="font-size: 1.05em; color: #14532d; margin: 4px 0 0 0; line-height: 1.4;">${word.example}</p>
            </div>
            `
              : ""
          }
        </div>
      `;

      return {
        deckName: deckName,
        modelName: modelName,
        fields: {
          Front: frontHTML.trim(),
          Back: backHTML.trim(),
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
