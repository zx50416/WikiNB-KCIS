import zhTW from '../locales/zh-TW.json';
import en from '../locales/en.json';

const STORAGE_KEY = 'wikinb-kcis-locale';
const dictionaries = {
  'zh-TW': zhTW,
  en,
};

export function getLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh-TW') return saved;
  } catch {
    /* ignore */
  }
  return 'zh-TW';
}

export function t(key, vars = {}, locale = getLocale()) {
  const dict = dictionaries[locale] || dictionaries['zh-TW'];
  let text = dict[key] ?? dictionaries['zh-TW'][key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

function applyAttr(el, attr, value) {
  if (attr === 'text') {
    el.textContent = value;
  } else if (attr === 'html') {
    el.innerHTML = value;
  } else if (attr === 'placeholder') {
    el.setAttribute('placeholder', value);
  } else if (attr === 'title') {
    el.setAttribute('title', value);
  } else if (attr === 'aria-label') {
    el.setAttribute('aria-label', value);
  }
}

export function applyI18n(root = document) {
  const locale = getLocale();
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-Hant';
  document.documentElement.dataset.locale = locale;

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    // 帶變數的文案由各頁自行 patch（如 teachers.notes、wiki.updated）
    if (el.hasAttribute('data-i18n-n') || el.hasAttribute('data-i18n-date')) return;
    applyAttr(el, 'text', t(key, {}, locale));
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!key) return;
    applyAttr(el, 'placeholder', t(key, {}, locale));
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    applyAttr(el, 'title', t(key, {}, locale));
  });

  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (!key) return;
    applyAttr(el, 'aria-label', t(key, {}, locale));
  });

  // 科目等雙語標籤（MD 原文不變，僅介面顯示）
  root.querySelectorAll('[data-locale-text]').forEach((el) => {
    const zh = el.getAttribute('data-zh') || el.textContent || '';
    const en = el.getAttribute('data-en') || zh;
    el.textContent = locale === 'en' ? en : zh;
  });

  const langBtn = document.getElementById('btn-lang');
  if (langBtn) {
    langBtn.textContent = t('nav.lang', {}, locale);
    langBtn.setAttribute('title', t('nav.langTitle', {}, locale));
  }
}

export function setLocale(locale) {
  const next = locale === 'en' ? 'en' : 'zh-TW';
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  applyI18n();
  document.dispatchEvent(new CustomEvent('wikinb:locale-change', { detail: { locale: next } }));
}

export function toggleLocale() {
  setLocale(getLocale() === 'en' ? 'zh-TW' : 'en');
}

export function mountI18n() {
  applyI18n();
  document.getElementById('btn-lang')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleLocale();
  });
}
