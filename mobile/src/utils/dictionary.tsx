import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../config';

export type Lang = "th" | "en" | "cn" | "jp";

type DictNode = { [key: string]: string | DictNode };
type Dictionaries = Record<Lang, DictNode>;

function resolve(obj: DictNode, path: string): string {
  const parts = path.split(".");
  let current: string | DictNode = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return path;
    current = current[part] ?? path;
  }
  return typeof current === "string" ? current : path;
}

function interpolate(str: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    str
  );
}

const DictionaryContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  tp: (key: string, params: Record<string, string | number>) => string;
  ready: boolean;
}>({
  lang: "th",
  setLang: () => {},
  t: (key) => key,
  tp: (key) => key,
  ready: false,
});

export function DictionaryProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");
  const [dicts, setDicts] = useState<Dictionaries | null>(null);

  useEffect(() => {
    // Load saved language
    SecureStore.getItemAsync('lang').then(savedLang => {
      if (savedLang && ['th', 'en', 'cn', 'jp'].includes(savedLang)) {
        setLangState(savedLang as Lang);
      }
    });

    // Fetch dictionary from server
    const fetchDict = () => {
      // ตั้ง Timeout สำหรับการ Fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      fetch(`${CONFIG.API_URL}/api/dictionary`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: Dictionaries) => {
          clearTimeout(timeoutId);
          console.log('[Dictionary] Load success');
          setDicts(data);
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          console.warn('[Dictionary] Fetch failed:', err.message);
          
          // บังคับให้ ready ทันทีหากโหลดไม่สำเร็จ เพื่อไม่ให้แอปค้างหน้า Loading
          console.log('[Dictionary] Bypassing loading state with empty dict');
          setDicts({ th: {}, en: {}, cn: {}, jp: {} } as any);
        });
    };

    fetchDict();
  }, []);

  const setLang = (l: Lang) => {
    SecureStore.setItemAsync("lang", l);
    setLangState(l);
  };

  const t = (key: string): string => {
    if (!dicts) return key;
    return resolve(dicts[lang], key);
  };

  const tp = (key: string, params: Record<string, string | number>): string => {
    return interpolate(t(key), params);
  };

  return (
    <DictionaryContext.Provider value={{ lang, setLang, t, tp, ready: dicts !== null }}>
      {children}
    </DictionaryContext.Provider>
  );
}

export const useDictionary = () => useContext(DictionaryContext);
