// Type declarations for the browser-served currency-format module.

export function amountStep(minorUnits: number): string;

export interface BaseCurrency {
  minorUnits: number;
  symbol: string;
}

export function convertToBaseMinor(
  amountMajor: number,
  rate: number,
  baseMinorUnits: number,
): number | null;

export function formatMoney(minor: number, currency: BaseCurrency): string;

export function ratePlausible(rate: number): boolean;

export function renderRatePreview(
  el: HTMLElement | null,
  options: {
    amountMajor: number;
    rate: number;
    base: BaseCurrency;
    t: (key: string, vars?: Record<string, string | number>) => string;
  },
): void;
