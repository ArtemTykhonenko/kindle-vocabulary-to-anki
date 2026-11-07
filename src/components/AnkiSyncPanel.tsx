/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Word } from "../types";
import { checkAnkiConnect, syncWordsToAnki, AnkiStatus } from "../utils/ankiConnect";
import { exportToTsvStyled, exportToTsv } from "../utils/csv";
import { playWordAudio } from "../utils/cardTemplates";
import { buildCleanedKindleDb, downloadKindleVocabFile } from "../utils/sqliteParser";
import {
  Download,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Volume2,
  BookOpen,
  ArrowRightCircle,
  Eraser,
  Loader2,
  Copy,
  Check
} from "lucide-react";

interface AnkiSyncPanelProps {
  words: Word[];
  onRefreshWords: () => void;
}

export default function AnkiSyncPanel({
  words,
  onRefreshWords,
}: AnkiSyncPanelProps) {
  // Ready words count
  const readyWords = words.filter((w) => w.translation);
  const wordsToExport = readyWords.length > 0 ? readyWords : words;

  const ipaCount = wordsToExport.filter((w) => w.ipa).length;
  const exampleCount = wordsToExport.filter((w) => w.example || w.context).length;

  // Kindle Cleaner State
  const [isCleaningKindle, setIsCleaningKindle] = useState(false);
  const [cleanerStatusMsg, setCleanerStatusMsg] = useState<string | null>(null);

  // AnkiConnect State
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus>({ online: false });
  const [checkingAnki, setCheckingAnki] = useState(false);
  const [deckName, setDeckName] = useState("Kindle Vocabulary");
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAnkiConnectHelp, setShowAnkiConnectHelp] = useState(false);
  const [copiedAddonCode, setCopiedAddonCode] = useState(false);
  const [copiedCorsJson, setCopiedCorsJson] = useState(false);
  const [syncReport, setSyncReport] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const corsOrigins = [
    "http://localhost",
    "https://kindle2anki.online",
    "https://www.kindle2anki.online",
    "https://kindletoanki.online",
    "https://www.kindletoanki.online",
  ];

  const ankiConnectJson = JSON.stringify(
    {
      apiKey: null,
      apiLogPath: null,
      ignoreOriginList: [],
      webBindAddress: "127.0.0.1",
      webBindPort: 8765,
      webCorsOriginList: corsOrigins,
    },
    null,
    4
  );

  const handleCopyAddonCode = () => {
    navigator.clipboard.writeText("2055492159");
    setCopiedAddonCode(true);
    setTimeout(() => setCopiedAddonCode(false), 2000);
  };

  const handleCopyCorsJson = () => {
    navigator.clipboard.writeText(ankiConnectJson);
    setCopiedCorsJson(true);
    setTimeout(() => setCopiedCorsJson(false), 2000);
  };

  // Card Preview State
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  const [previewIndex, setPreviewIndex] = useState(0);

  const previewWord = wordsToExport[previewIndex] || words[0] || {
    id: "sample",
    word: "ephemeral",
    stem: "ephemeral",
    lang: "en",
    wordTimestamp: Date.now(),
    translation: "ефемерний, недовговічний",
    ipa: "/ɪˈfem.ər.əl/",
    explanation: "(adjective) Lasting for a very short time; fleeting.",
    context: "He realized that fame in such a volatile society was entirely ephemeral.",
    example: "Spring blossom is extraordinarily beautiful, yet completely ephemeral.",
    bookTitle: "1984",
    status: "new",
    addedAt: Date.now(),
  };

  const speakWord = (text: string, lang = "en-US") => {
    playWordAudio(text, previewWord.stem, lang);
  };

  const highlightTargetWord = (sentence: string, target: string, stem?: string) => {
    if (!sentence || !target) return sentence;
    const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedStem = stem ? stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
    const pattern =
      escapedStem && escapedStem !== escapedTarget
        ? `\\b(${escapedTarget}|${escapedStem}\\w*)\\b`
        : `\\b(${escapedTarget}\\w*)\\b`;

    try {
      const regex = new RegExp(pattern, "gi");
      const parts = sentence.split(regex);
      return parts.map((part, idx) =>
        regex.test(part) ? (
          <strong
            key={idx}
            className="font-bold text-white underline decoration-cyan-400/80 decoration-2 underline-offset-2"
          >
            {part}
          </strong>
        ) : (
          part
        )
      );
    } catch {
      return sentence;
    }
  };

  const handleDownloadCleanKindleDb = async () => {
    setIsCleaningKindle(true);
    setCleanerStatusMsg(null);
    try {
      const binary = await buildCleanedKindleDb("empty");
      downloadKindleVocabFile(binary, "vocab.db");
      setCleanerStatusMsg(
        "Clean vocab.db downloaded! Replace Kindle/system/vocabulary/vocab.db via USB."
      );
      setTimeout(() => setCleanerStatusMsg(null), 6000);
    } catch (err) {
      console.error("Failed to export Kindle vocab.db:", err);
    } finally {
      setIsCleaningKindle(false);
    }
  };

  const testAnkiConnection = async () => {
    setCheckingAnki(true);
    try {
      const status = await checkAnkiConnect();
      setAnkiStatus(status);
    } catch {
      setAnkiStatus({ online: false });
    } finally {
      setCheckingAnki(false);
    }
  };

  const handleToggleAnkiConnect = () => {
    const nextState = !showAnkiConnectHelp;
    setShowAnkiConnectHelp(nextState);
    if (nextState) {
      testAnkiConnection();
    }
  };

  // Primary Action: Download Anki Deck (.txt)
  const handleDownloadDeck = () => {
    exportToTsvStyled(wordsToExport, "Kindle_Vocabulary_Deck.txt");
  };

  // Secondary Action: Download Plain TSV
  const handleDownloadPlain = () => {
    exportToTsv(wordsToExport, "Kindle_Vocabulary_Plain.txt");
  };

  // Optional Action: Direct Sync via AnkiConnect
  const handleDirectSync = async () => {
    if (wordsToExport.length === 0) return;
    setIsSyncing(true);
    setSyncReport(null);

    try {
      const res = await syncWordsToAnki(wordsToExport, deckName);
      setSyncReport({
        success: res.successCount,
        failed: res.failedCount,
        errors: res.errors,
      });
      onRefreshWords();
    } catch (err: any) {
      setSyncReport({
        success: 0,
        failed: wordsToExport.length,
        errors: [err.message || String(err)],
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-2">
      {/* 2-COLUMN SPLIT LAYOUT matching image_b4fa74a7.png */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Export Hero + Steps for Importing + Kindle Cleaner */}
        <div className="lg:col-span-7 space-y-8">
          {/* Primary Export Centerpiece */}
          <div className="text-center space-y-5 pt-2">
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
                Export Flashcards to Anki
              </h1>
              <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Ready to export <b className="text-slate-200 tabular-nums">{wordsToExport.length}</b>{" "}
                translated flashcards with phonetic transcriptions, definitions, and context examples.
              </p>
            </div>

            <div className="space-y-4 pt-1">
              <div className="text-xs font-bold text-white">
                Download Ready-to-Study Anki File
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleDownloadDeck}
                  className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-violet-600 via-indigo-500 to-teal-400 hover:opacity-95 text-white text-sm font-bold rounded-full shadow-[0_0_28px_rgba(45,212,191,0.38)] transition cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Anki Deck (.txt)</span>
                </button>
              </div>

              {/* 3 Metadata Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 tabular-nums">
                <span className="px-3.5 py-1 rounded-full bg-[#141826] border border-white/10 text-xs font-semibold text-slate-200">
                  {wordsToExport.length} Cards
                </span>
                <span className="px-3.5 py-1 rounded-full bg-[#141826] border border-white/10 text-xs font-semibold text-slate-200">
                  {ipaCount} with IPA Phonetics
                </span>
                <span className="px-3.5 py-1 rounded-full bg-[#141826] border border-white/10 text-xs font-semibold text-slate-200">
                  {exampleCount} with Context & Examples
                </span>
              </div>

              <div className="space-y-1 pt-1 text-xs text-slate-400">
                <div>Includes automatic Light & Dark mode card styling + audio</div>
                <button
                  type="button"
                  onClick={handleDownloadPlain}
                  className="text-indigo-400 hover:text-indigo-300 underline font-medium transition cursor-pointer"
                >
                  Download unstyled plain TSV instead
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Steps for Importing matching image_b4fa74a7.png */}
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold text-white text-center">
              Steps for importing
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
              {/* STEP 1 Card with Violet Glow */}
              <div className="rounded-2xl p-[1px] bg-gradient-to-br from-purple-500/75 via-indigo-500/30 to-transparent shadow-[0_0_24px_-6px_rgba(168,85,247,0.28)]">
                <div className="h-full p-5 rounded-[15px] bg-[#101422] space-y-1.5">
                  <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                    Step 1
                  </div>
                  <div className="text-sm font-extrabold text-white">
                    In Anki: File → Import
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Open Anki on your computer or phone and choose File → Import (make sure "Allow HTML in fields" is checked).
                  </p>
                </div>
              </div>

              {/* STEP 2 Card with Cyan Glow */}
              <div className="rounded-2xl p-[1px] bg-gradient-to-br from-cyan-400/75 via-teal-500/30 to-transparent shadow-[0_0_24px_-6px_rgba(34,211,238,0.28)]">
                <div className="h-full p-5 rounded-[15px] bg-[#101422] space-y-1.5">
                  <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                    Step 2
                  </div>
                  <div className="text-sm font-extrabold text-white">
                    Select File & Start Studying
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Select the downloaded <code className="font-mono text-slate-200">Kindle_Vocabulary_Deck.txt</code> file. All formatting, colors, and dark-mode styles load automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Post-Export Utilities: Kindle Cleaner (Single Action) & Optional AnkiConnect */}
          <div className="space-y-3 text-left">
            {/* Kindle Vocabulary Cleaner — appears once in the entire app */}
            <div className="p-4 sm:px-5 bg-[#101422] border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Eraser className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Clean Kindle Vocabulary (vocab.db)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  After exporting to Anki, replace <code className="font-mono text-slate-300">system/vocabulary/vocab.db</code> on your Kindle via USB to clear old words.
                </p>
                {cleanerStatusMsg && (
                  <div className="text-[11px] font-semibold text-emerald-400 pt-0.5">
                    ✓ {cleanerStatusMsg}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleDownloadCleanKindleDb}
                disabled={isCleaningKindle}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-semibold rounded-xl transition cursor-pointer whitespace-nowrap shrink-0"
              >
                {isCleaningKindle ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-cyan-400" />
                )}
                <span>Download Clean vocab.db</span>
              </button>
            </div>

            {/* Optional Direct Sync via AnkiConnect */}
            <div className="p-4 sm:px-5 bg-[#101422] border border-white/10 rounded-2xl space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={handleToggleAnkiConnect}
              >
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <span>⚡ Direct Sync with Anki Desktop (AnkiConnect)</span>
                  {ankiStatus.online ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      Connected
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-normal">Optional</span>
                  )}
                </div>
                <button
                  type="button"
                  className="text-slate-400 hover:text-white"
                  aria-label="Toggle AnkiConnect options"
                >
                  {showAnkiConnectHelp ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>

              {showAnkiConnectHelp && (
                <div className="pt-3.5 border-t border-white/10 space-y-4 text-xs">
                  {ankiStatus.online ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold">
                          <CheckCircle className="h-4 w-4" />
                          <span>Anki Desktop connected (127.0.0.1:8765)</span>
                        </div>
                        <button
                          type="button"
                          onClick={testAnkiConnection}
                          disabled={checkingAnki}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white cursor-pointer"
                        >
                          <RefreshCw className={`h-3 w-3 ${checkingAnki ? "animate-spin" : ""}`} />
                          <span>Refresh</span>
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        <input
                          type="text"
                          value={deckName}
                          onChange={(e) => setDeckName(e.target.value)}
                          placeholder="Target Anki Deck Name"
                          className="flex-1 text-xs p-2.5 bg-[#0B0E17] border border-white/10 rounded-xl text-white"
                        />
                        <button
                          type="button"
                          onClick={handleDirectSync}
                          disabled={isSyncing}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer"
                        >
                          {isSyncing ? "Syncing..." : "1-Click Push to Anki"}
                        </button>
                      </div>
                      {syncReport && (
                        <div className="text-[11px] text-emerald-300">
                          ✓ Pushed {syncReport.success} cards to "{deckName}"!
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3.5 text-slate-300">
                      {/* Status & Check Connection Bar */}
                      <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-[#0B0E17] border border-white/10">
                        <span className="text-[11px] text-slate-400">
                          Anki Desktop not detected on <code className="font-mono text-slate-300">127.0.0.1:8765</code>
                        </span>
                        <button
                          type="button"
                          onClick={testAnkiConnection}
                          disabled={checkingAnki}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 rounded-lg text-[11px] font-bold text-indigo-200 transition cursor-pointer"
                        >
                          <RefreshCw className={`h-3 w-3 ${checkingAnki ? "animate-spin" : ""}`} />
                          <span>Check Connection</span>
                        </button>
                      </div>

                      {/* Detailed 3-Step Setup Instructions */}
                      <div className="space-y-3">
                        {/* Step 1: Install Add-on */}
                        <div className="p-3 rounded-xl bg-[#0B0E17]/70 border border-white/8 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                              Step 1 · Install AnkiConnect Add-on
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyAddonCode}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/8 hover:bg-white/14 text-[11px] font-mono text-slate-200 border border-white/10 transition cursor-pointer"
                            >
                              {copiedAddonCode ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span className="text-emerald-300">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 text-slate-400" />
                                  <span>2055492159</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            In Anki Desktop, open <b className="text-slate-200">Tools → Add-ons → Get Add-ons...</b> and paste code <code className="font-mono text-indigo-300 font-bold">2055492159</code>.
                          </p>
                        </div>

                        {/* Step 2: Configure CORS JSON */}
                        <div className="p-3 rounded-xl bg-[#0B0E17]/70 border border-white/8 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                              Step 2 · Allow Browser Access (CORS Config)
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyCorsJson}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 text-[11px] font-semibold text-cyan-200 border border-cyan-400/30 transition cursor-pointer"
                            >
                              {copiedCorsJson ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span className="text-emerald-300">Copied JSON!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 text-cyan-300" />
                                  <span>Copy Config JSON</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            By default, AnkiConnect blocks websites. Go to <b className="text-slate-200">Tools → Add-ons</b>, select <b className="text-slate-200">AnkiConnect</b>, click <b className="text-slate-200">Config</b>, replace its content with this JSON, and click <b className="text-slate-200">OK</b>:
                          </p>
                          <pre className="p-2.5 rounded-lg bg-[#07090F] border border-white/10 text-[10px] font-mono text-slate-300 overflow-x-auto leading-relaxed select-all">
                            {ankiConnectJson}
                          </pre>
                        </div>

                        {/* Step 3: Restart Anki */}
                        <div className="p-3 rounded-xl bg-[#0B0E17]/70 border border-white/8 space-y-1">
                          <div className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                            Step 3 · Restart Anki & Connect
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Restart <b className="text-slate-200">Anki Desktop</b> so the new config takes effect (keep Anki open in the background), then click <b className="text-indigo-300">Check Connection</b> above.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Flashcard Preview Window matching image_b4fa74a7.png */}
        <div className="lg:col-span-5">
          <div className="bg-[#101422] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
            {/* Window Top Bar */}
            <div className="px-4 py-3 bg-[#151A2C] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-400" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-300">
                  Interactive Flashcard Preview
                </span>
              </div>

              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#1C2237] border border-white/10 rounded-lg text-xs text-slate-300 tabular-nums">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewIndex((prev) => (prev > 0 ? prev - 1 : wordsToExport.length - 1))
                  }
                  className="hover:text-white cursor-pointer"
                  aria-label="Previous card"
                >
                  ←
                </button>
                <span className="font-mono text-[11px] font-semibold">
                  {previewIndex + 1} / {wordsToExport.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewIndex((prev) => (prev < wordsToExport.length - 1 ? prev + 1 : 0))
                  }
                  className="hover:text-white cursor-pointer"
                  aria-label="Next card"
                >
                  →
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div className="p-5 sm:p-6 space-y-5">
              {/* Front / Back Side Toggle Row (Single clean toggle) */}
              <div className="flex items-center justify-center">
                <div className="inline-flex p-1 bg-[#161B2C] border border-white/10 rounded-full text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPreviewSide("front")}
                    className={`px-5 py-1.5 rounded-full transition cursor-pointer ${
                      previewSide === "front"
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_12px_rgba(124,58,237,0.4)]"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Front Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSide("back")}
                    className={`px-5 py-1.5 rounded-full transition cursor-pointer ${
                      previewSide === "back"
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_12px_rgba(124,58,237,0.4)]"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Back Side
                  </button>
                </div>
              </div>

              {/* THE GLOWING FLASHCARD matching image_b4fa74a7.png */}
              <div className="rounded-2xl p-[1.5px] bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 shadow-[0_0_32px_-6px_rgba(139,92,246,0.35)]">
                <div
                  className="w-full min-h-[270px] bg-[#141826] rounded-[15px] p-6 sm:p-8 flex flex-col justify-center text-center transition-all"
                  key={`${previewWord.id}-${previewSide}`}
                >
                  {previewSide === "front" ? (
                    <div className="space-y-5 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                          {previewWord.word}
                        </span>
                        <button
                          type="button"
                          onClick={() => speakWord(previewWord.word, previewWord.lang)}
                          title="Listen to pronunciation"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition cursor-pointer"
                        >
                          <Volume2 className="h-6 w-6" />
                        </button>
                      </div>

                      {previewWord.ipa && (
                        <div>
                          <span className="inline-block px-4 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-400/25 text-indigo-200 font-mono text-sm">
                            {previewWord.ipa}
                          </span>
                        </div>
                      )}

                      {previewWord.bookTitle && (
                        <div className="text-sm text-amber-400 font-semibold pt-1 flex items-center justify-center gap-2">
                          <BookOpen className="h-4 w-4 text-amber-400 fill-amber-400/20" />
                          <span>{previewWord.bookTitle}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3.5 text-left">
                      <div className="text-center pb-3 border-b border-white/10">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs text-slate-400 font-bold">
                            {previewWord.word}
                          </span>
                          {previewWord.ipa && (
                            <span className="text-[11px] font-mono text-indigo-300">
                              {previewWord.ipa}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => speakWord(previewWord.word, previewWord.lang)}
                            className="p-1 rounded text-slate-400 hover:text-cyan-400 cursor-pointer"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="text-lg font-extrabold text-cyan-300 mt-1">
                          {previewWord.translation || "No translation yet"}
                        </div>
                      </div>

                      {previewWord.explanation && (
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Definition
                          </div>
                          <div className="text-xs text-slate-200 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/10">
                            {previewWord.explanation}
                          </div>
                        </div>
                      )}

                      {previewWord.context && (
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                            Original Kindle Quote
                          </div>
                          <div className="text-xs text-slate-200 italic bg-amber-950/35 p-2.5 rounded-xl border border-amber-500/30 leading-relaxed">
                            “{highlightTargetWord(previewWord.context, previewWord.word, previewWord.stem)}”
                          </div>
                        </div>
                      )}

                      {previewWord.example && (
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                            Usage Example
                          </div>
                          <div className="text-xs text-slate-200 italic bg-emerald-950/35 p-2.5 rounded-xl border border-emerald-500/30 leading-relaxed">
                            {highlightTargetWord(previewWord.example, previewWord.word, previewWord.stem)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Flip Button Pill below the card matching image_b4fa74a7.png */}
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setPreviewSide(previewSide === "front" ? "back" : "front")}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#161B2C] hover:bg-[#1F263D] border border-white/15 rounded-full text-xs font-semibold text-slate-200 transition cursor-pointer"
                >
                  <ArrowRightCircle className="h-3.5 w-3.5 text-indigo-400" />
                  <span>
                    {previewSide === "front" ? "Flip to Back Side" : "Flip to Front Side"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
