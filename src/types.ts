/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Book {
  id: string;
  asin: string;
  title: string;
  author: string;
  lang: string;
  wordCount?: number;
}

export interface Word {
  id: string; // w.id
  word: string;
  stem: string;
  lang: string;
  wordTimestamp: number;
  
  // Book info joined
  bookId?: string;
  bookTitle?: string;
  bookAuthor?: string;
  
  // Lookup context sentence
  context?: string;
  lookupTimestamp?: number;
  
  // Generated AI info
  translation?: string;
  ipa?: string;
  explanation?: string;
  example?: string;
  
  // App status workflow
  status: "new" | "learning" | "learned";
  addedAt: number; // local database timestamp
}

export interface DashboardStats {
  totalWords: number;
  newWordsCount: number;
  learningWordsCount: number;
  learnedWordsCount: number;
  byBook: { title: string; count: number }[];
  frequentWords: { word: string; count: number }[];
  byDate: { date: string; count: number }[];
}
