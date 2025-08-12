(function(){
  const DEFAULT_LANG = 'de';
  const SUPPORTED = ['de', 'en'];

  function getInitialLang() {
    const saved = localStorage.getItem('lang');
    if (saved && SUPPORTED.includes(saved)) return saved;
    const htmlLang = document.documentElement.getAttribute('lang');
    if (htmlLang && SUPPORTED.includes(htmlLang)) return htmlLang;
    const browser = (navigator.language || navigator.userLanguage || '').slice(0,2);
    if (SUPPORTED.includes(browser)) return browser;
    return DEFAULT_LANG;
  }

  async function loadTranslations(lang) {
    const res = await fetch(`/locales/${lang}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load locales/${lang}.json`);
    return res.json();
  }

  function applyTranslations(dict) {
    // Helper to resolve dotted key from object
    const resolve = (obj, path) => path
      .split('.')
      .reduce((acc, k) => (acc && acc[k] != null) ? acc[k] : undefined, obj);

    // Page-specific meta keys (optional)
    const body = document.body;
    const metaTitleKey = body.getAttribute('data-i18n-meta-title-key');
    const metaDescKey = body.getAttribute('data-i18n-meta-description-key');

    const pageTitle = metaTitleKey ? resolve(dict, metaTitleKey) : undefined;
    const pageDesc = metaDescKey ? resolve(dict, metaDescKey) : undefined;

    // Update <title>
    if (pageTitle != null) {
      document.title = pageTitle;
    } else if (dict.meta && dict.meta.title) {
      document.title = dict.meta.title;
    }
    // Update <meta name="description">
    const metaDescEl = document.querySelector('meta[name="description"]');
    if (metaDescEl) {
      if (pageDesc != null) {
        metaDescEl.setAttribute('content', pageDesc);
      } else if (dict.meta && dict.meta.description) {
        metaDescEl.setAttribute('content', dict.meta.description);
      }
    }

    // data-i18n handling
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const attr = el.getAttribute('data-i18n-attr'); // e.g. 'placeholder', 'alt', 'title'
      const value = resolve(dict, key);
      if (value == null) return;
      if (attr) {
        el.setAttribute(attr, value);
      } else {
        // If element has child elements, prefer textContent on the element only if it's simple.
        // We keep it simple: replace textContent.
        el.textContent = value;
      }
    });
  }

  async function setLang(lang) {
    try {
      document.documentElement.setAttribute('lang', lang);
      const dict = await loadTranslations(lang);
      applyTranslations(dict);
      localStorage.setItem('lang', lang);
      const selector = document.getElementById('lang-select');
      if (selector) selector.value = lang;
    } catch (e) {
      console.error('i18n error:', e);
    }
  }

  function installSelector() {
    const selector = document.getElementById('lang-select');
    if (!selector) return;
    selector.addEventListener('change', (e) => setLang(e.target.value));
  }

  document.addEventListener('DOMContentLoaded', () => {
    installSelector();
    setLang(getInitialLang());
  });

  // Expose for manual switching if needed
  window.i18nSetLang = setLang;
})();
