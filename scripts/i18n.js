async function fetchLocales() {
  const response = await fetch('/i18n/locales.json');
  if (!response.ok) {
    throw new Error(`Failed to fetch locales: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  const locales = (json.data || []).map((locale) => locale.code);

  window.alm = window.alm || {};
  window.alm.i18n = window.alm.i18n || {};
  window.alm.i18n.locales = locales;
}

function detectCurrentLocale() {
  const locales = window.alm?.i18n?.locales || [];
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('language');
  const currentLocale = locales.find((locale) => locale === langParam) || 'en-US';
  window.alm.i18n.currentLocale = currentLocale;
}

async function fetchTranslations(locale) {
  const response = await fetch(`/i18n/translations/${locale.toLowerCase()}.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch translations for ${locale}: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  const sheetNames = json[':names'];
  const translations = sheetNames
    ? sheetNames.reduce((acc, sheetName) => {
        (json[sheetName]?.data || []).forEach((entry) => {
          acc[entry.key] = entry.value;
        });
        return acc;
      }, {})
    : (json.data || []).reduce((acc, entry) => {
        acc[entry.key] = entry.value;
        return acc;
      }, {});

  window.alm.i18n.translations = translations;
}

window.alm = window.alm || {};
window.alm.i18n = window.alm.i18n || {};

window.alm.i18n.ready = (async () => {
  try {
    await fetchLocales();
    detectCurrentLocale();
    await fetchTranslations(window.alm.i18n.currentLocale);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error initializing i18n:', error);
    window.alm.i18n.currentLocale = window.alm.i18n.currentLocale || 'en-US';
  }
})();
