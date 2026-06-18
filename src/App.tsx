/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Sidebar as SidebarIcon,
  BookOpen,
  Layers,
  RefreshCw,
  FolderOpen,
  LayoutDashboard,
  CloudLightning,
  Sparkles,
  Award,
  ChevronRight,
  Database,
  Trash2,
  AlertCircle,
  TrendingDown
} from "lucide-react";

// Types
import { Word, Book } from "./types";

// DB and API Helpers
import { getAllBooks, getAllWords, clearAllLocalData } from "./utils/db";
import { getBackendStatus } from "./utils/api";

// Panels
import DashboardPanel from "./components/DashboardPanel";
import UploadPanel from "./components/UploadPanel";
import VocabularyTable from "./components/VocabularyTable";
import AnkiSyncPanel from "./components/AnkiSyncPanel";

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<string>("dashboard");

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
    } catch (err) {
      console.error("Failed to load local IndexedDB metrics:", err);
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
    loadDataFromDb();
    checkStatus();
  }, []);

  const handleImportComplete = (importedWords: Word[], importedBooks: Book[]) => {
    loadDataFromDb();
    setActiveTab("dashboard"); // move to dashboard after successful parsing!
  };

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to delete all local data? This action will wipe your local vocabulary builder storage and is irreversible.")) {
      return;
    }
    await clearAllLocalData();
    setWords([]);
    setBooks([]);
    setSelectedBookId(null);
    setActiveTab("upload");
  };

  const handleSelectBookFromDashboard = (bookId: string) => {
    setSelectedBookId(bookId);
    setActiveTab("vocabulary");
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 flex flex-col md:flex-row antialiased">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50 flex flex-col">
        {/* Sidebar Brand Header */}
        <div className="h-16 flex items-center border-b border-slate-200 px-6 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
              K
            </div>
            <div className="space-y-0.5">
              <h1 className="text-sm font-extrabold tracking-tight text-slate-900">KindleSync</h1>
              <div className="text-[9px] text-slate-400 font-bold select-none uppercase tracking-wider flex items-center gap-1">
                <Database className="h-2.5 w-2.5" />
                Secure Workspace
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 p-4">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition cursor-pointer select-none ${
              activeTab === "dashboard"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <LayoutDashboard className={`h-4 w-4 ${activeTab === "dashboard" ? "text-blue-600" : "text-slate-400"}`} />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab("vocabulary")}
            className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition cursor-pointer select-none ${
              activeTab === "vocabulary"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Layers className={`h-4 w-4 ${activeTab === "vocabulary" ? "text-blue-600" : "text-slate-400"}`} />
            <span className="flex-1 text-left">My Vocabulary</span>
            {words.length > 0 && (
              <span className="text-[11px] px-2 py-0.2 bg-slate-100 text-slate-600 rounded font-mono font-bold">
                {words.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("sync")}
            className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition cursor-pointer select-none ${
              activeTab === "sync"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Award className={`h-4 w-4 ${activeTab === "sync" ? "text-blue-600" : "text-slate-400"}`} />
            Anki Sync Center
          </button>

          <div className="pt-4 border-t border-slate-200/60 mt-4 space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Import Tool</div>
            <button
              onClick={() => setActiveTab("upload")}
              className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition cursor-pointer select-none ${
                activeTab === "upload"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <FolderOpen className={`h-4 w-4 ${activeTab === "upload" ? "text-blue-600" : "text-slate-400"}`} />
              <span className="flex-1 text-left">Upload vocab.db</span>
              {books.length > 0 && (
                <span className="text-[11px] px-2 py-0.2 bg-slate-100 text-slate-600 rounded font-mono font-bold">
                  {books.length}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* Sidebar Footer Details / Security Notice */}
        <div className="mt-auto p-4 border-t border-slate-200">
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2">
            <h4 className="font-semibold text-[10px] text-slate-400 uppercase tracking-wider">Local Sandboxed</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Your SQLite database is parsed completely offline in your browser. Translations use server-side proxies to shield variables.
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE WRAPPER */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Main Content Workspace Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 px-6 sm:px-8 bg-white shrink-0">
          <h1 className="text-base font-semibold text-slate-900 capitalize">
            {activeTab === "dashboard" && "Vocabulary Dashboard"}
            {activeTab === "vocabulary" && "My Vocabulary List"}
            {activeTab === "sync" && "Anki Sync Center"}
            {activeTab === "upload" && "Import Database"}
          </h1>

          <div className="flex items-center gap-4">
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
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-md transition text-xs font-semibold select-none cursor-pointer border border-transparent hover:border-red-100"
                title="Wipe vocabulary lists"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Reset Database
              </button>
            )}
          </div>
        </header>

        {/* WORKSPACE VIEW CONTENT MOUNT POINT */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white space-y-6">
          {activeTab === "dashboard" && (
            <DashboardPanel
              words={words}
              books={books}
              onSelectBook={handleSelectBookFromDashboard}
              onSelectTab={setActiveTab}
            />
          )}

          {activeTab === "vocabulary" && (
            <VocabularyTable
              words={words}
              books={books}
              selectedBookId={selectedBookId}
              onSelectBook={setSelectedBookId}
              onRefreshWords={loadDataFromDb}
              serverOnline={serverOnline}
            />
          )}

          {activeTab === "sync" && (
            <AnkiSyncPanel words={words} onRefreshWords={loadDataFromDb} />
          )}

          {activeTab === "upload" && (
            <UploadPanel onImportComplete={handleImportComplete} />
          )}
        </div>

        {/* Footer credits bar */}
        <footer className="bg-slate-50 border-t border-slate-200 py-4 shrink-0">
          <div className="px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>Kindle to Anki Card Creation Hub</span>
            <span>© 2026. Processed safely via local IndexedDB.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
