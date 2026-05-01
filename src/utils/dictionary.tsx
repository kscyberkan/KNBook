// ============================================================
//  Dictionary — i18n utility
//  Translations are loaded from /api/dictionary (parsed from
//  public/Dictionary.csv on the server).
//
//  Usage: const { t, lang, setLang } = useDictionary()
//         t("nav.home")  →  "หน้าแรก" | "Home" | "首页" | "ホーム"
// ============================================================

import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "th" | "en" | "cn" | "jp";

type DictNode = { [key: string]: string | DictNode };
type Dictionaries = Record<Lang, DictNode>;

// ── Nested key resolver: t("nav.home") ───────────────────────
function resolve(obj: DictNode, path: string): string {
  const parts = path.split(".");
  let current: string | DictNode = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return path;
    current = current[part] ?? path;
  }
  return typeof current === "string" ? current : path;
}

// ── Interpolate params: tp("common.page", { n: 1, total: 5 }) ─
//    replaces {n} {total} etc. in the translated string
function interpolate(str: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    str
  );
}

// ── Context ──────────────────────────────────────────────────
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

// ── Provider ─────────────────────────────────────────────────
export function DictionaryProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    // priority: loginData.lang → localStorage → 'th'
    try {
      const stored = localStorage.getItem('loginData');
      if (stored) {
        const data = JSON.parse(stored);
        if (data?.lang && ['th', 'en', 'cn', 'jp'].includes(data.lang)) {
          return data.lang as Lang;
        }
      }
    } catch { /* ignore */ }
    return (localStorage.getItem("lang") as Lang) || "th";
  });
  const [dicts, setDicts] = useState<Dictionaries | null>(null);

  // Fetch CSV-derived dictionary from server once
  useEffect(() => {
    fetch("/api/dictionary")
      .then((r) => r.json())
      .then((data: Dictionaries) => setDicts(data))
      .catch(() => {
        // fallback: empty dict — t() will return the key itself
        setDicts({ th: {}, en: {}, cn: {}, jp: {} });
      });
  }, []);

  const setLang = (l: Lang) => {
    localStorage.setItem("lang", l);
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

// ── Hook ─────────────────────────────────────────────────────
export const useDictionary = () => useContext(DictionaryContext);

// ── Language Selector component ───────────────────────────────
export function LangSelector() {
  const { lang, setLang } = useDictionary();

  const langs: { value: Lang; label: string }[] = [
    { value: "th", label: "🇹🇭 ไทย" },
    { value: "en", label: "🇺🇸 EN" },
    { value: "cn", label: "🇨🇳 中文" },
    { value: "jp", label: "🇯🇵 日本語" },
  ];

  return (
    <div className="flex gap-1">
      {langs.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setLang(value)}
          className={`px-2 py-1 rounded text-sm border transition-colors ${
            lang === value
              ? "bg-primary text-white border-primary"
              : "bg-white text-gray-600 border-gray-300 hover:border-primary"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
