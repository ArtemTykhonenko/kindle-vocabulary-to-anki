/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Book, Word } from "../types";
import { getWordFrequency } from "../utils/frequency";
import {
  Search,
  Globe,
  Loader2,
  Trash2,
  Edit2,
  X,
  Plus,
  ArrowRight,
  BookOpen,
  Languages,
  Volume2
} from "lucide-react";
import { translateWordsBatch } from "../utils/api";
import { updateWordsBatch, updateWord } from "../utils/db";
import { playWordAudio } from "../utils/cardTemplates";

const LANGUAGES = [
  { code: "uk", name: "Ukrainian (Українська)" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish (Español)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "fr", name: "French (Français)" },
  { code: "it", name: "Italian (Italiano)" },
  { code: "pt", name: "Portuguese (Português)" },
  { code: "pl", name: "Polish (Polski)" },
  { code: "tr", name: "Turkish (Türkçe)" },
  { code: "ru", name: "Russian (Русский)" },
  { code: "zh", name: "Chinese (中文)" },
  { code: "ja", name: "Japanese (日本語)" },
  { code: "ko", name: "Korean (한국어)" },
  { code: "ar", name: "Arabic (العربية)" },
];

interface VocabularyTableProps {
  words: Word[];
  books: Book[];
  selectedBookId: string | null;
  onSelectBook: (bookId: string | null) => void;
  onRefreshWords: () => void;
  onNavigateToExport: () => void;
  onAddCustomWord: (word: Word, shouldTranslate?: boolean) => void;
  onDeleteWords: (ids: string[]) => void;
  autoTranslateTrigger?: number;
}

function speakWord(text: string, lang: string = "en-US") {
  playWordAudio(text, undefined, lang);
}

