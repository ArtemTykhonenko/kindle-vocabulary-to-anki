/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Upload, FileCode, CheckCircle, Database, HelpCircle, Loader2, ArrowRight } from "lucide-react";
import { parseKindleVocabDb } from "../utils/sqliteParser";
import { saveBooks, saveWords } from "../utils/db";
import { Book, Word } from "../types";

interface UploadPanelProps {
  onImportComplete: (words: Word[], books: Book[]) => void;
  wordsCount: number;
  onNavigateToManage: () => void;
}

export default function UploadPanel({
  onImportComplete,
  wordsCount,
  onNavigateToManage,
}: UploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    newWords: number;
    updatedWords: number;
    bookCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".db") && file.name !== "vocab.db") {
      setError("Please upload a SQLite database file (e.g. vocab.db).");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessInfo(null);

    try {
      // 1. Client-side parse of local SQLite file
      const { words, books } = await parseKindleVocabDb(file);

      // 2. Save parsed books to local IndexedDB
      await saveBooks(books);

      // 3. Save parsed words checking for existing duplicates elegantly
      const { newCount, updatedCount } = await saveWords(words);

      setSuccessInfo({
        newWords: newCount,
        updatedWords: updatedCount,
        bookCount: books.length,
      });

      // 4. Fire callbacks
      onImportComplete(words, books);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message ||
          "Failed to parse DB. Ensure this is a valid Kindle 'vocab.db' file loaded from /system/vocabulary/vocab.db."
      );
    } finally {
      setIsLoading(false);
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {/* Existing Database Banner */}
      {wordsCount > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-slate-900 text-sm">Workspace Database Active</h3>
              <p className="text-xs text-slate-550">
                You currently have <b>{wordsCount}</b> words saved locally. You can sync or manage them directly.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToManage}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-705 text-white font-bold rounded-lg text-xs transition cursor-pointer select-none shadow-sm hover:shadow hover:scale-[1.01] shrink-0"
          >
            Manage Vocabulary
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Step Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step 1 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex gap-3 text-left">
          <div className="h-6 w-6 rounded bg-slate-200 text-slate-800 flex items-center justify-center font-bold shrink-0 text-xs shadow-sm">
            1
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-900 text-xs">Import Kindle Database File</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Connect your Kindle reader to your computer via USB, locate your dictionary file system, and reload vocabulary words securely.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex gap-3 text-left">
          <div className="h-6 w-6 rounded bg-slate-200 text-slate-800 flex items-center justify-center font-bold shrink-0 text-xs shadow-sm">
            2
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-900 text-xs">Locate Database File</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Open your Kindle root directory and locate the file at:
              <br />
              <code className="bg-slate-250/75 text-slate-705 px-1.5 py-0.5 rounded text-[10px] select-all font-mono font-bold block mt-1.5 border border-slate-200">
                /system/vocabulary/vocab.db
              </code>
            </p>
          </div>
        </div>
      </div>

      {/* Upload Drag & Drop Stage */}
      <div
        id="file_upload_dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-blue-600 bg-blue-50/30 scale-[0.99] shadow-sm"
            : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/55"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept=".db"
        />

        {isLoading ? (
          <div className="space-y-4">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900">Parsing vocab.db file...</h3>
              <p className="text-slate-500 text-xs">Unpacking local tables and loading lookup stems</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-10 w-10 rounded bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mx-auto">
              <Upload className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900">Drag and drop vocab.db here</h3>
              <p className="text-slate-400 text-xs">or click to choose documents folder manually</p>
            </div>
            <div className="inline-flex items-center text-xs text-blue-700 gap-1 font-semibold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              <Database className="h-3 w-3 text-blue-505" />
              SQLite Reader Engine
            </div>
          </div>
        )}
      </div>

      {/* Error Panel */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-1.5 animate-fade-in text-left">
          <h4 className="font-bold text-red-800 text-sm">Error reading database</h4>
          <p className="text-xs text-red-650 leading-relaxed">{error}</p>
          <div className="pt-2 text-xs text-red-700 font-semibold flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            Tip: Kindle system files may be hidden. In macOS Finder, use Cmd + Shift + Dot (.) to show hidden folders.
          </div>
        </div>
      )}

      {/* Success Notifications & Stats */}
      {successInfo && (
        <div className="p-6 bg-slate-900 text-white rounded-xl space-y-4 animate-fade-in text-left shadow-lg border border-slate-800">
          <div className="flex gap-3 items-start">
            <CheckCircle className="h-6 w-6 text-emerald-400 shrink-0" />
            <div className="space-y-1">
              <h3 className="font-bold text-slate-100 text-sm">Database synced successfully!</h3>
              <p className="text-xs text-slate-300">
                Parsed vocabulary lookup keys seamlessly and saved to local IndexedDB index files.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-850">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ebooks Located</div>
              <div className="text-2xl font-extrabold text-white">{successInfo.bookCount}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Words</div>
              <div className="text-2xl font-extrabold text-blue-400">{successInfo.newWords}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duplicates Skipped</div>
              <div className="text-2xl font-extrabold text-emerald-400">{successInfo.updatedWords}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
