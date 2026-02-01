
/**
 * Single source of truth for supported languages.
 * Import this everywhere instead of hardcoding language lists.
 */

export interface LanguageConfig {
  key: string;         // internal identifier, e.g. "spanish"
  label: string;       // display name
  code: string;        // BCP-47 / Google Translate code
  flag: string;        // emoji flag
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { key: 'spanish',  label: 'Spanish',  code: 'es',    flag: '🇪🇸' },
  { key: 'french',   label: 'French',   code: 'fr',    flag: '🇫🇷' },
  { key: 'mandarin', label: 'Mandarin', code: 'zh-CN', flag: '🇨🇳' },
];

/** Quick lookup: "spanish" → "es" */
export function getLanguageCode(key: string): string | undefined {
  return SUPPORTED_LANGUAGES.find(l => l.key === key.toLowerCase())?.code;
}

/** All valid language keys as a set for fast validation */
export const VALID_LANGUAGE_KEYS = new Set(SUPPORTED_LANGUAGES.map(l => l.key));

/** Max upload size in bytes (10 MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '10 MB';