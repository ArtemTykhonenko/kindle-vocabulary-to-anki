/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from "react";
import { Book, Word } from "../types";
import { getWordFrequency } from "../utils/frequency";
import {
  Search,
  Filter,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
  Award,
  BookOpen,
  Loader2,
  Database,
  Grid3X3,
  List,
  CheckCircle,
  Clock,
  HelpCircle,
  BookOpenCheck,
  Edit2,
  Save,
  X,
  Globe,
  ArrowRight
} from "lucide-react";
import { translateWordsBatch } from "../utils/api";
import { updateWordsBatch, updateWord } from "../utils/db";
import { lookupFreeDictionary } from "../utils/freeDictionary";

const LANGUAGES = [
  { code: "en", name: "English (en)" },
  { code: "ru", name: "Russian (ru)" },
  { code: "es", name: "Spanish (es)" },
  { code: "de", name: "German (de)" },
  { code: "fr", name: "French (fr)" },
  { code: "it", name: "Italian (it)" },
  { code: "pt", name: "Portuguese (pt)" },
  { code: "zh", name: "Chinese (zh)" },
  { code: "ja", name: "Japanese (ja)" },
  { code: "ko", name: "Korean (ko)" },
  { code: "ar", name: "Arabic (ar)" },
  { code: "tr", name: "Turkish (tr)" },
  { code: "pl", name: "Polish (pl)" },
  { code: "uk", name: "Ukrainian (uk)" },
];

interface VocabularyTableProps {
  words: Word[];
  books: Book[];
  selectedBookId: string | null;
  onSelectBook: (bookId: string | null) => void;
  onRefreshWords: () => void;
  serverOnline: boolean;
  onNavigateToExport: () => void;
  onNavigateToUpload: () => void;
}

