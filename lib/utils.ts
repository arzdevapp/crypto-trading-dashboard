import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Decimal from 'decimal.js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = 'USD', decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatCrypto(value: number, decimals = 6): string {
  return new Decimal(value).toFixed(decimals);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function safeMultiply(a: number, b: number): number {
  return new Decimal(a).times(b).toNumber();
}

export function safeDivide(a: number, b: number): number {
  if (b === 0) return 0;
  return new Decimal(a).div(b).toNumber();
}

export function timeframeToMs(timeframe: string): number {
  const map: Record<string, number> = {
    '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000,
    '30m': 1800000, '1h': 3600000, '2h': 7200000, '4h': 14400000,
    '6h': 21600000, '8h': 28800000, '12h': 43200000, '1d': 86400000,
    '3d': 259200000, '1w': 604800000,
  };
  return map[timeframe] ?? 3600000;
}
