/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Upload, FileCode, CheckCircle, Database, HelpCircle, Loader2, ArrowRight, Usb, FolderOpen, X, AlertCircle } from "lucide-react";
import { parseKindleVocabDb } from "../utils/sqliteParser";
import { parseAnkiExportFile } from "../utils/ankiParser";
import { Book, Word } from "../types";

interface UploadPanelProps {
  onContinue: (
    kindleData: { words: Word[]; books: Book[]; arrayBuffer: ArrayBuffer | null },
    ankiWords: Set<string> | null
  ) => void;
  wordsCount: number;
  onNavigateToManage: () => void;
}

export default function UploadPanel({
  onContinue,
  wordsCount,
  onNavigateToManage,
}: UploadPanelProps) {
  // Staged files states
  const [kindleData, setKindleData] = useState<{
    words: Word[];
    books: Book[];
    arrayBuffer: ArrayBuffer | null;
    fileName: string;
  } | null>(null);

  const [ankiWords, setAnkiWords] = useState<Set<string> | null>(null);
  const [ankiFileName, setAnkiFileName] = useState<string | null>(null);

  // Loading & Error states
  const [kindleLoading, setKindleLoading] = useState(false);
  const [ankiLoading, setAnkiLoading] = useState(false);
  const [kindleError, setKindleError] = useState<string | null>(null);
  const [ankiError, setAnkiError] = useState<string | null>(null);

  // Drag states
  const [isKindleDragging, setIsKindleDragging] = useState(false);
  const [isAnkiDragging, setIsAnkiDragging] = useState(false);

  // File input refs
  const kindleInputRef = useRef<HTMLInputElement>(null);
  const ankiInputRef = useRef<HTMLInputElement>(null);

  // Process Kindle DB file
  const processKindleFile = async (file: File) => {
    if (!file.name.endsWith(".db") && file.name !== "vocab.db") {
      setKindleError("Please upload a SQLite database file (e.g. vocab.db).");
      return;
    }

    setKindleLoading(true);
    setKindleError(null);
    setKindleData(null);

    try {
      // 1. Client-side parse of local SQLite file
      const { words, books } = await parseKindleVocabDb(file);

      // 2. Read array buffer
      const arrayBuffer = await file.arrayBuffer();

      setKindleData({
        words,
        books,
        arrayBuffer,
        fileName: file.name,
      });
    } catch (err: any) {
      console.error(err);
      setKindleError(
        err.message ||
          "Failed to parse DB. Ensure this is a valid Kindle 'vocab.db' file loaded from /system/vocabulary/vocab.db."
      );
    } finally {
      setKindleLoading(false);
    }
  };

  // Process Anki export file
  const processAnkiFile = async (file: File) => {
    if (!file.name.endsWith(".txt") && !file.name.endsWith(".csv") && !file.name.endsWith(".tsv")) {
      setAnkiError("Please upload a plain text, CSV, or TSV file exported from Anki.");
      return;
    }

    setAnkiLoading(true);
    setAnkiError(null);
    setAnkiWords(null);
    setAnkiFileName(null);

    try {
      const text = await file.text();
      const parsedSet = parseAnkiExportFile(text);
      
      setAnkiWords(parsedSet);
      setAnkiFileName(file.name);
    } catch (err: any) {
      console.error(err);
      setAnkiError(err.message || "Failed to parse Anki file. Please ensure it is a text export.");
    } finally {
      setAnkiLoading(false);
    }
  };

  const handleRemoveAnkiFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnkiWords(null);
    setAnkiFileName(null);
    setAnkiError(null);
    if (ankiInputRef.current) {
      ankiInputRef.current.value = "";
    }
  };

  // Kindle Drag Handlers
  const handleKindleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsKindleDragging(true);
  };
  const handleKindleDragLeave = () => {
    setIsKindleDragging(false);
  };
  const handleKindleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsKindleDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processKindleFile(files[0]);
    }
  };

  // Anki Drag Handlers
  const handleAnkiDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsAnkiDragging(true);
  };
  const handleAnkiDragLeave = () => {
    setIsAnkiDragging(false);
  };
  const handleAnkiDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsAnkiDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processAnkiFile(files[0]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Existing Database Banner */}
      {wordsCount > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in font-sans">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-md shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div className="text-left font-sans">
              <h3 className="font-bold text-slate-900 text-sm">Workspace Database Active</h3>
              <p className="text-xs text-slate-500">
                You currently have <b>{wordsCount}</b> words saved locally. You can sync or manage them directly.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToManage}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs transition cursor-pointer select-none shadow-sm hover:shadow hover:scale-[1.01] shrink-0"
          >
            Manage Vocabulary
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Step Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl flex gap-4 text-left shadow-sm hover:shadow-md transition">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Usb className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Step 1</div>
            <h4 className="font-bold text-slate-900 text-sm">Connect Kindle & Locate DB</h4>
            <p className="text-xs text-slate-550 leading-relaxed">
              Connect your Kindle via USB and find the database file at:
              <code className="bg-slate-50 text-slate-700 px-1.5 py-0.5 rounded text-[10px] select-all font-mono font-bold block mt-1 border border-slate-200">
                /system/vocabulary/vocab.db
              </code>
            </p>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl flex gap-4 text-left shadow-sm hover:shadow-md transition">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
            <FileCode className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Step 2 (Optional)</div>
            <h4 className="font-bold text-slate-900 text-sm">Export Anki Deck to Text</h4>
            <p className="text-xs text-slate-550 leading-relaxed">
              In Anki, click <span className="font-semibold text-slate-700">Export</span>, choose <span className="font-semibold text-slate-700">Notes in Plain Text (.txt)</span>, and save the file to match against Kindle duplicates.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Drag & Drop Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kindle File Box */}
        <div className="space-y-2 text-left">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kindle Vocabulary Database</label>
          <div
            onDragOver={handleKindleDragOver}
            onDragLeave={handleKindleDragLeave}
            onDrop={handleKindleDrop}
            onClick={() => kindleInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all min-h-[190px] flex flex-col justify-center items-center ${
              isKindleDragging
                ? "border-slate-900 bg-slate-100/60 scale-[0.99] shadow-sm"
                : kindleData
                ? "border-slate-300 bg-slate-50/30 hover:bg-slate-50/60"
                : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/55"
            }`}
          >
            <input
              type="file"
              ref={kindleInputRef}
              onChange={async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                  await processKindleFile(e.target.files[0]);
                }
              }}
              className="hidden"
              accept=".db"
            />

            {kindleLoading ? (
              <div className="space-y-3">
                <Loader2 className="h-8 w-8 text-slate-900 animate-spin mx-auto" />
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Parsing vocab.db...</h3>
                  <p className="text-slate-500 text-[10px]">Unpacking local tables and loading stems</p>
                </div>
              </div>
            ) : kindleData ? (
              <div className="space-y-3">
                <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center mx-auto border border-slate-950">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm truncate max-w-[240px] mx-auto">
                    {kindleData.fileName}
                  </h4>
                  <p className="text-xs text-slate-550 mt-1">
                    Detected <b>{kindleData.words.length}</b> words and <b>{kindleData.books.length}</b> books.
                  </p>
                  <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-bold rounded-full font-sans">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Ready to Preview
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mx-auto shadow-sm">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Drag and drop vocab.db here</h3>
                  <p className="text-slate-400 text-xs">or click to browse your folders</p>
                </div>
                <div className="inline-flex items-center text-[10px] text-slate-700 gap-1 font-semibold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  <Database className="h-2.5 w-2.5 text-slate-550" />
                  SQLite Engine Required
                </div>
              </div>
            )}
          </div>

          {/* Kindle Error */}
          {kindleError && (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-750 flex items-start gap-2.5 animate-fade-in font-sans">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-bold">Error reading Kindle database</h5>
                <p className="leading-relaxed">{kindleError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Anki File Box */}
        <div className="space-y-2 text-left">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Anki Export File (Optional)
          </label>
          <div
            onDragOver={handleAnkiDragOver}
            onDragLeave={handleAnkiDragLeave}
            onDrop={handleAnkiDrop}
            onClick={() => ankiInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all min-h-[190px] flex flex-col justify-center items-center relative ${
              isAnkiDragging
                ? "border-slate-900 bg-slate-100/60 scale-[0.99] shadow-sm"
                : ankiWords
                ? "border-slate-300 bg-slate-50/30 hover:bg-slate-50/60"
                : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/55"
            }`}
          >
            <input
              type="file"
              ref={ankiInputRef}
              onChange={async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                  await processAnkiFile(e.target.files[0]);
                }
              }}
              className="hidden"
              accept=".txt,.csv,.tsv"
            />

            {ankiLoading ? (
              <div className="space-y-3">
                <Loader2 className="h-8 w-8 text-slate-900 animate-spin mx-auto" />
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Parsing Anki file...</h3>
                  <p className="text-slate-500 text-[10px]">Scanning text columns for vocabulary items</p>
                </div>
              </div>
            ) : ankiWords ? (
              <div className="space-y-3">
                {/* Remove button */}
                <button
                  onClick={handleRemoveAnkiFile}
                  className="absolute top-3 right-3 p-1 text-slate-450 hover:text-slate-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                  title="Remove Anki file"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mx-auto shadow-sm">
                  <FileCode className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm truncate max-w-[240px] mx-auto">
                    {ankiFileName}
                  </h4>
                  <p className="text-xs text-slate-550 mt-1">
                    Imported <b>{ankiWords.size}</b> unique words from Anki.
                  </p>
                  <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 bg-indigo-50 text-indigo-805 border border-indigo-150 text-[10px] font-bold rounded-full font-sans">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                    Loaded successfully
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mx-auto shadow-sm">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Drag & drop Anki export here</h3>
                  <p className="text-slate-400 text-xs">or click to select .txt / .csv file</p>
                </div>
                <div className="inline-flex items-center text-[10px] text-slate-700 gap-1 font-semibold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  <FileCode className="h-2.5 w-2.5 text-slate-550" />
                  Notes in Plain Text (.txt)
                </div>
              </div>
            )}
          </div>

          {/* Anki Error */}
          {ankiError && (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-750 flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-bold">Error reading Anki export</h5>
                <p className="leading-relaxed">{ankiError}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Continue button */}
      {kindleData && (
        <div className="flex justify-end pt-4 border-t border-slate-200 animate-fade-in">
          <button
            onClick={() => onContinue(kindleData, ankiWords)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-sm transition cursor-pointer select-none shadow-md hover:shadow-lg hover:scale-[1.01]"
          >
            <span>Continue to Import Preview</span>
            <ArrowRight className="h-4.5 w-4.5" />
          </button>
        </div>
      )}
    </div>
  );
}