export default function VocabularyTable({
  words,
  books,
  selectedBookId,
  onSelectBook,
  onRefreshWords,
  serverOnline,
  onNavigateToExport,
  onNavigateToUpload,
}: VocabularyTableProps) {
  // Statistics counts
  const translatedCount = useMemo(() => words.filter((w) => w.translation).length, [words]);

  // Frequency Filter
  const [freqFilter, setFreqFilter] = useState<string>("all");

  // Abort Controller for translation cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"lookupTimestamp" | "word" | "frequency">("lookupTimestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Source and Target Language selections
  const [sourceLang, setSourceLang] = useState<string>("auto");
  const [targetLang, setTargetLang] = useState<string>(() => localStorage.getItem("kindle_target_lang") || "ru");

  // Save target language selection dynamically
  React.useEffect(() => {
    localStorage.setItem("kindle_target_lang", targetLang);
  }, [targetLang]);

  // Multi Selection state
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());

  // UI expand states
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  // Inline editing state inside expanded detail drawer
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editTranslation, setEditTranslation] = useState("");
  const [editIpa, setEditIpa] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editExample, setEditExample] = useState("");

  // Translation progress states
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ done: 0, total: 0 });

  // Filter books list
  const booksMap = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  // Handle Search and Filter mapping
  const filteredWords = useMemo(() => {
    return words
      .filter((w) => {
        // Search Matching
        const matchesSearch =
          w.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
          w.stem.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (w.bookTitle && w.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()));

        // Frequency Matching
        const matchesFreq = freqFilter === "all" || getWordFrequency(w.word, w.stem).rating === freqFilter;

        // Book Selection Matching
        const matchesBook = !selectedBookId || w.bookId === selectedBookId;

        return matchesSearch && matchesFreq && matchesBook;
      })
      .sort((a, b) => {
        // Sorting Logic
        if (sortField === "lookupTimestamp") {
          const valA = a.lookupTimestamp || a.wordTimestamp || 0;
          const valB = b.lookupTimestamp || b.wordTimestamp || 0;
          return sortOrder === "desc" ? valB - valA : valA - valB;
        } else if (sortField === "frequency") {
          const rankA = getWordFrequency(a.word, a.stem).rank;
          const rankB = getWordFrequency(b.word, b.stem).rank;
          return sortOrder === "desc" ? rankB - rankA : rankA - rankB;
        } else {
          const valA = a.word.toLowerCase();
          const valB = b.word.toLowerCase();
          if (valA < valB) return sortOrder === "desc" ? 1 : -1;
          if (valA > valB) return sortOrder === "desc" ? -1 : 1;
          return 0;
        }
      });
  }, [words, searchTerm, freqFilter, selectedBookId, sortField, sortOrder]);

  // Handle mass selection checkboxes
  const handleToggleSelectAll = () => {
    if (selectedWordIds.size === filteredWords.length) {
      setSelectedWordIds(new Set());
    } else {
      setSelectedWordIds(new Set(filteredWords.map((w) => w.id)));
    }
  };

  const handleToggleSelectWord = (id: string) => {
    const next = new Set(selectedWordIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedWordIds(next);
  };

  // Bulk Actions
  const handleBulkChangeStatus = async (status: "new" | "learning" | "learned") => {
    if (selectedWordIds.size === 0) return;
    const wordsToUpdate = words
      .filter((w) => selectedWordIds.has(w.id))
      .map((w) => ({ ...w, status }));

    await updateWordsBatch(wordsToUpdate);
    setSelectedWordIds(new Set());
    onRefreshWords();
  };

  const handleBulkDelete = async () => {
    if (selectedWordIds.size === 0) return;
    if (!confirm(`Are you sure you want to remove ${selectedWordIds.size} words from your list?`)) return;

    // We can soft delete or remove from IndexedDB. Let's filter out
    const dbInstance = await import("../utils/db").then((m) => m.getDB());
    const transaction = dbInstance.transaction("words", "readwrite");
    const store = transaction.objectStore("words");

    selectedWordIds.forEach((id) => {
      store.delete(id);
    });

    transaction.oncomplete = () => {
      setSelectedWordIds(new Set());
      onRefreshWords();
    };
  };

  // Bulk Translation via Free keyless API (Google Translate + Dictionary)
  const handleBulkTranslate = async () => {
    if (selectedWordIds.size === 0) return;

    setIsTranslating(true);
    setTranslationProgress({ done: 0, total: selectedWordIds.size });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const selectedWords = words.filter((w) => selectedWordIds.has(w.id));

    const itemsToTranslate = selectedWords.map((w) => ({
      word: w.word,
      context: w.context,
      lang: w.lang,
    }));

    try {
      const parsedResults = await translateWordsBatch(
        itemsToTranslate,
        sourceLang,
        targetLang,
        (done, total) => {
          setTranslationProgress({ done, total });
        },
        controller.signal
      );

      // Update words in DB
      const updatedWords = selectedWords.map((w) => {
        const found = parsedResults.find(
          (res) => res.word.toLowerCase().trim() === w.word.toLowerCase().trim()
        );
        if (found) {
          return {
            ...w,
            translation: found.translation || w.translation,
            ipa: found.ipa || w.ipa,
            explanation: found.explanation || w.explanation,
            example: found.example || w.example,
          };
        }
        return w;
      });

      // Filter to only update words that were actually updated (e.g. translated)
      const actualUpdatedWords = updatedWords.filter(w => {
        const original = selectedWords.find(orig => orig.id === w.id);
        return original && (w.translation !== original.translation || w.explanation !== original.explanation);
      });

      if (actualUpdatedWords.length > 0) {
        await updateWordsBatch(actualUpdatedWords);
      }
      
      setSelectedWordIds(new Set());
      onRefreshWords();

      if (controller.signal.aborted) {
        alert(`Translation stopped. Saved translations for ${actualUpdatedWords.length} words.`);
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to fetch translations: " + (err.message || String(err)));
    } finally {
      setIsTranslating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopTranslation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Helper action for entering manual editing Mode
  const startEditingWord = (word: Word) => {
    setEditingWordId(word.id);
    setEditTranslation(word.translation || "");
    setEditIpa(word.ipa || "");
    setEditExplanation(word.explanation || "");
    setEditExample(word.example || word.context || "");
  };

  // Helper action for saving manually edited properties to IndexedDB
  const saveEditedWord = async (word: Word) => {
    const updated: Word = {
      ...word,
      translation: editTranslation,
      ipa: editIpa,
      explanation: editExplanation,
      example: editExample,
    };
    await updateWord(updated);
    setEditingWordId(null);
    onRefreshWords();
  };

  const handleSort = (field: "lookupTimestamp" | "word" | "frequency") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header and Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Vocabulary Manager</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Database className="h-3.5 w-3.5 text-slate-600" />
              <b>{words.length}</b> total words
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 text-slate-600" />
              <b>{books.length}</b> ebooks
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-slate-600" />
              <b>{translatedCount}</b> ready to sync
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToUpload}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer select-none shadow-sm hover:shadow"
          >
            Import new DB
          </button>
          <button
            onClick={onNavigateToExport}
            className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs transition cursor-pointer select-none shadow-sm hover:shadow hover:scale-[1.01]"
          >
            Export & Sync
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Table search & quick controls panel */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search words, root stems, books..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 hover:bg-slate-100 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
          />
        </div>

        {/* Filter & Translation Engine Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Source Language Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Word Lang:</span>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-md px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
            >
              <option value="auto">Auto (from Kindle)</option>
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target Language Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Translate to:</span>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-md px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Frequency Filter */}
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={freqFilter}
              onChange={(e) => setFreqFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-md px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
            >
              <option value="all">All frequencies</option>
              <option value="common">Common (⭐⭐⭐)</option>
              <option value="intermediate">Intermediate (⭐⭐)</option>
              <option value="rare">Rare / Advanced (⭐)</option>
            </select>
          </div>

          {/* Book Filter */}
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedBookId || ""}
              onChange={(e) => onSelectBook(e.target.value || null)}
              className="text-xs bg-white border border-slate-200 rounded-md max-w-xs px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
            >
              <option value="">All books ({books.length})</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title.length > 25 ? `${b.title.substring(0, 25)}...` : b.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk action buttons (Active only on selection) */}
      {selectedWordIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 text-white border border-slate-800 rounded-xl animate-fade-in shadow-sm">
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
            {selectedWordIds.size} words selected for batch edit
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBulkTranslate}
              disabled={isTranslating}
              className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-slate-100 disabled:bg-slate-800 text-slate-900 disabled:text-slate-500 font-semibold rounded-md text-xs cursor-pointer transition select-none shadow-sm"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing... ({translationProgress.done}/{translationProgress.total})
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" />
                  Translate & Lookup
                </>
              )}
            </button>

            {/* Removed Status Bulk Action */}

            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-red-50 border border-red-200 text-red-600 font-semibold rounded-md text-xs cursor-pointer transition select-none"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Selected
            </button>
          </div>
        </div>
      )}

      {/* Translation loading bar */}
      {isTranslating && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 animate-fade-in shadow-sm">
          <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 text-slate-900 animate-spin" />
              Retrieving translations & definitions ({translationProgress.done}/{translationProgress.total} words)
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleStopTranslation}
                className="px-2 py-1 bg-red-50 hover:bg-red-100 hover:text-red-700 border border-red-200 text-red-650 rounded text-[10px] font-bold cursor-pointer transition select-none"
              >
                Stop
              </button>
              <span className="font-mono font-bold text-slate-700">{Math.round((translationProgress.done / (translationProgress.total || 1)) * 100)}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              style={{ width: `${(translationProgress.done / (translationProgress.total || 1)) * 100}%` }}
              className="bg-slate-900 h-1.5 rounded-full transition-all duration-300"
            />
          </div>
        </div>
      )}

      {/* MAIN DATA TABLE */}
      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-xs select-none uppercase tracking-wider">
              {/* Checkbox cell */}
              <th className="w-12 p-4 text-center">
                <input
                  type="checkbox"
                  checked={filteredWords.length > 0 && selectedWordIds.size === filteredWords.length}
                  onChange={handleToggleSelectAll}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 focus:ring-opacity-0 cursor-pointer h-4 w-4"
                />
              </th>
              {/* Word trigger */}
              <th
                onClick={() => handleSort("word")}
                className="p-4 w-44 font-semibold hover:text-slate-900 cursor-pointer select-none"
              >
                <div className="inline-flex items-center gap-1">
                  Word
                  {sortField === "word" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-900" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-900" />
                    )
                  ) : null}
                </div>
              </th>
              {/* Frequency Rating */}
              <th
                onClick={() => handleSort("frequency")}
                className="p-4 w-36 font-semibold hover:text-slate-900 cursor-pointer select-none"
              >
                <div className="inline-flex items-center gap-1">
                  Frequency
                  {sortField === "frequency" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-900" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-900" />
                    )
                  ) : null}
                </div>
              </th>
              {/* Translation */}
              <th className="p-4 w-44 font-semibold">Translation</th>
              {/* Kindle Context sentence */}
              <th className="p-4 font-semibold">Context / Phrase</th>
            </tr>
          </thead>
          <tbody>
            {filteredWords.length === 0 ? (
              /* Empty Table Stage */
              <tr>
                <td colSpan={5} className="p-12 text-center space-y-3 text-slate-400">
                  <div className="h-10 w-10 mx-auto bg-slate-100 rounded flex items-center justify-center text-slate-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <div className="font-semibold text-slate-700 text-sm">No words found in list</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Try adjusting your filters, clearing search input, or importing a fresh SQLite Kindle vocab.db dictionary file.
                  </p>
                </td>
              </tr>
            ) : (
              /* Words listing rows */
              filteredWords.map((word) => {
                const book = word.bookId ? booksMap.get(word.bookId) : null;
                const isExpanded = expandedWordId === word.id;

                return (
                  <React.Fragment key={word.id}>
                    {/* Row item */}
                    <tr
                      className={`hover:bg-slate-50 border-b border-slate-200/70 text-xs text-slate-700 cursor-pointer ${
                        isExpanded ? "bg-slate-50/70" : ""
                      }`}
                    >
                      {/* Checkbox cell */}
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedWordIds.has(word.id)}
                          onChange={() => handleToggleSelectWord(word.id)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 focus:ring-opacity-0 cursor-pointer h-4 w-4"
                        />
                      </td>

                      {/* Word */}
                      <td
                        onClick={() => setExpandedWordId(isExpanded ? null : word.id)}
                        className="p-4 font-bold text-slate-900 hover:text-slate-950 space-y-0.5"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {word.word}
                        </div>
                        {word.ipa && <div className="text-[10px] text-slate-400 font-mono font-medium">{word.ipa}</div>}
                      </td>

                      {/* Frequency Rating */}
                      <td
                        onClick={() => setExpandedWordId(isExpanded ? null : word.id)}
                        className="p-4 select-none"
                      >
                        {(() => {
                          const freq = getWordFrequency(word.word, word.stem);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              freq.rating === "common" 
                                ? "bg-slate-100 text-slate-700 border-slate-200" 
                                : freq.rating === "intermediate" 
                                ? "bg-slate-800 text-slate-100 border-slate-900" 
                                : "bg-black text-white border-black"
                            }`}>
                              {Array.from({ length: freq.stars }).map((_, i) => "★").join("")} {freq.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Translation */}
                      <td
                        onClick={() => setExpandedWordId(isExpanded ? null : word.id)}
                        className="p-4 truncate"
                        title={word.translation}
                      >
                        {word.translation ? (
                          <span className="font-semibold text-slate-800">{word.translation}</span>
                        ) : (
                          <span className="italic text-slate-400">Not analyzed</span>
                        )}
                      </td>

                      {/* Original Sentence context */}
                      <td
                        onClick={() => setExpandedWordId(isExpanded ? null : word.id)}
                        className="p-4 truncate italic text-slate-500 max-w-sm"
                        title={word.context || "No context found"}
                      >
                        {word.context || <span className="opacity-40">-</span>}
                      </td>
                    </tr>

                    {/* Expand Detail Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50 border-b border-slate-200">
                        <td colSpan={5} className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in text-left">
                            {/* Left panel: word origin details */}
                            <div className="space-y-4 md:col-span-1 border-b md:border-b-0 md:border-r border-slate-200/60 pb-4 md:pb-0 md:pr-6">
                              <div className="space-y-1.5 font-sans">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Indexed Form</h4>
                                <div className="text-xl font-bold text-slate-900">{word.word}</div>
                                {word.ipa ? (
                                  <div className="text-xs text-slate-800 font-mono font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded inline-block">
                                    {word.ipa}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-400">IPA uncompiled</div>
                                )}
                              </div>

                              <div className="space-y-2 pt-2 text-[11px] text-slate-550 border-t border-slate-200/50">
                                <div className="flex justify-between">
                                  <span>Stem root:</span>
                                  <span className="font-mono font-bold text-slate-700">{word.stem || word.word}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Ebook language:</span>
                                  <span className="uppercase text-slate-700 font-bold">{word.lang}</span>
                                </div>
                                {book && (
                                  <div className="space-y-1 pt-2 border-t border-slate-200/50">
                                    <div className="font-semibold text-slate-800 truncate" title={book.title}>{book.title}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{book.author}</div>
                                  </div>
                                )}
                              </div>

                              {/* Manual Edit Button (When not in edit mode) */}
                              {editingWordId !== word.id && (
                                <button
                                  onClick={() => startEditingWord(word)}
                                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-250 hover:bg-slate-50 text-slate-750 font-bold rounded-lg text-xs transition cursor-pointer select-none"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-slate-900" />
                                  Edit Card Manually
                                </button>
                              )}
                            </div>

                            {/* Right panel: Edit Form OR Standard Display */}
                            <div className="space-y-4 md:col-span-2">
                              {editingWordId === word.id ? (
                                // --- EDIT MODE FORM ---
                                <div className="space-y-4 animate-fade-in bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-xs">
                                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                    <h4 className="font-bold text-slate-900 text-sm">Editing Word Card</h4>
                                    <span className="text-[10px] text-slate-450 uppercase font-mono tracking-wider">Indexed: {word.word}</span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Russian Translation</label>
                                      <input
                                        type="text"
                                        value={editTranslation}
                                        onChange={(e) => setEditTranslation(e.target.value)}
                                        placeholder="например: вездесущий, повсеместный"
                                        className="w-full text-xs border border-slate-200 bg-slate-50/50 px-3 py-2 rounded-lg focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">IPA Phonetic Transcription</label>
                                      <input
                                        type="text"
                                        value={editIpa}
                                        onChange={(e) => setEditIpa(e.target.value)}
                                        placeholder="например: /juːˈbɪkwɪtəs/"
                                        className="w-full text-xs font-mono border border-slate-200 bg-slate-50/50 px-3 py-2 rounded-lg focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">English definition & meanings</label>
                                    <textarea
                                      value={editExplanation}
                                      onChange={(e) => setEditExplanation(e.target.value)}
                                      placeholder="Existing or being everywhere at the same time; omnipresent."
                                      rows={2}
                                      className="w-full text-xs border border-slate-200 bg-slate-50/50 px-3 py-2 rounded-lg focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition resize-none"
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Usage Example Sentence</label>
                                    <textarea
                                      value={editExample}
                                      onChange={(e) => setEditExample(e.target.value)}
                                      placeholder="Write or paste an illustrative sentence using the word."
                                      rows={2}
                                      className="w-full text-xs border border-slate-200 bg-slate-50/50 px-3 py-2 rounded-lg focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition resize-none"
                                    />
                                  </div>
                                  <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingWordId(null)}
                                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold rounded-lg cursor-pointer transition select-none"
                                    >
                                      <X className="h-3 w-3" />
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => saveEditedWord(word)}
                                      className="inline-flex items-center gap-1 px-4 py-1.5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg cursor-pointer transition select-none shadow-sm"
                                    >
                                      <Save className="h-3 w-3" />
                                      Save Card
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // --- VIEW MODE DISPLAY ---
                                <>
                                  {word.translation || word.explanation || word.example ? (
                                    <div className="grid grid-cols-1 gap-4 font-sans">
                                      {word.translation && (
                                        <div className="space-y-0.5">
                                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Russian Translation</h4>
                                          <p className="text-base text-slate-950 font-extrabold">{word.translation}</p>
                                        </div>
                                      )}

                                      {word.explanation && (
                                        <div className="space-y-0.5">
                                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">English Definition</h4>
                                          <p className="text-slate-600 leading-relaxed text-xs font-sans">{word.explanation}</p>
                                        </div>
                                      )}

                                      {word.example && (
                                        <div className="p-3.5 bg-emerald-50/50 border border-emerald-100/70 rounded-lg space-y-1">
                                          <h4 className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                                            Usage Context
                                          </h4>
                                          <p className="text-emerald-950 italic text-xs leading-relaxed">{word.example}</p>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    // --- EMPTY STATE CARD TRIGGER ---
                                    <div className="h-full flex flex-col justify-center items-center py-6 text-center space-y-3.5">
                                      <div className="h-10 w-10 bg-slate-100 border border-slate-200 text-slate-500 rounded flex items-center justify-center shadow-sm">
                                        <Globe className="h-5 w-5 text-slate-900" />
                                      </div>
                                      <div className="space-y-1">
                                        <h4 className="font-bold text-slate-900 text-xs">
                                          No translation data yet
                                        </h4>
                                        <p className="text-[11px] text-slate-500 max-w-sm leading-relaxed">
                                          Retrieve transcription phonetics, English dictionary definitions, and target translations using keyless public APIs.
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={async () => {
                                            setSelectedWordIds(new Set([word.id]));
                                            setTimeout(() => handleBulkTranslate(), 50);
                                          }}
                                          disabled={isTranslating}
                                          className="h-8 px-4 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white rounded text-xs select-none cursor-pointer transition font-semibold shadow-sm"
                                        >
                                          Translate & Lookup
                                        </button>
                                        <button
                                          onClick={() => startEditingWord(word)}
                                          className="h-8 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded text-xs select-none cursor-pointer transition font-semibold shadow-sm"
                                        >
                                          Write Manually
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
