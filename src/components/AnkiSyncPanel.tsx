/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Word, Book } from "../types";
import { checkAnkiConnect, syncWordsToAnki, AnkiStatus } from "../utils/ankiConnect";
import { exportToTsvStyled } from "../utils/csv";
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  HelpCircle,
  Award,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft
} from "lucide-react";

interface AnkiSyncPanelProps {
  words: Word[];
  onRefreshWords: () => void;
  onNavigateToManage: () => void;
}

export default function AnkiSyncPanel({
  words,
  onRefreshWords,
  onNavigateToManage,
}: AnkiSyncPanelProps) {
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus>({ online: false });
  const [checkingAnki, setCheckingAnki] = useState(false);
  const [deckName, setDeckName] = useState("Kindle Vocabulary");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // Filter words that have translations (can be exported)
  const readyWords = words.filter((w) => w.translation);
  const totalWords = words.length;

  const testAnkiConnection = async () => {
    setCheckingAnki(true);
    try {
      const status = await checkAnkiConnect();
      setAnkiStatus(status);
    } catch (err: any) {
      setAnkiStatus({ online: false, error: err.message || String(err) });
    } finally {
      setCheckingAnki(false);
    }
  };

  useEffect(() => {
    testAnkiConnection();
  }, []);

  // Sync prepared words to desktop Anki via AnkiConnect
  const handleSyncToAnkiConnect = async () => {
    if (readyWords.length === 0) {
      alert("No words with AI translations/explanations to sync! Translate some words first.");
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const res = await syncWordsToAnki(readyWords, deckName);
      
      // Update words in DB to status "learned"
      const dbInstance = await import("../utils/db").then((m) => m.getDB());
      const transaction = dbInstance.transaction("words", "readwrite");
      const store = transaction.objectStore("words");

      readyWords.forEach((w) => {
        store.put({ ...w, status: "learned" }); // Move into Learned list!
      });

      transaction.oncomplete = () => {
        setSyncResult({
          success: res.successCount,
          failed: res.failedCount,
          errors: res.errors,
        });
        onRefreshWords();
      };
    } catch (err: any) {
      console.error(err);
      setSyncResult({
        success: 0,
        failed: readyWords.length,
        errors: [err.message || String(err)],
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Trigger TXT export of styled HTML fields (tab-separated)
  const handleDownloadTxtStyled = () => {
    if (readyWords.length === 0) {
      if (!confirm("You have 0 words translated. Downloading TXT now will output empty cards. Proceed?")) {
        return;
      }
    }
    exportToTsvStyled(readyWords);
  };

  return (
    <div className="space-y-6 py-2">
      {/* Back button */}
      <div>
        <button
          onClick={onNavigateToManage}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer select-none shadow-sm hover:shadow"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-slate-550" />
          <span>Back to Vocabulary</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
      {/* LEFT COLUMN: Controls & Sync Panel */}
      <div className="md:col-span-2 space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Anki Sync & Export Center</h2>
          <p className="text-slate-500 text-sm">
            Transfer prepared vocabulary words using beautiful card designs either directly to your local Anki Desktop or download a styled TXT file.
          </p>
        </div>

        {/* AnkiConnect Diagnostic Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-950 text-xs uppercase tracking-wider text-slate-500">Add-on Link Status</h3>
            <button
              onClick={testAnkiConnection}
              disabled={checkingAnki}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800 transition cursor-pointer select-none"
              title="Test connection"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checkingAnki ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="sm:col-span-2 flex items-center gap-3">
              {ankiStatus.online ? (
                <div className="h-9 w-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 border border-emerald-100 shadow-sm">
                  <CheckCircle className="h-5 w-5" />
                </div>
              ) : (
                <div className="h-9 w-9 bg-red-50 text-red-600 rounded-lg flex items-center justify-center shrink-0 border border-red-100 shadow-sm">
                  <XCircle className="h-5 w-5" />
                </div>
              )}
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Local Desktop Link</div>
                <div className="text-sm font-bold text-slate-900">
                  {ankiStatus.online ? "ONLINE & RESPONSIVE" : "LINK OFFLINE"}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                  ankiStatus.online
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-amber-50 text-amber-700 border-amber-100"
                }`}
              >
                {ankiStatus.online ? "Connected" : "Action Required"}
              </span>
            </div>
          </div>

          {!ankiStatus.online && (
            <p className="text-xs text-slate-500 leading-relaxed bg-amber-50/50 p-3 rounded-lg border border-amber-100">
              <b>Important:</b> AnkiConnect is an add-on for native desktop Anki. To sync, your Anki app must be running with the API port active. See the instructions on the right to configure.
            </p>
          )}
        </div>

        {/* Sync panel actions stage */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="space-y-0.5">
              <h3 className="font-semibold text-slate-900 text-sm">Synchronize Cards</h3>
              <p className="text-xs text-slate-400">Pushes vocabulary cards to your selected target deck</p>
            </div>
            <div className="shrink-0 text-xs font-semibold text-slate-650 font-mono bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
              {readyWords.length} / {totalWords} cards ready
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Anki Deck Name</label>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Kindle Vocabulary"
                className="w-full text-sm border border-slate-200 bg-slate-50/50 hover:bg-slate-50 px-3 py-2 rounded-lg focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
              />
            </div>

            <div className="pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export to local AnkiConnect */}
                <button
                  onClick={handleSyncToAnkiConnect}
                  disabled={isSyncing || readyWords.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 px-4 h-11 bg-slate-900 hover:bg-black disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                      Synchronizing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      1-Click Sync to Anki
                    </>
                  )}
                </button>

                {/* Download Styled TXT */}
                <button
                  onClick={handleDownloadTxtStyled}
                  disabled={readyWords.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 px-4 h-11 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer select-none"
                  title="Download tab-separated TXT with beautiful styled HTML cards (auto-configured for Anki)"
                >
                  <FileSpreadsheet className="h-4 w-4 text-white" />
                  Download File for Anki
                </button>
              </div>
            </div>
          </div>

          {/* Sync Results Output */}
          {syncResult && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 animate-fade-in text-left">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Sync report</h4>
              <div className="text-xs text-slate-600 leading-relaxed">
                Successfully pushed <b className="text-emerald-700 font-bold">{syncResult.success}</b> words to deck{" "}
                <code className="bg-slate-200 text-slate-800 font-bold font-mono px-1.5 py-0.5 rounded text-[10px] border border-slate-250">{deckName}</code> in Anki!
                {syncResult.failed > 0 && (
                  <span className="text-red-650"> Syncing failed for {syncResult.failed} items.</span>
                )}
              </div>
              {syncResult.errors.length > 0 && (
                <div className="pt-2 text-[10px] space-y-0.5 text-red-650 leading-snug">
                  {syncResult.errors.map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Instructions Guide */}
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-905 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-slate-400" />
            AnkiConnect setup guide
          </h3>

          <ol className="text-xs text-slate-600 space-y-3.5 pl-3 list-decimal leading-relaxed">
            <li>
              Download and open your desktop app{" "}
              <a
                href="https://apps.ankiweb.net/"
                target="_blank"
                referrerPolicy="no-referrer"
                className="text-slate-900 font-bold inline-flex items-center gap-0.5 hover:underline"
              >
                Anki Desktop
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              In Anki, navigate to top menu:
              <br />
              <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-[9px] block mt-1 select-all font-mono border border-slate-300">
                Tools &gt; Add-ons &gt; Get Add-ons...
              </code>
            </li>
            <li>
              Enter download install code:
              <br />
              <code className="bg-slate-200 text-slate-900 border border-slate-350 px-1.5 py-1 rounded text-xs block font-mono font-extrabold mt-1 tracking-wider text-center select-all">
                2055492159
              </code>
            </li>
            <li>
              Restart Anki. Now configure origin permissions:
              <br />
              Select <span className="font-semibold">AnkiConnect</span> within Anki Add-ons list, click <span className="font-bold text-slate-900">Config</span>, and add your current app origin to <code className="font-mono">webCorsOriginList</code>:
              <pre className="bg-slate-900 text-slate-100 p-2 rounded text-[9px] block mt-1 overflow-x-auto font-mono select-all">
{`{
  "apiKey": null,
  "apiLogPath": null,
  "ignoreOriginList": [],
  "webBindAddress": "127.0.0.1",
  "webBindPort": 8765,
  "webCorsOriginList": [
    "http://localhost",
    "${window.location.origin}"
  ]
}`}
              </pre>
            </li>
            <li>
              Restart Anki again, keep it active in the background, and perform transfers!
            </li>
          </ol>

          <div className="pt-3 border-t border-slate-200 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] text-slate-400 leading-relaxed">
              Upon successful sync, transferred words automatically flags to 'Learned' status to help track progress.
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
