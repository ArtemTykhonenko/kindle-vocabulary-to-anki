/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, Word } from "../types";

const DB_NAME = "KindleAnkiExporterDB";
const DB_VERSION = 3;

let dbInstance: IDBDatabase | null = null;

export function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open local IndexedDB"));
    };

    request.onsuccess = (event: any) => {
      dbInstance = event.target.result;
      resolve(dbInstance!);
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      
      // Store for books
      if (!db.objectStoreNames.contains("books")) {
        db.createObjectStore("books", { keyPath: "id" });
      }

      // Store for words
      if (!db.objectStoreNames.contains("words")) {
        db.createObjectStore("words", { keyPath: "id" });
      }

      // Store for raw database file
      if (!db.objectStoreNames.contains("dbFile")) {
        db.createObjectStore("dbFile");
      }
    };
  });
}

/**
 * Save books to local DB
 */
export async function saveBooks(books: Book[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("books", "readwrite");
    const store = transaction.objectStore("books");

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    books.forEach((book) => {
      store.put(book);
    });
  });
}

/**
 * Save words to local DB. If duplicate, we preserve existing properties
 * (like status, translation, ipa, etc.) so we don't overwrite Gemini translation work!
 */
export async function saveWords(words: Word[]): Promise<{ newCount: number; updatedCount: number }> {
  const db = await getDB();
  const existingWords = await getAllWords();
  const existingMap = new Map(existingWords.map((w) => [w.id, w]));

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("words", "readwrite");
    const store = transaction.objectStore("words");

    let newCount = 0;
    let updatedCount = 0;

    transaction.oncomplete = () => {
      resolve({ newCount, updatedCount });
    };
    transaction.onerror = () => reject(transaction.error);

    words.forEach((word) => {
      const existing = existingMap.get(word.id);
      if (existing) {
        // Word exists! Preserve work
        const merged: Word = {
          ...word,
          status: existing.status || "new",
          translation: existing.translation || word.translation,
          ipa: existing.ipa || word.ipa,
          explanation: existing.explanation || word.explanation,
          example: existing.example || word.example,
          addedAt: existing.addedAt || Date.now(),
        };
        store.put(merged);
        updatedCount++;
      } else {
        // Word is brand new!
        store.put({
          ...word,
          status: "new",
          addedAt: Date.now(),
        });
        newCount++;
      }
    });
  });
}

/**
 * Get all books
 */
export async function getAllBooks(): Promise<Book[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("books", "readonly");
    const store = transaction.objectStore("books");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all words
 */
export async function getAllWords(): Promise<Word[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("words", "readonly");
    const store = transaction.objectStore("words");
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      // Sort in descending order of lookup timestamp or word addition timestamp
      results.sort((a, b) => {
        const timeA = a.lookupTimestamp || a.wordTimestamp || 0;
        const timeB = b.lookupTimestamp || b.wordTimestamp || 0;
        return timeB - timeA;
      });
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a single word's details
 */
export async function updateWord(word: Word): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("words", "readwrite");
    const store = transaction.objectStore("words");
    const request = store.put(word);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a batch of words
 */
export async function updateWordsBatch(words: Word[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("words", "readwrite");
    const store = transaction.objectStore("words");

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    words.forEach((word) => {
      store.put(word);
    });
  });
}

export async function saveRawDbFile(arrayBuffer: ArrayBuffer): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("dbFile", "readwrite");
    const store = transaction.objectStore("dbFile");
    const request = store.put(arrayBuffer, "rawBinary");

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getRawDbFile(): Promise<ArrayBuffer | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("dbFile", "readonly");
    const store = transaction.objectStore("dbFile");
    const request = store.get("rawBinary");

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all data from local DB
 */
export async function clearAllLocalData(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["books", "words", "dbFile"], "readwrite");
    const booksStore = transaction.objectStore("books");
    const wordsStore = transaction.objectStore("words");
    const dbFileStore = transaction.objectStore("dbFile");

    booksStore.clear();
    wordsStore.clear();
    dbFileStore.clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
