import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { languages, type Language, type TranslationKeys } from '@/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const LANGUAGE_KEY = 'app_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    SecureStore.getItemAsync(LANGUAGE_KEY)
      .then(v => {
        if (v === 'en' || v === 'tr') setLanguageState(v);
      })
      .catch(() => {});
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    SecureStore.setItemAsync(LANGUAGE_KEY, lang).catch(() => {});
  };

  const t = languages[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
