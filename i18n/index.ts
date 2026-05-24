import en, { type TranslationKeys } from './en';
import tr from './tr';

export type Language = 'en' | 'tr';

export const languages: Record<Language, TranslationKeys> = { en, tr };

export const languageMeta: Record<Language, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇬🇧' },
  tr: { name: 'Türkçe', flag: '🇹🇷' },
};

export type { TranslationKeys };
export { en, tr };
