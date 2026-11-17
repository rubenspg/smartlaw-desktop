import { createContext, useContext, ReactNode } from "react";
import { strings, type TranslationKey } from "../lib/translations";
import { formatarData } from '@/lib/datas';

// Fixed to pt-BR / BRL. The language/currency switching UI was removed (#29)
// because it was never actually wired up. Formatting still goes through this
// provider so a future localization effort has one place to change.
const LOCALE = "pt-BR";
const CURRENCY = "BRL";

type RegionalProviderState = {
  formatCurrency: (value: number | string) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  t: (key: TranslationKey) => string;
};

function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "";
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(num);
}

function formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  return formatarData(date, options, '');
}

function t(key: TranslationKey): string {
  return strings[key] || key;
}

const value: RegionalProviderState = { formatCurrency, formatDate, t };

const RegionalProviderContext = createContext<RegionalProviderState>(value);

export function RegionalProvider({ children }: { children: ReactNode }) {
  return (
    <RegionalProviderContext.Provider value={value}>
      {children}
    </RegionalProviderContext.Provider>
  );
}

export const useRegional = () => useContext(RegionalProviderContext);
