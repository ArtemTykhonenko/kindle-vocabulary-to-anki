/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, Word } from "../types";

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

/**
 * Parses Kindle's vocab.db file and returns the list of extracted words and books.
 */
export async function parseKindleVocabDb(file: File): Promise<{ words: Word[]; books: Book[] }> {
  // 1. Ensure SQL.js library script is loaded
  await loadSqlScript();

  // 2. Read the file into an ArrayBuffer and Uint8Array
  const arrayBuffer = await file.arrayBuffer();
  const uInt8Array = new Uint8Array(arrayBuffer);

  // 3. Initialize SQl.js engine
  const initSqlJs = (window as any).initSqlJs;
  if (!initSqlJs) {
    throw new Error("Sql.js library is not loaded properly");
  }

  const SQL = await initSqlJs({
    locateFile: (filename: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${filename}`,
  });

  // 4. Open the SQLite database
  const db = new SQL.Database(uInt8Array);

  try {
    // 5. Query BOOK_INFO table dynamically (supports both 'author' and 'authors' schemas depending on Kindle OS version)
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

      values.forEach((row) => {
        books.push({
          id: idIndex !== -1 ? String(row[idIndex] || "") : "",
          asin: asinIndex !== -1 ? String(row[asinIndex] || "") : "",
          title: titleIndex !== -1 ? String(row[titleIndex] || "Unknown Book") : "Unknown Book",
          author: authorIndex !== -1 ? String(row[authorIndex] || "Unknown Author") : "Unknown Author",
          lang: langIndex !== -1 ? String(row[langIndex] || "en") : "en",
        });
      });
    }

    // 6. Query WORDS joined with LOOKUPS and BOOK_INFO
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

    // Map books for easy lookup
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

      // Set to hold unique word item IDs to avoid dual lookup rows of the same word
      const addedIds = new Set<string>();

      const rowsToProcess = values || valuesRow;

      rowsToProcess.forEach((row) => {
        const id = String(row[wordIdIdx] || "");
        
        // Ensure accurate word parsing. Clean XML tags (some kindle files keep markup like <span class="accent">...</span>)
        let contextText = String(row[contextIdx] || "").trim();
        contextText = contextText.replace(/<\/?[^>]+(>|$)/g, ""); // strip any html tags gracefully

        const bookId = String(row[bookIdIdx] || "");
        const book = booksMap.get(bookId);

        // If a word has multiple lookups, we can aggregate context or prefer the latest lookup
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

    // 7. Calculate word counts per book for rich analytics
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
