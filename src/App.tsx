/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  Database,
  Trash2
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

export default function App() {
  // Screen navigation state: "upload" | "manage" | "export"
  const [currentScreen, setCurrentScreen] = useState<"upload" | "manage" | "export">("upload");

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

  const handleImportComplete = (importedWords: Word[], importedBooks: Book[]) => {
    loadDataFromDb();
    setCurrentScreen("manage"); // move to management screen after successful parsing!
  };

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to delete all local data? This action will wipe your local vocabulary builder storage and is irreversible.")) {
      return;
    }
    await clearAllLocalData();
    setWords([]);
    setBooks([]);
    setSelectedBookId(null);
    setCurrentScreen("upload");
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
            <div className="text-[9px] text-slate-400 font-bold select-none uppercase tracking-wider flex items-center gap-1">
              <Database className="h-2.5 w-2.5" />
              Secure Offline Workspace
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status indicators */}
          {loadingStatus ? (
            <div className="flex h-8 items-center gap-2 rounded-full border border-slate-200 px-3 bg-slate-50 text-[11px] font-medium text-slate-500">
              <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
              <span>Checking...</span>
            </div>
          ) : serverOnline ? (
            <div className="flex h-8 items-center gap-2 rounded-full border border-slate-200 px-3 bg-slate-50 text-[11px] font-medium text-slate-600">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>Local Proxy Server Ready</span>
            </div>
          ) : (
            <div className="flex h-8 items-center gap-2 rounded-full border border-blue-200 px-3 bg-blue-50/50 text-[11px] font-medium text-blue-700">
              <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
              <span>Browser Sandbox Mode</span>
            </div>
          )}

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
              onImportComplete={handleImportComplete} 
              wordsCount={words.length}
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
          <div className="max-w-7xl mx-auto px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>Kindle to Anki Card Creation Hub</span>
            <span>© 2026. Processed safely via local IndexedDB.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
