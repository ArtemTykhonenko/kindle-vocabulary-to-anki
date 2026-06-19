/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  Database,
  Trash2,
  Github
} from "lucide-react";

// Types
import { Word, Book } from "./types";

// DB and API Helpers
import { getAllBooks, getAllWords, clearAllLocalData } from "./utils/db";
import { getBackendStatus } from "./utils/api";

// Panels
import UploadPanel from "./components/UploadPanel";
import VocabularyTable from "./components/VocabularyTable";
import AnkiSyncPanel from "./components/AnkiSyncPanel";
import ImportPreviewPanel from "./components/ImportPreviewPanel";

export default function App() {
  // Screen navigation state: "upload" | "preview" | "manage" | "export"
  const [currentScreen, setCurrentScreen] = useState<"upload" | "preview" | "manage" | "export">("upload");

  // Temporary staging state for preview
  const [stagedKindleData, setStagedKindleData] = useState<{
    words: Word[];
    books: Book[];
    arrayBuffer: ArrayBuffer | null;
  } | null>(null);

  const [stagedAnkiWords, setStagedAnkiWords] = useState<Set<string> | null>(null);

  // Words and Books states
  const [words, setWords] = useState<Word[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  // Connection states
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Load from db
  const loadDataFromDb = async () => {
    try {
      const allBooks = await getAllBooks();
      const allWords = await getAllWords();
      setBooks(allBooks);
      setWords(allWords);
      return allWords;
    } catch (err) {
      console.error("Failed to load local IndexedDB metrics:", err);
      return [];
    }
  };

  // Check server status
  const checkStatus = async () => {
    setLoadingStatus(true);
    try {
      const status = await getBackendStatus();
      setServerOnline(status.status === "ok");
    } catch (err) {
      console.error("Backend health status check failed:", err);
      setServerOnline(false);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const allWords = await loadDataFromDb();
      if (allWords.length > 0) {
        setCurrentScreen("manage");
      } else {
        setCurrentScreen("upload");
      }
      await checkStatus();
    };
    init();
  }, []);

  const handleContinueToPreview = (
    kindleData: { words: Word[]; books: Book[]; arrayBuffer: ArrayBuffer | null },
    ankiWords: Set<string> | null
  ) => {
    setStagedKindleData(kindleData);
    setStagedAnkiWords(ankiWords);
    setCurrentScreen("preview");
  };

  const handleConfirmImport = async (
    selectedWords: Word[],
    selectedBooks: Book[],
    rawDb: ArrayBuffer | null
  ) => {
    try {
      const { saveBooks, saveWords, saveRawDbFile } = await import("./utils/db");
      
      // 1. Save books
      await saveBooks(selectedBooks);

      // 2. Save words checking duplicates elegantly
      await saveWords(selectedWords);

      // 3. Save raw database binary for export back to Kindle
      if (rawDb) {
        await saveRawDbFile(rawDb);
      }

      // Reload database values and navigate to manage screen
      await loadDataFromDb();
      setCurrentScreen("manage");
      
      // Clear staging states
      setStagedKindleData(null);
      setStagedAnkiWords(null);
    } catch (err: any) {
      console.error(err);
      alert("Failed to save imported vocabulary to database: " + (err.message || String(err)));
    }
  };

  const handleCancelImport = () => {
    setStagedKindleData(null);
    setStagedAnkiWords(null);
    setCurrentScreen("upload");
  };

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to delete all local data? This action will wipe your local vocabulary builder storage and is irreversible.")) {
      return;
    }
    try {
      await clearAllLocalData();
      setWords([]);
      setBooks([]);
      setSelectedBookId(null);
      setCurrentScreen("upload");
    } catch (err: any) {
      console.error("Failed to reset database:", err);
      alert("Failed to reset database: " + (err.message || String(err)));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col antialiased">
      {/* TOP NAVBAR */}
      <header className="flex h-16 items-center justify-between border-b border-slate-200 px-6 sm:px-8 bg-white shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Kindle to Anki Logo"
            className="h-8 w-8 rounded-lg object-cover shadow-sm select-none"
          />
          <div className="space-y-0.5">
            <h1 className="text-sm font-extrabold tracking-tight text-slate-900">Kindle to Anki</h1>
            <div className="text-[10px] text-slate-400 font-semibold select-none">
              Generate flashcards for Anki
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* GitHub Link */}
          <a
            href="https://github.com/ArtemTykhonenko/kindle-vocabulary-to-anki"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-md transition text-xs font-semibold select-none cursor-pointer border border-transparent"
            title="View on GitHub"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>

          {/* Clear Database trigger */}
          {words.length > 0 && (
            <button
              onClick={handleClearData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-md transition text-xs font-semibold select-none cursor-pointer border border-transparent hover:border-red-100"
              title="Wipe vocabulary lists"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset Database</span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN WORKSPACE WRAPPER */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-y-auto">
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
          {currentScreen === "upload" && (
            <UploadPanel 
              onContinue={handleContinueToPreview} 
              wordsCount={words.length}
              onNavigateToManage={() => setCurrentScreen("manage")}
            />
          )}

          {currentScreen === "preview" && stagedKindleData && (
            <ImportPreviewPanel
              words={stagedKindleData.words}
              books={stagedKindleData.books}
              rawDb={stagedKindleData.arrayBuffer}
              ankiWords={stagedAnkiWords}
              onConfirmImport={handleConfirmImport}
              onCancel={handleCancelImport}
            />
          )}

          {currentScreen === "manage" && (
            <VocabularyTable
              words={words}
              books={books}
              selectedBookId={selectedBookId}
              onSelectBook={setSelectedBookId}
              onRefreshWords={loadDataFromDb}
              serverOnline={serverOnline}
              onNavigateToExport={() => setCurrentScreen("export")}
              onNavigateToUpload={() => setCurrentScreen("upload")}
            />
          )}

          {currentScreen === "export" && (
            <AnkiSyncPanel 
              words={words} 
              onRefreshWords={loadDataFromDb} 
              onNavigateToManage={() => setCurrentScreen("manage")}
            />
          )}
        </div>

        {/* Footer credits bar */}
        <footer className="bg-white border-t border-slate-200/60 py-4 mt-auto shrink-0">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 text-center text-[11px] text-slate-400 font-medium">
            © 2026 Kindle to Anki
          </div>
        </footer>
      </main>
    </div>
  );
}
