/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import {
  BookOpen,
  FileText,
  Upload,
  Loader2,
  ArrowRight,
  Usb,
  AlertCircle,
  Play
} from "lucide-react";
import { parseKindleVocabDb } from "../utils/sqliteParser";
import { parseAnyWordsInput } from "../utils/aiVocabularyParser";
import { SAMPLE_WORDS, SAMPLE_KINDLE_BOOKS } from "../utils/sampleData";
import { Book, Word } from "../types";

interface UploadPanelProps {
  onWordsLoaded: (words: Word[], books: Book[], shouldAutoTranslate?: boolean) => void;
  existingCount: number;
  onNavigateToManage: () => void;
}

export default function UploadPanel({
  onWordsLoaded,
  existingCount,
  onNavigateToManage,
}: UploadPanelProps) {
  // Mode: "kindle" | "text"
  const [activeTab, setActiveTab] = useState<"kindle" | "text">("kindle");

  // Kindle Upload States
  const [kindleLoading, setKindleLoading] = useState(false);
  const [kindleError, setKindleError] = useState<string | null>(null);
  const [isKindleDragging, setIsKindleDragging] = useState(false);
  const kindleInputRef = useRef<HTMLInputElement>(null);

  // Custom Word List Input States
  const [rawTextWords, setRawTextWords] = useState("");
  const [autoTranslateOnImport, setAutoTranslateOnImport] = useState(true);
  const [textError, setTextError] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  // Handle Kindle vocab.db
  const handleProcessKindleFile = async (file: File) => {
    if (!file.name.endsWith(".db") && file.name !== "vocab.db") {
      setKindleError("Please choose your Kindle 'vocab.db' file.");
      return;
    }

    setKindleLoading(true);
    setKindleError(null);

    try {
      const { words, books } = await parseKindleVocabDb(file);

      if (words.length === 0) {
        throw new Error("No words found in this Kindle database file.");
      }

      onWordsLoaded(words, books, true);
    } catch (err: any) {
      console.error(err);
      setKindleError(
        err.message ||
          "Could not read database. Please make sure this is a valid Kindle 'vocab.db' file."
      );
    } finally {
      setKindleLoading(false);
    }
  };

  // Handle Custom Word List
  const handleImportPlainWords = () => {
    setTextError(null);
    if (!rawTextWords.trim()) {
      setTextError("Please enter or paste at least one word.");
      return;
    }

    setTextLoading(true);
    try {
      const parsedWords = parseAnyWordsInput(rawTextWords);
      onWordsLoaded(parsedWords, [], autoTranslateOnImport);
    } catch (err: any) {
      setTextError(err.message || "Could not parse word list.");
    } finally {
      setTextLoading(false);
    }
  };

  // Quick Sample Preloader
  const handleLoadSampleData = () => {
    onWordsLoaded(SAMPLE_WORDS, SAMPLE_KINDLE_BOOKS, false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-7 py-2">
      {/* Existing deck resume notice */}
      {existingCount > 0 && (
        <div className="flex items-center justify-between p-4 sm:px-5 bg-[#111522]/90 border border-white/10 rounded-2xl shadow-lg">
          <div className="text-left space-y-0.5">
            <div className="text-xs font-bold text-white tabular-nums">
              Active Deck · {existingCount} words
            </div>
            <div className="text-[11px] text-slate-400">
              Return to your current deck or import additional words below.
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToManage}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-[0_0_16px_rgba(124,58,237,0.4)] transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Open Deck</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="text-center space-y-3 pt-1">
        <div className="text-xs font-semibold text-indigo-400 tracking-wide">
          Kindle Vocabulary & Custom Word Lists → Ready-to-Study Cards
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white text-balance">
          Turn any words into{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Anki Flashcards
          </span>
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
          Upload your Kindle{" "}
          <code className="font-mono text-xs bg-white/10 border border-white/10 px-1.5 py-0.5 rounded text-slate-200">
            vocab.db
          </code>{" "}
          or paste any word list. We automatically translate every word and add IPA phonetics, definitions, and examples.
        </p>
      </div>

      {/* 2-Card Source Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className={`rounded-2xl p-[1px] transition-all ${
            activeTab === "kindle"
              ? "bg-gradient-to-r from-violet-500/85 via-indigo-500/60 to-cyan-400/85 shadow-[0_0_28px_-6px_rgba(34,211,238,0.28)]"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab("kindle")}
            className="w-full h-full flex items-start gap-3.5 p-4 rounded-[15px] bg-[#101420] text-left transition cursor-pointer"
          >
            <div className="h-11 w-11 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.18)] flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-white">Kindle vocab.db</div>
              <p className="text-xs text-slate-400 leading-snug">
                Import words & original book quotes directly from your Kindle e-reader
              </p>
            </div>
          </button>
        </div>

        <div
          className={`rounded-2xl p-[1px] transition-all ${
            activeTab === "text"
              ? "bg-gradient-to-r from-violet-500/85 via-indigo-500/60 to-cyan-400/85 shadow-[0_0_28px_-6px_rgba(34,211,238,0.28)]"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab("text")}
            className="w-full h-full flex items-start gap-3.5 p-4 rounded-[15px] bg-[#101420] text-left transition cursor-pointer"
          >
            <div className="h-11 w-11 rounded-xl bg-indigo-500/15 border border-indigo-400/40 text-indigo-300 shadow-[0_0_16px_rgba(99,102,241,0.2)] flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-white">Custom Word List</div>
              <p className="text-xs text-slate-400 leading-snug">
                Paste any list of words for automatic translation, IPA & examples
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* TAB 1: KINDLE VOCAB.DB */}
      {activeTab === "kindle" && (
        <div className="space-y-4 animate-fade-in text-left">
          {/* Main Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsKindleDragging(true);
            }}
            onDragLeave={() => setIsKindleDragging(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsKindleDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                await handleProcessKindleFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => kindleInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-9 sm:p-11 text-center cursor-pointer transition-all ${
              isKindleDragging
                ? "border-cyan-400 bg-indigo-950/30 scale-[0.99]"
                : "border-indigo-500/35 bg-[#0D101B]/90 hover:border-indigo-400/60 hover:bg-[#111524]"
            }`}
          >
            <input
              type="file"
              ref={kindleInputRef}
              onChange={async (e) => {
                if (e.target.files && e.target.files[0]) {
                  await handleProcessKindleFile(e.target.files[0]);
                }
              }}
              className="hidden"
              accept=".db"
            />

            {kindleLoading ? (
              <div className="space-y-3 py-4">
                <Loader2 className="h-8 w-8 text-violet-400 animate-spin mx-auto" />
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-white">Reading Kindle database...</div>
                  <div className="text-xs text-slate-400">
                    Extracting looked-up words and book sentences
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 py-2">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(124,58,237,0.5)]">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-base font-bold text-white">
                    Drop your Kindle{" "}
                    <code className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded text-xs font-mono">
                      vocab.db
                    </code>{" "}
                    here
                  </div>
                  <p className="text-xs text-slate-400">or click to browse from your computer</p>
                </div>
              </div>
            )}
          </div>

          {/* Kindle Error Alert */}
          {kindleError && (
            <div className="p-3.5 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <div className="space-y-0.5">
                <div className="font-bold text-white">Could not load database</div>
                <p>{kindleError}</p>
              </div>
            </div>
          )}

          {/* 3 Step Instruction Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 bg-[#101420] border border-white/10 rounded-2xl text-left space-y-1.5">
              <div className="text-xs font-bold text-indigo-400">01. Connect Kindle</div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Usb className="h-3.5 w-3.5 text-indigo-400" />
                <span>Plug in via USB</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Connect your Kindle to your computer with a USB cable.
              </p>
            </div>

            <div className="p-4 bg-[#101420] border border-white/10 rounded-2xl text-left space-y-1.5">
              <div className="text-xs font-bold text-indigo-400">02. Find vocab.db</div>
              <div className="text-xs font-bold text-white">Hidden system folder</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Open Kindle drive:
                <code className="block mt-1 font-mono text-[10px] bg-white/5 p-1 rounded text-slate-300 select-all border border-white/10">
                  system/vocabulary/vocab.db
                </code>
              </p>
            </div>

            <div className="p-4 bg-[#101420] border border-white/10 rounded-2xl text-left space-y-1.5">
              <div className="text-xs font-bold text-indigo-400">03. Translate & Export</div>
              <div className="text-xs font-bold text-white">Ready for Anki</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                We translate your words, add IPA & examples, and let you clean your Kindle.
              </p>
            </div>
          </div>

          {/* Single subtle Demo Strip */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#101420]/70 border border-white/8 rounded-2xl text-xs">
            <span className="text-slate-400">
              Don’t have your Kindle connected right now?
            </span>
            <button
              type="button"
              onClick={handleLoadSampleData}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/8 hover:bg-white/14 text-white font-semibold rounded-xl border border-white/10 transition cursor-pointer whitespace-nowrap"
            >
              <Play className="h-3 w-3 fill-current text-indigo-400" />
              <span>Try Demo Deck (5 cards)</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM WORD LIST */}
      {activeTab === "text" && (
        <div className="p-6 bg-[#101420] border border-white/10 rounded-2xl shadow-xl space-y-5 animate-fade-in text-left">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="word-list-input" className="text-xs font-bold text-slate-200">
                Paste words (one per line, comma-separated, or{" "}
                <code className="font-mono text-indigo-400">word - translation</code>)
              </label>
              <button
                type="button"
                onClick={() =>
                  setRawTextWords("serendipity\nubiquitous\nmeticulous\nephemeral\nresilience")
                }
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                Fill example words
              </button>
            </div>
            <textarea
              id="word-list-input"
              rows={6}
              value={rawTextWords}
              onChange={(e) => setRawTextWords(e.target.value)}
              placeholder={`serendipity\nubiquitous\nmeticulous\nephemeral - недовговічний`}
              className="w-full text-xs font-mono p-3.5 border border-white/10 rounded-xl bg-[#0B0E17] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition resize-y"
            />
          </div>

          {/* Auto-translate toggle */}
          <label className="flex items-center gap-3 p-3.5 bg-[#151928] border border-white/10 rounded-xl cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoTranslateOnImport}
              onChange={(e) => setAutoTranslateOnImport(e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500 h-4 w-4 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-bold text-white">
                Auto-translate words on import
              </span>
              <span className="text-slate-400 block text-[11px]">
                Automatically adds translation, IPA phonetics, definition & usage example
              </span>
            </div>
          </label>

          {textError && (
            <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{textError}</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleImportPlainWords}
              disabled={textLoading || !rawTextWords.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 via-indigo-500 to-teal-400 hover:opacity-95 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition shadow-[0_0_20px_rgba(45,212,191,0.25)] cursor-pointer whitespace-nowrap"
            >
              {textLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>
                    {autoTranslateOnImport ? "Import & Translate" : "Import Words"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
