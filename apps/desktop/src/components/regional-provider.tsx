import { createContext, useContext, useState, ReactNode } from "react";
import { translations, type TranslationKey } from "../lib/translations";

export type Language = "pt-BR" | "en-US" | "es-ES";
export type Currency = "BRL" | "USD" | "EUR";

type RegionalProviderProps = {
  children: ReactNode;
  defaultLanguage?: Language;
  defaultCurrency?: Currency;
  storageKeyPrefix?: string;
};

type RegionalProviderState = {
  language: Language;
  currency: Currency;
  setLanguage: (language: Language) => void;
  setCurrency: (currency: Currency) => void;
  formatCurrency: (value: number | string) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  t: (key: TranslationKey) => string;
};

const initialState: RegionalProviderState = {
  language: "pt-BR",
  currency: "BRL",
  setLanguage: () => null,
  setCurrency: () => null,
  formatCurrency: () => "",
  formatDate: () => "",
  t: (key: TranslationKey) => key,
};

const RegionalProviderContext = createContext<RegionalProviderState>(initialState);

export function RegionalProvider({
  children,
  defaultLanguage = "pt-BR",
  defaultCurrency = "BRL",
  storageKeyPrefix = "smartlaw_",
  ...props
}: RegionalProviderProps) {
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem(`${storageKeyPrefix}language`) as Language) || defaultLanguage
  );
  const [currency, setCurrencyState] = useState<Currency>(
    () => (localStorage.getItem(`${storageKeyPrefix}currency`) as Currency) || defaultCurrency
  );

  const setLanguage = (lang: Language) => {
    localStorage.setItem(`${storageKeyPrefix}language`, lang);
    setLanguageState(lang);
  };

  const setCurrency = (curr: Currency) => {
    localStorage.setItem(`${storageKeyPrefix}currency`, curr);
    setCurrencyState(curr);
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "";
    
    return new Intl.NumberFormat(language, {
      style: "currency",
      currency: currency,
    }).format(num);
  };

  const formatDate = (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return String(date);
      return new Intl.DateTimeFormat(language, options).format(d);
    } catch {
      return String(date);
    }
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  const value = {
    language,
    currency,
    setLanguage,
    setCurrency,
    formatCurrency,
    formatDate,
    t,
  };

  return (
    <RegionalProviderContext.Provider {...props} value={value}>
      {children}
    </RegionalProviderContext.Provider>
  );
}

export const useRegional = () => {
  const context = useContext(RegionalProviderContext);

  if (context === undefined)
    throw new Error("useRegional must be used within a RegionalProvider");

  return context;
};
