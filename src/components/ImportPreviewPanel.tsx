/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Book, Word } from "../types";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Database,
  BookOpen,
  ArrowRight,
  RefreshCw,
  FolderOpen
} from "lucide-react";

interface ImportPreviewPanelProps {
  words: Word[];
  books: Book[];
  rawDb: ArrayBuffer | null;
  ankiWords: Set<string> | null;
  onConfirmImport: (selectedWords: Word[], selectedBooks: Book[], rawDb: ArrayBuffer | null) => void;
  onCancel: () => void;
}

interface WordWithMatch extends Word {
  inAnki: boolean;
}

export default function ImportPreviewPanel({
  words,
  books,
  rawDb,
  ankiWords,
  onConfirmImport,
  onCancel
}: ImportPreviewPanelProps) {
  // Pre-annotate words with whether they exist in the Anki file
  const wordsWithMatch = useMemo<WordWithMatch[]>(() => {
    return words.map((w) => {
      const inAnki = ankiWords
        ? ankiWords.has(w.word.toLowerCase()) || ankiWords.has(w.stem.toLowerCase())
        : false;
      return { ...w, inAnki };
    });
  }, [words, ankiWords]);

  // Set initial selections: auto-deselect duplicate words if they are in Anki, check everything else
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    wordsWithMatch.forEach((w) => {
      if (!w.inAnki) {
        initial.add(w.id);
      }
    });
    return initial;
  });

  // UI state for search, filters, sorting, and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "duplicate">("all");
  const [sortField, setSortField] = useState<"word" | "book" | "status">("status");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Book mapping for easy title lookup
  const booksMap = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  // Count stats
  const totalCount = words.length;
  const duplicateCount = useMemo(() => wordsWithMatch.filter((w) => w.inAnki).length, [wordsWithMatch]);
  const newCount = totalCount - duplicateCount;
  const selectedCount = selectedWordIds.size;

  // Filter & Sort list
  const processedWords = useMemo(() => {
    return wordsWithMatch
      .filter((w) => {
        // Search filter
        const matchesSearch =
          w.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
          w.stem.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (w.bookTitle && w.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()));

        // Status filter
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "new" && !w.inAnki) ||
          (statusFilter === "duplicate" && w.inAnki);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortField === "status") {
          // Sort duplicates first or last
          const valA = a.inAnki ? 1 : 0;
          const valB = b.inAnki ? 1 : 0;
          return sortOrder === "asc" ? valA - valB : valB - valA;
        } else if (sortField === "book") {
          const valA = (a.bookTitle || "").toLowerCase();
          const valB = (b.bookTitle || "").toLowerCase();
          return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          // default word sort
          const valA = a.word.toLowerCase();
          const valB = b.word.toLowerCase();
          return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
      });
  }, [wordsWithMatch, searchTerm, statusFilter, sortField, sortOrder]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Paginated slices
  const totalPages = Math.ceil(processedWords.length / itemsPerPage) || 1;
  const paginatedWords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedWords.slice(start, start + itemsPerPage);
  }, [processedWords, currentPage]);

  // Selection actions
  const handleToggleSelectWord = (id: string) => {
    const next = new Set(selectedWordIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedWordIds(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedWordIds);
    processedWords.forEach((w) => next.add(w.id));
    setSelectedWordIds(next);
  };

  const handleDeselectAllFiltered = () => {
    const next = new Set(selectedWordIds);
    processedWords.forEach((w) => next.delete(w.id));
    setSelectedWordIds(next);
  };

  const handleExcludeAllAnkiDuplicates = () => {
    const next = new Set(selectedWordIds);
    wordsWithMatch.forEach((w) => {
      if (w.inAnki) {
        next.delete(w.id);
      }
    });
    setSelectedWordIds(next);
  };

  const handleSelectOnlyNew = () => {
    const next = new Set<string>();
    wordsWithMatch.forEach((w) => {
      if (!w.inAnki) {
        next.add(w.id);
      }
    });
    setSelectedWordIds(next);
  };

  const handleSort = (field: "word" | "book" | "status") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Submit action
  const handleConfirm = () => {
    if (selectedCount === 0) {
      alert("Please select at least one word to import.");
      return;
    }

    const selectedWords = words.filter((w) => selectedWordIds.has(w.id));
    
    // Filter books list to only contain books containing imported words
    const selectedBookIds = new Set(selectedWords.map((w) => w.bookId));
    const selectedBooks = books.filter((b) => selectedBookIds.has(b.id));

    onConfirmImport(selectedWords, selectedBooks, rawDb);
  };

  return (
    <div className="space-y-6 py-2">
      {/* Navigation Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer select-none shadow-sm hover:shadow"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
          <span>Back to Upload</span>
        </button>
      </div>

      <div className="space-y-1 text-left font-sans">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Import Preview & Reconciliation</h2>
        <p className="text-slate-500 text-sm">
          Review words extracted from your Kindle database. We matched them against your Anki file to filter duplicates.
        </p>
      </div>

      {/* Stats Dash Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-sans">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-left flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total in Kindle</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Words in vocab.db</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-left flex flex-col justify-between border-l-4 border-l-amber-500">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duplicates in Anki</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{duplicateCount}</div>
          <div className="text-[10px] text-slate-405 mt-0.5">Found in your Anki file</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-left flex flex-col justify-between border-l-4 border-l-emerald-500">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Words</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{newCount}</div>
          <div className="text-[10px] text-slate-405 mt-0.5">Unique to Kindle</div>
        </div>

        <div className="p-4 bg-slate-900 text-white border border-slate-800 rounded-xl shadow-md text-left flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-350 uppercase tracking-wider">Selected for Import</div>
          <div className="text-2xl font-extrabold text-white mt-1">{selectedCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Will be saved to local DB</div>
        </div>
      </div>

      {/* Auto Reconciliation Banner */}
      {ankiWords && duplicateCount > 0 && (
        <div className="bg-amber-50/20 border border-amber-200/50 rounded-xl p-4 text-left flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 font-sans">
            <h4 className="font-bold text-slate-900 text-sm">Anki Duplicates Auto-Deselected</h4>
            <p className="text-xs text-slate-650 leading-relaxed font-sans">
              We identified <b>{duplicateCount}</b> words that are already present in your Anki file. They have been automatically unchecked below so you can import only new cards. You can toggle them manually if you wish.
            </p>
            <div className="flex gap-3 pt-1.5 font-sans">
              <button
                onClick={handleSelectOnlyNew}
                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 hover:underline cursor-pointer"
              >
                Keep Only New Words
              </button>
              <span className="text-slate-300 text-xs">|</span>
              <button
                onClick={handleExcludeAllAnkiDuplicates}
                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 hover:underline cursor-pointer"
              >
                Deselect All Duplicates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm font-sans">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search words, stems, or books..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 hover:bg-slate-100 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition"
          />
        </div>

        {/* Filter & Selection Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs bg-white border border-slate-200 rounded-md px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
            >
              <option value="all">All words ({processedWords.length})</option>
              <option value="new">New words only</option>
              <option value="duplicate">Duplicates only</option>
            </select>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllFiltered}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold cursor-pointer transition select-none"
            >
              Select All Shown
            </button>
            <button
              onClick={handleDeselectAllFiltered}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold cursor-pointer transition select-none"
            >
              Deselect All Shown
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs select-none uppercase tracking-wider">
              {/* Checkbox */}
              <th className="w-12 p-4 text-center">
                <input
                  type="checkbox"
                  checked={
                    processedWords.length > 0 &&
                    processedWords.every((w) => selectedWordIds.has(w.id))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleSelectAllFiltered();
                    } else {
                      handleDeselectAllFiltered();
                    }
                  }}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 focus:ring-opacity-0 cursor-pointer h-4 w-4"
                />
              </th>
              {/* Word Column */}
              <th
                onClick={() => handleSort("word")}
                className="p-4 w-48 font-semibold hover:text-slate-900 cursor-pointer select-none"
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
              {/* Book Column */}
              <th
                onClick={() => handleSort("book")}
                className="p-4 w-52 font-semibold hover:text-slate-900 cursor-pointer select-none"
              >
                <div className="inline-flex items-center gap-1">
                  Ebook Source
                  {sortField === "book" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-900" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-900" />
                    )
                  ) : null}
                </div>
              </th>
              {/* Anki Match Status Column */}
              <th
                onClick={() => handleSort("status")}
                className="p-4 w-44 font-semibold hover:text-slate-900 cursor-pointer select-none"
              >
                <div className="inline-flex items-center gap-1">
                  Anki Status
                  {sortField === "status" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-900" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-900" />
                    )
                  ) : null}
                </div>
              </th>
              {/* Context Column */}
              <th className="p-4 font-semibold">Kindle Context</th>
            </tr>
          </thead>
          <tbody>
            {paginatedWords.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center space-y-3 text-slate-400">
                  <div className="h-10 w-10 mx-auto bg-slate-100 rounded flex items-center justify-center text-slate-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <div className="font-semibold text-slate-700 text-sm">No matching words found</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Try updating your search query or choosing a different filter option.
                  </p>
                </td>
              </tr>
            ) : (
              paginatedWords.map((word) => {
                const isSelected = selectedWordIds.has(word.id);
                return (
                  <tr
                    key={word.id}
                    onClick={() => handleToggleSelectWord(word.id)}
                    className={`hover:bg-slate-50 border-b border-slate-200/70 text-xs text-slate-700 cursor-pointer transition ${
                      isSelected ? "" : "opacity-60 bg-slate-50/20"
                    }`}
                  >
                    {/* Checkbox cell */}
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectWord(word.id)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 focus:ring-opacity-0 cursor-pointer h-4 w-4"
                      />
                    </td>

                    {/* Word */}
                    <td className="p-4 font-bold text-slate-900 space-y-0.5 truncate">
                      <div className="font-bold text-slate-900">{word.word}</div>
                      {word.stem && word.stem !== word.word && (
                        <div className="text-[10px] text-slate-400 font-mono font-medium">
                          stem: {word.stem}
                        </div>
                      )}
                    </td>

                    {/* Book */}
                    <td className="p-4 truncate" title={word.bookTitle || "Unknown Book"}>
                      <div className="font-semibold text-slate-800 truncate">
                        {word.bookTitle || "Unknown Book"}
                      </div>
                      {word.bookAuthor && (
                        <div className="text-[10px] text-slate-400 truncate">{word.bookAuthor}</div>
                      )}
                    </td>

                    {/* Anki Status */}
                    <td className="p-4 select-none" onClick={(e) => e.stopPropagation()}>
                      {word.inAnki ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold border bg-amber-50/50 text-amber-800 border-amber-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                          Already in Anki
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold border bg-emerald-50/50 text-emerald-800 border-emerald-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          New Word
                        </span>
                      )}
                    </td>

                    {/* Context */}
                    <td
                      className="p-4 truncate italic text-slate-500 max-w-sm"
                      title={word.context || "No context"}
                    >
                      {word.context || <span className="opacity-30">-</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-semibold text-slate-650 font-sans">
          <div className="text-slate-500">
            Showing <b>{Math.min(processedWords.length, (currentPage - 1) * itemsPerPage + 1)}</b> to{" "}
            <b>{Math.min(processedWords.length, currentPage * itemsPerPage)}</b> of{" "}
            <b>{processedWords.length}</b> words
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-350 rounded-lg cursor-pointer transition select-none disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center px-2">
              Page {currentPage} of {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-350 rounded-lg cursor-pointer transition select-none disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Confirm & Cancel Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200/60 font-sans">
        <button
          onClick={onCancel}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer select-none shadow-sm"
        >
          Cancel Import
        </button>
        <button
          onClick={handleConfirm}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs transition cursor-pointer select-none shadow-md hover:shadow-lg hover:scale-[1.01]"
        >
          <span>Confirm Import ({selectedCount} words)</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
