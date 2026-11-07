/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, Word } from "../types";
import { getRawDbFile, getAllWords, saveRawDbFile } from "./db";

/**
 * Loads the sql.js library dynamically from CDNJS.
 * This avoids bundling heavy SQLite WASM binaries in the build.
 */
function loadSqlScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).initSqlJs) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load sql.js parser script from CDNJS"));
    document.head.appendChild(script);
  });
}

async function getSqlEngine() {
  await loadSqlScript();
  const initSqlJs = (window as any).initSqlJs;
  if (!initSqlJs) {
    throw new Error("Sql.js library is not loaded properly");
  }
  return await initSqlJs({
    locateFile: (filename: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${filename}`,
  });
}

/**
 * Parses Kindle's vocab.db file, stores the raw binary for later cleaning/syncing,
 * and returns the list of extracted words and books.
 */
export async function parseKindleVocabDb(file: File): Promise<{ words: Word[]; books: Book[] }> {
  const SQL = await getSqlEngine();

  const arrayBuffer = await file.arrayBuffer();
  try {
    await saveRawDbFile(arrayBuffer);
  } catch {
    // Non-fatal if IndexedDB raw save fails
  }

  const uInt8Array = new Uint8Array(arrayBuffer);
  const db = new SQL.Database(uInt8Array);

  try {
    const booksQuery = "SELECT * FROM BOOK_INFO";
    const booksResult = db.exec(booksQuery);
    const books: Book[] = [];

    if (booksResult.length > 0) {
      const { columns, values } = booksResult[0];
      const asinIndex = columns.indexOf("asin");
      const titleIndex = columns.indexOf("title");
      let authorIndex = columns.indexOf("author");
      if (authorIndex === -1) {
        authorIndex = columns.indexOf("authors");
      }
      const langIndex = columns.indexOf("lang");
      const idIndex = columns.indexOf("id");

      values.forEach((row: any[]) => {
        books.push({
          id: idIndex !== -1 ? String(row[idIndex] || "") : "",
          asin: asinIndex !== -1 ? String(row[asinIndex] || "") : "",
          title: titleIndex !== -1 ? String(row[titleIndex] || "Unknown Book") : "Unknown Book",
          author: authorIndex !== -1 ? String(row[authorIndex] || "Unknown Author") : "Unknown Author",
          lang: langIndex !== -1 ? String(row[langIndex] || "en") : "en",
        });
      });
    }

    const wordsQuery = `
      SELECT 
        w.id AS word_id,
        w.word AS word,
        w.stem AS stem,
        w.lang AS lang,
        w.timestamp AS word_timestamp,
        l.book_key AS book_id,
        l.usage AS context,
        l.timestamp AS lookup_timestamp
      FROM WORDS w
      LEFT JOIN LOOKUPS l ON w.id = l.word_key
      ORDER BY l.timestamp DESC
    `;

    const wordsResult = db.exec(wordsQuery);
    const words: Word[] = [];
    const booksMap = new Map(books.map((b) => [b.id, b]));

    if (wordsResult.length > 0) {
      const { columns, valuesRow = [], values } = wordsResult[0];

      const wordIdIdx = columns.indexOf("word_id");
      const wordIdx = columns.indexOf("word");
      const stemIdx = columns.indexOf("stem");
      const langIdx = columns.indexOf("lang");
      const wordTsIdx = columns.indexOf("word_timestamp");
      const bookIdIdx = columns.indexOf("book_id");
      const contextIdx = columns.indexOf("context");
      const lookupTsIdx = columns.indexOf("lookup_timestamp");

      const addedIds = new Set<string>();
      const rowsToProcess = values || valuesRow;

      rowsToProcess.forEach((row: any[]) => {
        const id = String(row[wordIdIdx] || "");
        let contextText = String(row[contextIdx] || "").trim();
        contextText = contextText.replace(/<\/?[^>]+(>|$)/g, "");

        const bookId = String(row[bookIdIdx] || "");
        const book = booksMap.get(bookId);

        if (id && !addedIds.has(id)) {
          addedIds.add(id);
          words.push({
            id,
            word: String(row[wordIdx] || "").trim(),
            stem: String(row[stemIdx] || "").trim(),
            lang: String(row[langIdx] || "en"),
            wordTimestamp: Number(row[wordTsIdx] || 0),
            bookId: bookId || undefined,
            bookTitle: book?.title,
            bookAuthor: book?.author,
            context: contextText || undefined,
            lookupTimestamp: Number(row[lookupTsIdx] || 0),
            status: "new",
            addedAt: Date.now(),
          });
        }
      });
    }

    books.forEach((book) => {
      book.wordCount = words.filter((w) => w.bookId === book.id).length;
    });

    db.close();
    return { words, books };
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * Creates a clean or synced Kindle vocab.db SQLite binary.
 * - mode === "empty": Wipes all LOOKUPS and WORDS so Kindle Vocabulary Builder becomes 100% empty.
 * - mode === "sync_remaining": Keeps only words currently present in the user's deck (removes deleted words).
 * Works both with an uploaded vocab.db or generates a fresh Kindle-compatible vocab.db schema.
 */
export async function buildCleanedKindleDb(
  mode: "empty" | "sync_remaining" = "empty",
  customBuffer?: ArrayBuffer | null
): Promise<Uint8Array> {
  const SQL = await getSqlEngine();
  const rawDb = customBuffer || (await getRawDbFile());

  const db = rawDb ? new SQL.Database(new Uint8Array(rawDb)) : new SQL.Database();

  try {
    if (!rawDb) {
      // Initialize standard Kindle Vocabulary Builder SQLite schema
      db.run(`
        CREATE TABLE IF NOT EXISTS WORDS (
          id TEXT PRIMARY KEY NOT NULL,
          word TEXT,
          stem TEXT,
          lang TEXT,
          category INTEGER DEFAULT 0,
          timestamp INTEGER DEFAULT 0,
          profileid TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS LOOKUPS (
          id TEXT PRIMARY KEY NOT NULL,
          word_key TEXT,
          book_key TEXT,
          dict_key TEXT,
          pos TEXT,
          usage TEXT,
          timestamp INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS BOOK_INFO (
          id TEXT PRIMARY KEY NOT NULL,
          asin TEXT,
          guid TEXT,
          lang TEXT,
          title TEXT,
          authors TEXT
        );
        CREATE TABLE IF NOT EXISTS DICT_INFO (
          id TEXT PRIMARY KEY NOT NULL,
          asin TEXT,
          langin TEXT,
          langout TEXT
        );
        CREATE TABLE IF NOT EXISTS METADATA (
          id TEXT PRIMARY KEY NOT NULL,
          dsname TEXT,
          profileid TEXT,
          intval INTEGER,
          strval TEXT
        );
        CREATE TABLE IF NOT EXISTS VERSION (
          dsname TEXT PRIMARY KEY NOT NULL,
          version INTEGER
        );
        INSERT OR IGNORE INTO VERSION (dsname, version) VALUES ('WORDS', 100);
        INSERT OR IGNORE INTO VERSION (dsname, version) VALUES ('LOOKUPS', 100);
        INSERT OR IGNORE INTO VERSION (dsname, version) VALUES ('BOOK_INFO', 100);
        INSERT OR IGNORE INTO VERSION (dsname, version) VALUES ('METADATA', 100);
      `);
    } else if (mode === "empty") {
      db.run("DELETE FROM LOOKUPS;");
      db.run("DELETE FROM WORDS;");
      try {
        db.run("VACUUM;");
      } catch {
        // Ignore if VACUUM is unsupported in memory state
      }
    } else {
      const remainingWords = await getAllWords();
      const remainingIds = remainingWords.map((w) => w.id.replace(/'/g, "''"));

      if (remainingIds.length === 0) {
        db.run("DELETE FROM LOOKUPS;");
        db.run("DELETE FROM WORDS;");
      } else {
        const idsString = remainingIds.map((id) => `'${id}'`).join(",");
        db.run(`DELETE FROM WORDS WHERE id NOT IN (${idsString});`);
        db.run(`DELETE FROM LOOKUPS WHERE word_key NOT IN (${idsString});`);
      }
    }

    const binary = db.export();
    db.close();
    return binary;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * Triggers a browser download for a generated/cleaned Kindle vocab.db SQLite file.
 */
export function downloadKindleVocabFile(binary: Uint8Array, filename = "vocab.db"): void {
  const blob = new Blob([binary], { type: "application/x-sqlite3" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
