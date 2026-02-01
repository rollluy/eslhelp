'use client';

import { useState, useEffect } from 'react';

interface ActionItem {
  step: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
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

export default function Home() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLanguageSelect = (language: string) => {
    setSelectedLanguage(language);
    setResult(null);
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check if it's a PDF file
      if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
        setError('Please upload a PDF file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (!file || !selectedLanguage) return;

    setLoading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', selectedLanguage);

    try {
      const response = await fetch('/api/translateFile', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        console.error('Received HTML instead of JSON:', htmlText.substring(0, 500));
        throw new Error('Server returned an error page. Check the server console for details.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Processing failed');
      }

      setResult(data);
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'An error occurred while processing your document');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getLanguageFlag = (language: string) => {
    const flags: { [key: string]: string } = {
      spanish: '🇪🇸',
      french: '🇫🇷',
      mandarin: '🇨🇳',
    };
    return flags[language] || '';
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            PDF Translation & Analysis
          </h1>
          <p className="text-gray-600 text-lg">
            Upload a PDF document, get a translated summary and actionable insights
          </p>
        </div>

        {/* Step 1: Language Selection */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">
              1
            </span>
            Select Target Language
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['spanish', 'french', 'mandarin'].map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageSelect(lang)}
                className={`p-6 rounded-lg border-2 transition-all duration-200 ${
                  selectedLanguage === lang
                    ? 'border-indigo-600 bg-indigo-50 shadow-md'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                }`}
              >
                <div className="text-4xl mb-2">{getLanguageFlag(lang)}</div>
                <div className="font-semibold text-gray-800 capitalize">
                  {lang}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: File Upload */}
        {selectedLanguage && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">
                2
              </span>
              Upload Your PDF Document
            </h2>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <svg
                    className="w-12 h-12 text-gray-400 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="text-gray-600 font-medium">
                    {file ? file.name : 'Click to upload PDF'}
                  </span>
                  <span className="text-gray-400 text-sm mt-1">
                    PDF files only
                  </span>
                </label>
              </div>

              {file && (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Process Document'
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && result.success && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">
                  ✓
                </span>
                Translated Summary ({result.targetLanguage})
              </h2>
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {result.translatedSummary}
                </p>
              </div>
              <div className="mt-4 flex gap-4 text-sm text-gray-500">
                <span>Original: {result.originalLength} characters</span>
                <span>•</span>
                <span>Summary: {result.summaryLength} characters</span>
              </div>
            </div>

            {/* Action Plan */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                📋 Recommended Action Plan
              </h2>
              <div className="space-y-4">
                {result.actionPlan.map((action, index) => (
                  <div
                    key={index}
                    className="border-l-4 border-indigo-600 bg-gray-50 rounded-r-lg p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-lg flex items-center">
                        <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center mr-2 text-sm">
                          {index + 1}
                        </span>
                        {action.step}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(
                          action.priority
                        )}`}
                      >
                        {action.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-700 ml-8">{action.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}