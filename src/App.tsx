/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Trash2, Github, RotateCcw, X } from "lucide-react";

// Types
import { Word, Book } from "./types";

// DB Helpers
import {
  getAllBooks,
  getAllWords,
  saveWords,
  saveBooks,
  deleteWordsByIds,
  clearAllLocalData,
} from "./utils/db";

// Panels
import UploadPanel from "./components/UploadPanel";
import VocabularyTable from "./components/VocabularyTable";
import AnkiSyncPanel from "./components/AnkiSyncPanel";
import { SAMPLE_WORDS } from "./utils/sampleData";

export default function App() {
  // Navigation: "upload" | "manage" | "export"
  const [currentScreen, setCurrentScreen] = useState<"upload" | "manage" | "export">("upload");

  // Words and Books states
  const [words, setWords] = useState<Word[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [autoTranslateTrigger, setAutoTranslateTrigger] = useState<number>(0);

  // Inline confirmation state for resetting the entire deck
  const [confirmingReset, setConfirmingReset] = useState<boolean>(false);

  // Undo buffer for bulk deletion
  const [lastDeletedWords, setLastDeletedWords] = useState<Word[] | null>(null);

  // Load from local IndexedDB
  const loadDataFromDb = async () => {
    try {
      const allBooks = await getAllBooks();
      let allWords = await getAllWords();

      // Refresh cached sample demo words if they were stored in an earlier session
      const sampleMap = new Map(SAMPLE_WORDS.map((sw) => [sw.id, sw]));
      let updatedSample = false;
      allWords = allWords.map((w) => {
        const freshSample = sampleMap.get(w.id);
        if (
          freshSample &&
          (w.translation !== freshSample.translation ||
            w.explanation !== freshSample.explanation)
        ) {
          updatedSample = true;
          return {
            ...w,
            translation: freshSample.translation,
            explanation: freshSample.explanation,
          };
        }
        return w;
      });
      if (updatedSample) {
        await saveWords(allWords);
      }

      setBooks(allBooks);
      setWords(allWords);
      return allWords;
    } catch (err) {
      console.warn("Storage read notice:", err);
      return [];
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const storedWords = await loadDataFromDb();
        if (storedWords.length > 0) {
          setCurrentScreen("manage");
        } else {
          setCurrentScreen("upload");
        }
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  // When words are loaded from Kindle vocab.db or Custom Word List
  const handleWordsLoaded = async (
    loadedWords: Word[],
    loadedBooks: Book[],
    shouldAutoTranslate: boolean = false
  ) => {
    try {
      if (loadedBooks.length > 0) {
        await saveBooks(loadedBooks);
      }
      await saveWords(loadedWords);
      await loadDataFromDb();
      setCurrentScreen("manage");
      if (shouldAutoTranslate) {
        setAutoTranslateTrigger((prev) => prev + 1);
      }
    } catch (err: any) {
      console.error(err);
      setWords((prev) => [...loadedWords, ...prev]);
      if (loadedBooks.length > 0) {
        setBooks(loadedBooks);
      }
      setCurrentScreen("manage");
      if (shouldAutoTranslate) {
        setAutoTranslateTrigger((prev) => prev + 1);
      }
    }
  };

  // Add custom single word
  const handleAddCustomWord = async (newWord: Word, shouldTranslate: boolean = false) => {
    try {
      await saveWords([newWord]);
      await loadDataFromDb();
      if (shouldTranslate) {
        setAutoTranslateTrigger((prev) => prev + 1);
      }
    } catch {
      setWords((prev) => [newWord, ...prev]);
    }
  };

  // Bulk or single delete words
  const handleDeleteWords = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    const removed = words.filter((w) => idSet.has(w.id));
    if (removed.length > 0) {
      setLastDeletedWords(removed);
    }

    setWords((prev) => prev.filter((w) => !idSet.has(w.id)));

    try {
      await deleteWordsByIds(ids);
      await loadDataFromDb();
    } catch (err) {
      console.error("Failed to delete words from IndexedDB:", err);
    }
  };

  // Undo last bulk deletion
  const handleUndoDelete = async () => {
    if (!lastDeletedWords || lastDeletedWords.length === 0) return;
    const toRestore = lastDeletedWords;
    setLastDeletedWords(null);
    setWords((prev) => [...toRestore, ...prev]);
    try {
      await saveWords(toRestore);
      await loadDataFromDb();
    } catch (err) {
      console.error("Failed to restore words:", err);
    }
  };

  // Clear data / Start fresh
  const handleExecuteResetDeck = async () => {
    setConfirmingReset(false);
    setLastDeletedWords(null);
    try {
      await clearAllLocalData();
    } catch {
      // ignore
    }
    setWords([]);
    setBooks([]);
    setSelectedBookId(null);
    setCurrentScreen("upload");
  };

  return (
    <div className="min-h-screen bg-[#080A10] text-slate-100 font-sans flex flex-col antialiased relative overflow-x-hidden selection:bg-violet-500 selection:text-white">
      {/* Ambient Aurora Backdrop Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-32 w-[540px] h-[420px] rounded-full bg-violet-600/18 blur-[130px]" />
        <div className="absolute -top-32 -right-32 w-[540px] h-[420px] rounded-full bg-cyan-500/15 blur-[135px]" />
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[350px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      {/* TOP BAR: 3 ZONES */}
      <header className="relative z-30 flex h-16 items-center justify-between gap-6 border-b border-white/10 px-6 sm:px-8 bg-[#0C0F19]/85 backdrop-blur-xl sticky top-0">
        {/* Zone 1: Brand Wordmark with Book Icon */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setCurrentScreen(words.length > 0 ? "manage" : "upload");
          }}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group"
        >
          <img
            src="/favicon.svg"
            alt="kindle2anki book logo"
            className="h-9 w-9 rounded-xl object-cover shadow-[0_0_15px_rgba(139,92,246,0.25)] transition group-hover:scale-105"
          />
          <span className="text-base font-extrabold tracking-tight text-white">
            kindle
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              2anki
            </span>
            <span className="text-slate-500 font-medium text-xs">.online</span>
          </span>
        </a>

        {/* Zone 2: Step Navigation Pill */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-[#131724] rounded-xl border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setCurrentScreen("upload")}
            className={`px-4 py-1.5 font-semibold rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer ${
              currentScreen === "upload"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_18px_rgba(124,58,237,0.45)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            1. Add Words
          </button>
          <button
            type="button"
            disabled={words.length === 0}
            onClick={() => setCurrentScreen("manage")}
            className={`px-4 py-1.5 font-semibold rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer tabular-nums disabled:opacity-35 disabled:cursor-not-allowed ${
              currentScreen === "manage"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_18px_rgba(124,58,237,0.45)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            2. Translate & Edit {words.length > 0 ? `(${words.length})` : ""}
          </button>
          <button
            type="button"
            disabled={words.length === 0}
            onClick={() => setCurrentScreen("export")}
            className={`px-4 py-1.5 font-semibold rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
              currentScreen === "export"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_18px_rgba(124,58,237,0.45)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            3. Export
          </button>
        </nav>

        {/* Zone 3: Start New Deck & GitHub */}
        <div className="flex items-center gap-2.5 shrink-0">
          {words.length > 0 && (
            <>
              {confirmingReset ? (
                <div className="inline-flex items-center gap-2 bg-red-950/60 border border-red-500/40 px-3 py-1 rounded-xl">
                  <span className="text-[11px] font-semibold text-red-200 whitespace-nowrap">
                    Clear all {words.length} words?
                  </span>
                  <button
                    type="button"
                    onClick={handleExecuteResetDeck}
                    className="px-2.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold rounded-md transition cursor-pointer whitespace-nowrap"
                  >
                    Yes, Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(false)}
                    className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                    aria-label="Cancel clear"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-[#141826] hover:bg-[#1C2133] border border-white/10 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0"
                  title="Clear current deck and start over"
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Start New Deck</span>
                </button>
              )}
            </>
          )}

          <a
            href="https://github.com/ArtemTykhonenko/kindle-vocabulary-to-anki"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate-300 hover:text-white bg-[#141826] hover:bg-[#1C2133] border border-white/10 rounded-xl transition"
            title="GitHub Repository"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* UNDO DELETION BANNER */}
      {lastDeletedWords && lastDeletedWords.length > 0 && (
        <div className="relative z-20 bg-[#151928] border-b border-violet-500/30 text-slate-100 px-4 py-2.5 text-xs flex items-center justify-center gap-4 shadow-lg animate-fade-in">
          <span className="font-medium tabular-nums">
            Removed <b className="text-white">{lastDeletedWords.length}</b>{" "}
            {lastDeletedWords.length === 1 ? "word" : "words"}.
          </span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="inline-flex items-center gap-1 px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg transition cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={() => setLastDeletedWords(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* MAIN CONTENT VIEWPORT */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0">
        <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8">
          {isInitializing ? (
            <div className="py-20 text-center text-slate-500 text-xs">Loading vocabulary...</div>
          ) : (
            <>
              {currentScreen === "upload" && (
                <UploadPanel
                  onWordsLoaded={handleWordsLoaded}
                  existingCount={words.length}
                  onNavigateToManage={() => setCurrentScreen("manage")}
                />
              )}

              {currentScreen === "manage" && (
                <VocabularyTable
                  words={words}
                  books={books}
                  selectedBookId={selectedBookId}
                  onSelectBook={setSelectedBookId}
                  onRefreshWords={loadDataFromDb}
                  onNavigateToExport={() => setCurrentScreen("export")}
                  onAddCustomWord={handleAddCustomWord}
                  onDeleteWords={handleDeleteWords}
                  autoTranslateTrigger={autoTranslateTrigger}
                />
              )}

              {currentScreen === "export" && (
                <AnkiSyncPanel
                  words={words}
                  onRefreshWords={loadDataFromDb}
                />
              )}
            </>
          )}
        </div>

        {/* Subtle Dark Footer */}
        <footer className="border-t border-white/8 py-4 mt-auto bg-[#080A10]/60 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>kindle2anki.online · Kindle Vocabulary & Custom Words to Anki Flashcards</span>
            <span>100% Browser-Based · Audio Pronunciation · Dictionary Translations</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
