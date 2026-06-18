/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Book, Word } from "../types";
import { BookOpen, TrendingUp, Award, Layers, Clock, ShieldCheck, Flame, PieChart } from "lucide-react";

interface DashboardPanelProps {
  words: Word[];
  books: Book[];
  onSelectBook: (bookId: string) => void;
  onSelectTab: (tab: string) => void;
}

export default function DashboardPanel({ words, books, onSelectBook, onSelectTab }: DashboardPanelProps) {
  // 1. Calculate Status Stats
  const totalCount = words.length;
  const newCount = words.filter((w) => w.status === "new").length;
  const learningCount = words.filter((w) => w.status === "learning").length;
  const learnedCount = words.filter((w) => w.status === "learned").length;

  // 2. Spark/Streak metrics (words added in the last 7 days)
  const last7DaysMs = 7 * 24 * 60 * 60 * 1000;
  const recentWordCount = words.filter((w) => {
    const timestamp = w.lookupTimestamp || w.wordTimestamp || 0;
    return Date.now() - timestamp < last7DaysMs;
  }).length;

  // 3. Group words by book
  const bookDistribution = books
    .map((b) => {
      const count = words.filter((w) => w.bookId === b.id).length;
      return { ...b, wordCount: count };
    })
    .filter((b) => b.wordCount && b.wordCount > 0)
    .sort((a, b) => b.wordCount! - a.wordCount!);

  // 4. Time Trend: last 7 days count
  const getTrendData = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const trend: { [key: string]: number } = {};
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      trend[dateStr] = 0;
    }

    words.forEach((w) => {
      const ts = w.lookupTimestamp || w.wordTimestamp || 0;
      if (ts) {
        const dateStr = new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (trend[dateStr] !== undefined) {
          trend[dateStr]++;
        }
      }
    });

    return Object.entries(trend).map(([key, val]) => ({ date: key, count: val }));
  };

  const trendData = getTrendData();
  const maxTrendValue = Math.max(...trendData.map((d) => d.count), 1);

  // 5. Frequently looked up word roots/stems (analyzing if kindle users repeatedly click certain stems)
  const getFrequentStems = () => {
    const stemCounts: { [key: string]: number } = {};
    words.forEach((w) => {
      if (w.stem) {
        stemCounts[w.stem] = (stemCounts[w.stem] || 0) + 1;
      }
    });
    return Object.entries(stemCounts)
      .map(([stem, count]) => ({ stem, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const frequentStems = getFrequentStems();

  return (
    <div className="space-y-6">
      {/* Welcome Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Workspace Overview</h2>
          <p className="text-slate-500 text-sm">Analyze Kindle dictionary data, monitor export statuses, and manage ebooks.</p>
        </div>
        {totalCount === 0 && (
          <button
            onClick={() => onSelectTab("upload")}
            className="inline-flex items-center gap-1.5 h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition cursor-pointer select-none"
          >
            <BookOpen className="h-4 w-4" />
            Upload vocab.db
          </button>
        )}
      </div>

      {totalCount === 0 ? (
        /* Empty State */
        <div className="border border-slate-200 border-dashed rounded-xl p-12 text-center bg-slate-50/50 space-y-4 max-w-xl mx-auto mt-8">
          <div className="h-10 w-10 rounded bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Layers className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-slate-900 text-base">No Kindle database loaded</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
              You haven't uploaded a Kindle vocabulary builder dictionary database yet. Connect your device to get started!
            </p>
          </div>
          <button
            onClick={() => onSelectTab("upload")}
            className="inline-flex items-center h-10 gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition cursor-pointer select-none"
          >
            Go to Upload panel
          </button>
        </div>
      ) : (
        /* Main Dashboard Elements */
        <div className="space-y-6 animate-fade-in">
          {/* Bento Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Words</p>
              <p className="text-3xl font-extrabold text-slate-900">{totalCount}</p>
              <div className="pt-2 flex items-center text-xs text-slate-400">
                <span>Total words imported</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">New Words</p>
              <p className="text-3xl font-extrabold text-slate-900">{newCount}</p>
              <div className="pt-1 flex items-center text-xs text-indigo-600 font-medium font-sans">
                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100/60 font-semibold">Ready for AI translation</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Learning</p>
              <p className="text-3xl font-extrabold text-slate-900">{learningCount}</p>
              <div className="pt-1 flex items-center text-xs text-blue-650 font-medium">
                <span className="px-1.5 py-0.5 rounded bg-blue-50/70 border border-blue-100/40 text-blue-700 font-semibold">In active practice lists</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Learned</p>
              <p className="text-3xl font-extrabold text-slate-900 text-emerald-600">{learnedCount}</p>
              <div className="pt-1 flex items-center text-xs text-emerald-600 font-medium">
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100/40 font-semibold font-sans">Exported or understood</span>
              </div>
            </div>
          </div>

          {/* Quick streak and analytics highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Kindle Trend Chart (Custom styled) */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="font-semibold text-slate-900 text-sm">Lookup Activity</h3>
                  <p className="text-xs text-slate-400">Word lookup count over the last 7 active days</p>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] bg-slate-50 border border-slate-200 font-medium text-slate-600 px-2.5 py-1 rounded-full">
                  <TrendingUp className="h-3 w-3 text-slate-450" />
                  <span>Activity Graph</span>
                </div>
              </div>

              {/* Bar charts using CSS Grid */}
              <div className="flex items-end justify-between h-36 pt-4 px-2">
                {trendData.map((d, index) => {
                  const percent = Math.max((d.count / maxTrendValue) * 100, 4);
                  return (
                    <div key={index} className="flex flex-col items-center flex-1 gap-2 group cursor-pointer">
                      <div className="relative w-full flex justify-center">
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] py-1 px-2 rounded pointer-events-none transition-all font-semibold select-none shadow z-10">
                          {d.count} lookups
                        </div>
                        {/* Bar */}
                        <div
                          style={{ height: `${percent}%` }}
                          className={`w-5 sm:w-10 rounded-t transition-all duration-300 ${
                            d.count > 0 ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-100 hover:bg-slate-200"
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis w-12 text-center">
                        {d.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Metrics Info card */}
            <div className="rounded-xl border border-slate-200 bg-slate-900 text-white p-5 flex flex-col justify-between space-y-2 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="p-2 bg-slate-800 rounded text-amber-400 border border-slate-700">
                  <Flame className="h-5 w-5" />
                </div>
                <div className="text-[10px] font-bold uppercase py-0.5 px-2.5 bg-amber-400/20 text-amber-400 tracking-wider rounded-full border border-amber-400/20">
                  Streak Status
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold tracking-tight">Active Learning Spurt</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  You discovered <span className="text-amber-400 font-bold">{recentWordCount}</span> new words on your Kindle system in the last 7 active days! Continue exporting them regularly to retain your progress.
                </p>
              </div>

              <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-xs text-slate-400">
                <div className="flex items-center gap-1.5 text-emerald-405 font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  IndexedDB Secure Storage
                </div>
              </div>
            </div>
          </div>

          {/* Books and Stems row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Books Distribution card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col">
              <div className="flex justify-between items-center b-1 pb-2 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 text-sm">Words by Ebooks</h3>
                <span className="text-xs text-slate-400 font-medium">{bookDistribution.length} libraries</span>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {bookDistribution.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => onSelectBook(book.id)}
                    className="p-2.5 hover:bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="space-y-0.5 overflow-hidden pr-2">
                      <div className="font-semibold text-xs text-slate-900 truncate" title={book.title}>
                        {book.title}
                      </div>
                      <div className="text-[10px] text-slate-450 truncate">{book.author || "Unknown Author"}</div>
                    </div>
                    <div className="shrink-0 bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-bold font-mono">
                      {book.wordCount} words
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Frequent Stems / Hardest Words lookup card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col">
              <div className="flex justify-between items-center b-1 pb-2 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 text-sm">Repeated Vocabulary Roots</h3>
                <span className="text-[10px] bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold">
                  Core stems
                </span>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {frequentStems.length === 0 ? (
                  <p className="text-xs text-slate-400 p-8 text-center bg-slate-50 rounded-lg">
                    Stems are computed dynamically upon lookup mapping.
                  </p>
                ) : (
                  frequentStems.map((stemItem, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                        <span className="text-xs font-semibold text-slate-700">{stemItem.stem}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-550 font-medium">
                        Looked up {stemItem.count} {stemItem.count === 1 ? "time" : "times"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
