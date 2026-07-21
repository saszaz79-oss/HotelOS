import en from './dictionaries/en.json';
import ar from './dictionaries/ar.json';

export { locales, defaultLocale, dirFor, type Locale } from './locales';
import { defaultLocale, type Locale } from './locales';

const dictionaries = { en, ar };

export function getDictionary(locale: Locale) {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}
