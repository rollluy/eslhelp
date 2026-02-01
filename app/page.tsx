'use client';

import { useState, useCallback } from 'react';
import { SUPPORTED_LANGUAGES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from '@/lib/languages';

// ---------------------------------------------------------------------------
// Types (mirror what the API returns)
// ---------------------------------------------------------------------------
interface ActionItem {
  step: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  professionalType?: string | null;
}

interface ProcessingResult {
  success: boolean;
  translatedSummary: string;
  actionPlan: ActionItem[];
  targetLanguage: string;
  summaryLength: number;
  originalLength: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getPriorityStyles(priority: string) {
  switch (priority) {
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'medium':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Home() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string>('');

  // -------------------------------------------------------
  // File validation (shared between input change & drag-drop)
  // -------------------------------------------------------
  const validateAndSetFile = useCallback((selectedFile: File | null) => {
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError(`File exceeds the ${MAX_FILE_SIZE_LABEL} limit (uploaded: ${formatFileSize(selectedFile.size)}).`);
      setFile(null);
      return;
    }

    if (selectedFile.size === 0) {
      setError('The selected file is empty.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError('');
    setResult(null);
  }, []);

  // -------------------------------------------------------
  // Drag & drop handlers
  // -------------------------------------------------------
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    validateAndSetFile(dropped);
  }, [validateAndSetFile]);

  // -------------------------------------------------------
  // Submit
  // -------------------------------------------------------
  const handleSubmit = async () => {
    if (!file || !selectedLanguage) return;

    setLoading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);                        // ← raw File object, sent as multipart binary
    formData.append('language', selectedLanguage);

    try {
      const response = await fetch('/api/translateFile', {
        method: 'POST',
        // Do NOT set Content-Type manually — the browser sets it to
        // multipart/form-data with the correct boundary automatically.
        body: formData,
      });

      const data: ProcessingResult = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Server error (${response.status})`);
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while processing your document.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <header className="text-center pt-4 pb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
            Document Translation & Guidance
          </h1>
          <p className="text-slate-500 mt-2 text-base md:text-lg">
            Upload a legal or medical PDF — we'll summarize it in plain language and translate it for you.
          </p>
        </header>

        {/* Step 1 — Language */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">1</span>
            Select Your Language
          </h2>

          <div className="grid grid-cols-3 gap-3">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.key}
                onClick={() => { setSelectedLanguage(lang.key); setResult(null); setError(''); }}
                className={`rounded-xl border-2 p-4 text-center transition-all duration-150
                  ${selectedLanguage === lang.key
                    ? 'border-blue-600 bg-blue-50 shadow-sm'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                  }`}
              >
                <div className="text-3xl mb-1">{lang.flag}</div>
                <div className="text-sm font-semibold text-slate-700">{lang.label}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Step 2 — Upload (only shown after language selection) */}
        {selectedLanguage && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">2</span>
              Upload Your PDF
            </h2>

            {/* Drop zone */}
            <label
              htmlFor="file-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-150
                ${isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : file
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                }`}
            >
              <input
                id="file-upload"
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
              />

              {file ? (
                <>
                  <svg className="w-10 h-10 text-emerald-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-slate-700 font-medium">{file.name}</span>
                  <span className="text-slate-400 text-sm">{formatFileSize(file.size)}</span>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-slate-600 font-medium">Drag & drop your PDF here</span>
                  <span className="text-slate-400 text-sm mt-0.5">or click to browse — max {MAX_FILE_SIZE_LABEL}</span>
                </>
              )}
            </label>

            {/* Submit button */}
            {file && (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="mt-4 w-full rounded-xl bg-blue-600 text-white py-3.5 font-semibold text-base
                  hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing…
                  </span>
                ) : (
                  'Translate & Summarize'
                )}
              </button>
            )}
          </section>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result?.success && (
          <div className="space-y-4">

            {/* Translated Summary */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-sm">✓</span>
                Translated Summary
                <span className="text-sm font-normal text-slate-400 capitalize">({result.targetLanguage})</span>
              </h2>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                  {result.translatedSummary}
                </p>
              </div>

              <div className="mt-3 flex gap-3 text-xs text-slate-400">
                <span>Original document: {result.originalLength.toLocaleString()} characters</span>
                <span>•</span>
                <span>Summary: {result.summaryLength.toLocaleString()} characters</span>
              </div>
            </section>

            {/* Action Plan */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-700 mb-4">
                📋 Recommended Next Steps
              </h2>

              <ol className="space-y-3">
                {result.actionPlan.map((action, i) => (
                  <li
                    key={i}
                    className="border-l-4 border-blue-600 bg-slate-50 rounded-r-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">
                          {i + 1}
                        </span>
                        {action.step}
                      </h3>
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getPriorityStyles(action.priority)}`}>
                        {action.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm ml-7">{action.description}</p>

                    {/* Professional type hint — placeholder for the directory feature */}
                    {action.professionalType && (
                      <div className="mt-2 ml-7">
                        <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-medium bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          A {action.professionalType.replace(/_/g, ' ')} can help with this
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}