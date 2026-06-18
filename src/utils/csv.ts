/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Word } from "../types";

/**
 * Escapes a field for CSV according to RFC 4180 rules.
 * Wrapping fields in double quotes and escaping inner double quotes as double-double-quotes "".
 */
export function escapeCsvField(field: string | undefined | null): string {
  if (!field) return '""';
  const clean = field.replace(/"/g, '""');
  return `"${clean}"`;
}

/**
 * Exports words as a clean CSV string and triggers a browser download.
 * Columns: Word, Translation, IPA, Example, Explanation, Book, Context
 */
export function exportToCsv(words: Word[], filename: string = "kindle_anki_export.csv"): void {
  const headers = ["Word", "Translation", "IPA", "Example", "Explanation", "Book Title", "Original Kindle Context"];
  
  const rows = words.map((w) => [
    escapeCsvField(w.word),
    escapeCsvField(w.translation),
    escapeCsvField(w.ipa),
    escapeCsvField(w.example),
    escapeCsvField(w.explanation),
    escapeCsvField(w.bookTitle),
    escapeCsvField(w.context)
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  
  // Use UTF-8 BOM so Russian characters and other Non-ASCII UTF-8 characters render perfectly in Excel or Google Sheets
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
