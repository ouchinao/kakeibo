// Type declarations for the browser-served i18n module (i18n.js).
// The implementation ships as plain .js so the browser can load it without a
// build step; these declarations give the test suite and tsc full typing.

export const SUPPORTED_LANGUAGES: readonly string[];
export const DEFAULT_LANGUAGE: string;
export const translations: Record<string, Record<string, string>>;

export function translate(
  lang: string,
  key: string,
  vars?: Record<string, string | number>,
): string;

export function errorMessage(
  lang: string,
  code: string | null | undefined,
  fallback: string | null | undefined,
): string;

export function resolveLanguage(input: string): string;
