import { LocaleCatalog, LocaleCode } from './types';
import { en } from './en';
import { zhTw } from './zh-tw';
import { zhCn } from './zh-cn';

const CATALOGS: Record<LocaleCode, LocaleCatalog> = {
  en,
  'zh-tw': zhTw,
  'zh-cn': zhCn,
};

export function getCatalog(code: LocaleCode): LocaleCatalog {
  return CATALOGS[code];
}

/** Maps a VS Code display-language tag (vscode.env.language, e.g. "zh-cn", "zh-hant", "en-us") to one of our catalogs. Anything not recognizably Chinese falls back to English. */
export function resolveLocale(vscodeLanguage: string): LocaleCode {
  const lang = vscodeLanguage.toLowerCase();
  if (
    lang.startsWith('zh-tw') ||
    lang.startsWith('zh-hant') ||
    lang === 'zh-hk'
  ) {
    return 'zh-tw';
  }

  if (lang.startsWith('zh')) {
    return 'zh-cn';
  }

  return 'en';
}

export type {
  LocaleCatalog,
  LocaleCode,
  MnemonicProse,
  LocaleUi,
} from './types';