function renderHighlightedSentence(sentence: string, targetWord: string, stem?: string) {
  if (!sentence || !targetWord) return sentence;
  const cleanWord = targetWord.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "");
  const cleanStem = (stem || cleanWord).trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "");
  if (!cleanWord) return sentence;

  try {
    const escapedWord = cleanWord.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const escapedStem = cleanStem.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(\\b(?:${escapedWord}|${escapedStem}[a-z]*)\\b)`, "gi");
    const parts = sentence.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <strong
          key={i}
          className="font-bold text-white underline decoration-cyan-400/80 decoration-2 underline-offset-2"
        >
          {part}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  } catch {
    return sentence;
  }
}

export default function VocabularyTable({
  words,
  books,
  selectedBookId,
  onSelectBook,
  onRefreshWords,
  onNavigateToExport,
  onAddCustomWord,
  onDeleteWords,
  autoTranslateTrigger = 0,
}: VocabularyTableProps) {
  // Counts
  const translatedCount = useMemo(() => words.filter((w) => w.translation).length, [words]);
  const untranslatedCount = words.length - translatedCount;
  const readyPercent = words.length > 0 ? Math.round((translatedCount / words.length) * 100) : 0;

  // Target Language (defaults to Ukrainian "uk")
  const [targetLang, setTargetLang] = useState<string>(() => {
    localStorage.removeItem("kindle_target_lang");
    return localStorage.getItem("k2a_target_lang_uk_v2") || "uk";
  });
  const [sourceLang] = useState<string>("auto");

  useEffect(() => {
    localStorage.setItem("k2a_target_lang_uk_v2", targetLang);
  }, [targetLang]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "untranslated" | "ready">("all");
  const [freqFilter] = useState<string>("all");

  // Selection
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());

  // Translation Progress
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ done: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastTriggerRef = useRef<number>(0);

  // Edit Word Modal State
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [editForm, setEditForm] = useState({
    word: "",
    translation: "",
    ipa: "",
    explanation: "",
    example: "",
    context: "",
  });

  // Add Word Modal State
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [newWordText, setNewWordText] = useState("");
  const [newTranslationText, setNewTranslationText] = useState("");
  const [newExampleText, setNewExampleText] = useState("");
  const [autoTranslateNewWord, setAutoTranslateNewWord] = useState(true);

  // Filtered Words
  const filteredWords = useMemo(() => {
    return words
      .filter((w) => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          !term ||
          w.word.toLowerCase().includes(term) ||
          (w.stem && w.stem.toLowerCase().includes(term)) ||
          (w.translation && w.translation.toLowerCase().includes(term)) ||
          (w.bookTitle && w.bookTitle.toLowerCase().includes(term));

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "ready" && !!w.translation) ||
          (statusFilter === "untranslated" && !w.translation);

        const matchesFreq =
          freqFilter === "all" || getWordFrequency(w.word, w.stem).rating === freqFilter;

        const matchesBook = !selectedBookId || w.bookId === selectedBookId;

        return matchesSearch && matchesStatus && matchesFreq && matchesBook;
      })
      .sort((a, b) => {
        const timeA = a.lookupTimestamp || a.wordTimestamp || 0;
        const timeB = b.lookupTimestamp || b.wordTimestamp || 0;
        return timeB - timeA;
      });
  }, [words, searchTerm, statusFilter, freqFilter, selectedBookId]);

  const allFilteredSelected =
    filteredWords.length > 0 && filteredWords.every((w) => selectedWordIds.has(w.id));

  // Selection helpers
  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedWordIds(new Set());
    } else {
      setSelectedWordIds(new Set(filteredWords.map((w) => w.id)));
    }
  };

  const handleToggleSelectWord = (id: string) => {
    const next = new Set(selectedWordIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedWordIds(next);
  };

  // Bulk Delete Action
  const handleDeleteSelected = () => {
    if (selectedWordIds.size === 0) return;
    const idsToDelete: string[] = Array.from(selectedWordIds);
    setSelectedWordIds(new Set());
    onDeleteWords(idsToDelete);
  };

  // Translation Action
  const handleTranslateWords = async (targetIds?: string[]) => {
    const untranslatedIds = words
      .filter((w) => !w.translation || !w.explanation || !w.example)
      .map((w) => w.id);

    const idsToTranslate =
      targetIds && targetIds.length > 0
        ? targetIds
        : selectedWordIds.size > 0
        ? Array.from(selectedWordIds)
        : untranslatedIds.length > 0
        ? untranslatedIds
        : words.map((w) => w.id);

    if (idsToTranslate.length === 0) return;

    setIsTranslating(true);
    setTranslationProgress({ done: 0, total: idsToTranslate.length });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const targetWords = words.filter((w) => idsToTranslate.includes(w.id));
    const items = targetWords.map((w) => ({
      word: w.word,
      stem: w.stem || w.word,
      context: w.context,
      lang: w.lang,
    }));

    try {
      const results = await translateWordsBatch(
        items,
        sourceLang,
        targetLang,
        (done, total) => {
          setTranslationProgress({ done, total });
        },
        controller.signal
      );

      const updatedWords: Word[] = [];
      for (const w of targetWords) {
        const found = results.find(
          (r) => r.word.toLowerCase().trim() === w.word.toLowerCase().trim()
        );
        if (found) {
          updatedWords.push({
            ...w,
            translation: found.translation || w.translation,
            ipa: found.ipa || w.ipa,
            explanation: found.explanation || w.explanation,
            example: found.example || w.example,
          });
        }
      }

      if (updatedWords.length > 0) {
        await updateWordsBatch(updatedWords);
      }

      setSelectedWordIds(new Set());
      onRefreshWords();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsTranslating(false);
      abortControllerRef.current = null;
    }
  };

  // Auto-trigger translation when words are freshly imported
  useEffect(() => {
    if (
      autoTranslateTrigger > 0 &&
      autoTranslateTrigger !== lastTriggerRef.current &&
      words.length > 0 &&
      !isTranslating
    ) {
      const needsTranslation = words
        .filter((w) => !w.translation || !w.explanation)
        .map((w) => w.id);
      if (needsTranslation.length > 0) {
        lastTriggerRef.current = autoTranslateTrigger;
        handleTranslateWords(needsTranslation);
      }
    }
  }, [autoTranslateTrigger, words.length]);

  // Edit Action
  const handleOpenEdit = (w: Word) => {
    setEditingWord(w);
    setEditForm({
      word: w.word,
      translation: w.translation || "",
      ipa: w.ipa || "",
      explanation: w.explanation || "",
      example: w.example || "",
      context: w.context || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingWord) return;
    const updated: Word = {
      ...editingWord,
      word: editForm.word.trim(),
      translation: editForm.translation.trim() || undefined,
      ipa: editForm.ipa.trim() || undefined,
      explanation: editForm.explanation.trim() || undefined,
      example: editForm.example.trim() || undefined,
      context: editForm.context.trim() || undefined,
    };
    await updateWord(updated);
    setEditingWord(null);
    onRefreshWords();
  };

  // Quick Add Action
  const handleCreateNewWord = () => {
    if (!newWordText.trim()) return;
    const cleanWord = newWordText.trim();
    const newWord: Word = {
      id: `custom:${Date.now()}:${cleanWord.toLowerCase()}`,
      word: cleanWord,
      stem: cleanWord,
      lang: "en",
      wordTimestamp: Date.now(),
      translation: newTranslationText.trim() || undefined,
      example: newExampleText.trim() || undefined,
      status: "new",
      addedAt: Date.now(),
    };
    onAddCustomWord(newWord, autoTranslateNewWord && !newTranslationText.trim());
    setNewWordText("");
    setNewTranslationText("");
    setNewExampleText("");
    setIsAddingWord(false);
  };

  return (
    <div className="space-y-5 text-left">
      {/* Simple, Clean Top Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Translate & Edit Flashcards
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Review translations, listen to pronunciation, or edit any card before exporting to Anki.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddingWord(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#131724] hover:bg-[#1B2133] border border-white/10 text-slate-200 rounded-xl transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5 text-slate-400" />
            <span>Add Word</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToExport}
            disabled={words.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-35 text-white rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.35)] transition cursor-pointer whitespace-nowrap"
          >
            <span>Continue to Export ({words.length})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* UNIFIED DARK GLASS WORKSPACE CONTAINER */}
      <div className="bg-[#0E111B]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Readiness & Controls Section */}
        <div className="p-5 sm:p-6 border-b border-white/10 space-y-4">
          {/* Readiness Progress Bar */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400 font-medium">
                <span className="font-bold text-white tabular-nums">
                  {translatedCount} of {words.length} cards translated
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-semibold tabular-nums">
                  {readyPercent}% ready
                </span>
                {untranslatedCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400 font-semibold tabular-nums">
                      {untranslatedCount} untranslated
                    </span>
                  </>
                )}
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Includes Translation · IPA Phonetics · Usage Example
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.max(readyPercent, words.length > 0 ? 3 : 0)}%` }}
                className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
              />
            </div>
          </div>

          {/* Search, Language & Translate / Delete Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pt-1">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search words, translations, books..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-xs bg-[#151926] hover:bg-[#181D2C] focus:bg-[#181D2C] border border-white/10 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Translate To, Translate Button & Delete Selected Button */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Globe className="h-3.5 w-3.5 text-indigo-400" />
                <span>Translate to:</span>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  aria-label="Target language"
                  className="text-xs bg-[#151926] border border-white/10 rounded-xl px-3 py-2 font-bold text-white hover:border-white/20 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-[#111522] text-white">
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleTranslateWords()}
                disabled={isTranslating || words.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-gradient-to-r from-violet-600 via-indigo-500 to-teal-400 hover:opacity-95 disabled:opacity-35 text-white rounded-xl shadow-[0_0_22px_rgba(45,212,191,0.3)] transition cursor-pointer whitespace-nowrap"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="tabular-nums">
                      Translating ({translationProgress.done}/{translationProgress.total})
                    </span>
                  </>
                ) : (
                  <>
                    <Languages className="h-3.5 w-3.5" />
                    <span>
                      {selectedWordIds.size > 0
                        ? `Translate Selected (${selectedWordIds.size})`
                        : untranslatedCount > 0
                        ? `Translate (${untranslatedCount})`
                        : "Translate All"}
                    </span>
                  </>
                )}
              </button>

              {selectedWordIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete ({selectedWordIds.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub-row Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/8 text-xs">
            <div className="flex items-center gap-1 p-1 bg-[#141826] border border-white/8 rounded-xl">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer tabular-nums whitespace-nowrap ${
                  statusFilter === "all"
                    ? "bg-white/12 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All ({words.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ready")}
                className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer tabular-nums whitespace-nowrap ${
                  statusFilter === "ready"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Translated ({translatedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("untranslated")}
                className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer tabular-nums whitespace-nowrap ${
                  statusFilter === "untranslated"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Untranslated ({untranslatedCount})
              </button>
            </div>

            {books.length > 0 && (
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                <select
                  value={selectedBookId || ""}
                  onChange={(e) => onSelectBook(e.target.value || null)}
                  aria-label="Filter by Kindle book"
                  className="text-xs bg-[#141826] border border-white/10 rounded-xl px-2.5 py-1.5 font-semibold text-slate-200 cursor-pointer"
                >
                  <option value="" className="bg-[#111522]">
                    All Kindle books ({books.length})
                  </option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id} className="bg-[#111522]">
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Active Translation Progress Bar */}
        {isTranslating && (
          <div className="px-6 py-3 bg-indigo-950/40 border-b border-indigo-500/30 space-y-2 animate-fade-in">
            <div className="flex justify-between items-center text-xs text-indigo-200 font-bold">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                Translating words and fetching IPA phonetics, definitions & examples...
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono tabular-nums">
                  {translationProgress.done} / {translationProgress.total}
                </span>
                <button
                  type="button"
                  onClick={() => abortControllerRef.current?.abort()}
                  className="px-2 py-0.5 text-[11px] bg-white/10 border border-white/15 rounded text-slate-200 hover:text-red-400 cursor-pointer"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile View: Responsive Card List */}
        <div className="sm:hidden divide-y divide-white/8">
          {filteredWords.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No words match your current filter.
            </div>
          ) : (
            filteredWords.map((word) => {
              const isSelected = selectedWordIds.has(word.id);
              const hasDistinctExample =
                word.example &&
                word.example.trim().toLowerCase() !== (word.context || "").trim().toLowerCase();

              return (
                <div
                  key={word.id}
                  className={`p-4 space-y-2.5 text-left transition ${
                    isSelected ? "bg-indigo-950/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectWord(word.id)}
                        className="mt-1 rounded border-white/20 bg-white/5 text-violet-600 focus:ring-0 cursor-pointer h-4 w-4"
                        aria-label={`Select ${word.word}`}
                      />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-base">{word.word}</span>
                          <button
                            type="button"
                            onClick={() => speakWord(word.word, word.lang)}
                            className="p-1 text-slate-400 hover:text-cyan-400 rounded-md transition cursor-pointer"
                            title="Listen to pronunciation"
                            aria-label={`Pronounce ${word.word}`}
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {word.ipa && (
                          <div className="text-xs text-indigo-300/90 font-mono">{word.ipa}</div>
                        )}
                        {word.bookTitle && (
                          <div className="text-[11px] text-amber-400/90 font-medium">
                            {word.bookTitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(word)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                        title="Edit card"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteWords([word.id])}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg"
                        title="Delete word"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {word.translation ? (
                    <div className="text-sm font-bold text-slate-100">{word.translation}</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTranslateWords([word.id])}
                      className="text-xs text-indigo-400 underline font-semibold cursor-pointer"
                    >
                      + Translate
                    </button>
                  )}

                  {word.explanation && (
                    <div className="text-xs text-slate-200 leading-relaxed">{word.explanation}</div>
                  )}

                  {word.context && (
                    <div className="text-[11px] text-slate-200 italic bg-amber-950/35 p-2.5 rounded-xl border border-amber-500/30 leading-relaxed">
                      <span className="not-italic font-bold text-amber-400 mr-1.5">Kindle:</span>
                      {renderHighlightedSentence(word.context, word.word, word.stem)}
                    </div>
                  )}

                  {hasDistinctExample && (
                    <div className="text-[11px] text-slate-200 italic bg-emerald-950/35 p-2.5 rounded-xl border border-emerald-500/30 leading-relaxed">
                      <span className="not-italic font-bold text-emerald-400 mr-1.5">
                        Example:
                      </span>
                      {renderHighlightedSentence(word.example!, word.word, word.stem)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Main Data Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-[#121622] border-b border-white/10 text-slate-400 font-semibold text-xs select-none">
                <th className="w-11 p-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded border-white/20 bg-white/5 text-violet-600 focus:ring-0 cursor-pointer h-4 w-4"
                    aria-label="Select all words"
                    title="Select all words"
                  />
                </th>
                <th className="p-3.5 w-48 font-semibold text-slate-300">Word & Phonetics</th>
                <th className="p-3.5 w-48 font-semibold text-slate-300">Translation</th>
                <th className="p-3.5 font-semibold text-slate-300">
                  Definition, Kindle Quote & Example
                </th>
                <th className="p-3.5 w-24 text-right font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8 text-xs">
              {filteredWords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 space-y-2">
                    <div className="text-sm font-bold text-slate-300">No words in view</div>
                    <p className="text-xs text-slate-500">
                      Try clearing your search filter or import new words.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredWords.map((word) => {
                  const isSelected = selectedWordIds.has(word.id);
                  const hasDistinctExample =
                    word.example &&
                    word.example.trim().toLowerCase() !==
                      (word.context || "").trim().toLowerCase();

                  return (
                    <tr
                      key={word.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isSelected ? "bg-indigo-950/35" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-4 text-center align-top pt-4.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectWord(word.id)}
                          className="rounded border-white/20 bg-white/5 text-violet-600 focus:ring-0 cursor-pointer h-4 w-4"
                          aria-label={`Select ${word.word}`}
                        />
                      </td>

                      {/* Word + Audio + IPA + Book */}
                      <td className="p-4 align-top space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm">{word.word}</span>
                          <button
                            type="button"
                            onClick={() => speakWord(word.word, word.lang)}
                            className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-md transition cursor-pointer"
                            title="Listen to pronunciation"
                            aria-label={`Pronounce ${word.word}`}
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {word.ipa && (
                          <div className="text-[11px] text-indigo-300/90 font-mono">{word.ipa}</div>
                        )}
                        {word.bookTitle && (
                          <div
                            className="text-[11px] text-amber-400/90 font-medium truncate max-w-[165px]"
                            title={word.bookTitle}
                          >
                            {word.bookTitle}
                          </div>
                        )}
                      </td>

                      {/* Translation */}
                      <td className="p-4 align-top">
                        {word.translation ? (
                          <div className="font-bold text-slate-100 text-xs leading-snug">
                            {word.translation}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTranslateWords([word.id])}
                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                          >
                            <Languages className="h-3 w-3" />
                            <span>Translate</span>
                          </button>
                        )}
                      </td>

                      {/* Definition + Kindle Context + Example */}
                      <td className="p-4 align-top space-y-2.5">
                        {word.explanation ? (
                          <div className="text-slate-100 leading-relaxed text-xs font-medium">
                            {word.explanation}
                          </div>
                        ) : (
                          <div className="text-slate-500 italic text-[11px]">
                            Click "Translate" to fetch definition & example
                          </div>
                        )}

                        {word.context && (
                          <div className="text-[11px] text-slate-200 italic bg-amber-950/35 px-3.5 py-2.5 rounded-xl border border-amber-500/30 leading-relaxed">
                            <span className="not-italic font-bold text-amber-400 mr-1.5">
                              Kindle:
                            </span>
                            {renderHighlightedSentence(word.context, word.word, word.stem)}
                          </div>
                        )}

                        {hasDistinctExample && (
                          <div className="text-[11px] text-slate-200 italic bg-emerald-950/35 px-3.5 py-2.5 rounded-xl border border-emerald-500/30 leading-relaxed">
                            <span className="not-italic font-bold text-emerald-400 mr-1.5">
                              Example:
                            </span>
                            {renderHighlightedSentence(word.example!, word.word, word.stem)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 align-top text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(word)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/8 rounded-lg transition cursor-pointer"
                            title="Edit card fields"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteWords([word.id])}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                            title="Delete word"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: EDIT WORD */}
      {editingWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#121624] border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Edit Flashcard</h3>
              <button
                type="button"
                onClick={() => setEditingWord(null)}
                className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">Word</label>
                  <input
                    type="text"
                    value={editForm.word}
                    onChange={(e) => setEditForm({ ...editForm, word: e.target.value })}
                    className="w-full text-xs p-2.5 bg-[#0B0E17] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">Phonetic IPA</label>
                  <input
                    type="text"
                    value={editForm.ipa}
                    onChange={(e) => setEditForm({ ...editForm, ipa: e.target.value })}
                    placeholder="/.../"
                    className="w-full text-xs font-mono p-2.5 bg-[#0B0E17] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">Translation</label>
                <input
                  type="text"
                  value={editForm.translation}
                  onChange={(e) => setEditForm({ ...editForm, translation: e.target.value })}
                  className="w-full text-xs p-2.5 bg-[#0B0E17] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Definition / Meaning
                </label>
                <textarea
                  rows={2}
                  value={editForm.explanation}
                  onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                  className="w-full text-xs p-2.5 bg-[#0B0E17] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Usage Example Sentence
                </label>
                <textarea
                  rows={2}
                  value={editForm.example}
                  onChange={(e) => setEditForm({ ...editForm, example: e.target.value })}
                  className="w-full text-xs p-2.5 bg-[#0B0E17] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {editForm.context && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-amber-400 block">
                    Original Kindle Quote
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.context}
                    onChange={(e) => setEditForm({ ...editForm, context: e.target.value })}
                    className="w-full text-xs p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingWord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl transition cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOM WORD */}
      {isAddingWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#121624] border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Add Word to Deck</h3>
              <button
                type="button"
                onClick={() => setIsAddingWord(false)}
                className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">Word *</label>
                <input
                  type="text"
                  placeholder="e.g. ubiquitous"
                  value={newWordText}
                  onChange={(e) => setNewWordText(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#0B0E17] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Translation (optional — leave blank to auto-translate)
                </label>
                <input
                  type="text"
                  placeholder="e.g. всюдисущий"
                  value={newTranslationText}
                  onChange={(e) => setNewTranslationText(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#0B0E17] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Example Sentence (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Sentence showing how the word is used..."
                  value={newExampleText}
                  onChange={(e) => setNewExampleText(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#0B0E17] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoTranslateNewWord}
                  onChange={(e) => setAutoTranslateNewWord(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500 h-4 w-4"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Auto-translate (adds translation, IPA, definition & example)
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsAddingWord(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNewWord}
                disabled={!newWordText.trim()}
                className="px-5 py-2 text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 disabled:opacity-35 text-white rounded-xl transition cursor-pointer"
              >
                Add Word
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
