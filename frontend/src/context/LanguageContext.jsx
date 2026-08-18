'use client';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { t as translate, LOCALES } from '@/lib/i18n';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'govinsight-locale';
const GEMINI_TRANSLATION_CACHE = 'civicdrishti-ne-ui-cache-v1';


function isTranslatableText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 3 || clean.length > 120) return false;
  if (!/[A-Za-z]/.test(clean) || /[\u0900-\u097F]/.test(clean)) return false;
  if (/^(Rs|NPR|[0-9.,%+\-:]+)$/.test(clean)) return false;
  return true;
}

function readTranslationCache() {
  try { return JSON.parse(localStorage.getItem(GEMINI_TRANSLATION_CACHE) || '{}'); } catch { return {}; }
}

function writeTranslationCache(cache) {
  try { localStorage.setItem(GEMINI_TRANSLATION_CACHE, JSON.stringify(cache)); } catch { }
}

function useGeminiUiTranslation(locale) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (locale !== 'ne') return;

    let cancelled = false;
    let timer = null;
    const original = new Map();

    const collect = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest('script,style,textarea,input,select,[data-no-auto-translate],.maplibregl-map')) return NodeFilter.FILTER_REJECT;
          return isTranslatableText(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      return nodes;
    };

    const run = async () => {
      const nodes = collect();
      if (!nodes.length) return;
      const cache = readTranslationCache();
      const missing = [];

      nodes.forEach(node => {
        const text = String(original.get(node) || node.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!original.has(node)) original.set(node, text);
        if (cache[text]) node.nodeValue = node.nodeValue.replace(text, cache[text]);
        else if (!missing.includes(text)) missing.push(text);
      });

      if (!missing.length) return;
      try {
        const token = localStorage.getItem('gi_token');
        const res = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify({ target: 'ne', texts: missing.slice(0, 60) }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        (data.translations || []).forEach((translated, index) => { if (translated) cache[missing[index]] = translated; });
        writeTranslationCache(cache);
        collect().forEach(node => {
          const text = String(original.get(node) || node.nodeValue || '').replace(/\s+/g, ' ').trim();
          if (cache[text]) node.nodeValue = node.nodeValue.replace(text, cache[text]);
        });
      } catch { }
    };

    const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 300); };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
      original.forEach((text, node) => { if (node?.nodeValue) node.nodeValue = text; });
    };
  }, [locale]);
}

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState('en');

  // Restore saved preference on mount (client-only; avoids SSR/client mismatch)
  useEffect(() => {
    try {
      const saved = document.cookie.split('; ').find(row => row.startsWith(`${STORAGE_KEY}=`));
      const value = saved ? saved.split('=')[1] : null;
      if (value && LOCALES[value]) setLocaleState(value);
    } catch { /* noop */ }
  }, []);

  const setLocale = useCallback((next) => {
    if (!LOCALES[next]) return;
    setLocaleState(next);
    try {
      document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=31536000`;
      document.documentElement.lang = next;
    } catch { /* noop */ }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'ne' : 'en');
  }, [locale, setLocale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    toggleLocale,
    t: (key) => translate(locale, key),
  }), [locale, setLocale, toggleLocale]);

  useGeminiUiTranslation(locale);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

// Convenience hook mirroring the shape used by next-i18next, so components
// read naturally: const { t } = useTranslation();
export function useTranslation() {
  const { t } = useLanguage();
  return { t };
}
