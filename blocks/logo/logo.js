/**
 * Logo block
 * Displays a logo image with optional link, switching with the header theme.
 *
 * Resolution order, per theme:
 *   1. A theme-specific logo committed to the code repo: /icons/logo-<theme>.svg
 *   2. The image authored in the block (e.g. uploaded to DA) as a fallback
 *   3. Plain text (only if no image is available at all)
 *
 * So the DA-authored image is used only when the theme logo does not exist in git.
 */

const THEMES = ['light', 'dark', 'green', 'linkedin'];

// Image formats to look for in git, in priority order (svg preferred, then png).
const GIT_LOGO_EXTENSIONS = ['svg', 'png'];

// Remembers which git logo paths 404'd so we don't re-request them on every theme switch.
const gitLogoMissing = new Set();

/**
 * Current theme from the document root.
 * The header theme switcher sets data-theme on <html> (and removes it for light).
 */
function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * Convention paths for a theme-specific logo committed to the repo's /icons/ folder,
 * one per supported image format (svg, png, jpg, ...).
 */
function gitLogoPaths(theme) {
  const base = (window.hlx && window.hlx.codeBasePath) || '';
  return GIT_LOGO_EXTENSIONS.map((ext) => `${base}/icons/logo-${theme}.${ext}`);
}

/**
 * Work out which theme an authored image belongs to from its icon name / filename.
 * Returns null when no theme keyword is present (used as the generic fallback).
 */
function themeFromName(name) {
  const lower = (name || '').toLowerCase();
  return THEMES.find((theme) => lower.includes(theme)) || null;
}

/**
 * Parse the authored block content: destination link, accessible text,
 * any theme-named images, and a generic fallback image (e.g. from DA).
 */
function parseLogoData(block) {
  const data = {
    href: '/',
    text: 'Logo',
    variants: {},
    fallback: null,
  };

  const link = block.querySelector('a');
  if (link) {
    data.href = link.getAttribute('href') || link.href || '/';
    const text = link.textContent.trim();
    if (text) data.text = text;
  }

  block.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || img.src;
    if (!src) return;

    const fileName = src.split('/').pop().split('?')[0].replace(/\.[a-z0-9]+$/i, '');
    const name = img.dataset.iconName || fileName;
    const theme = themeFromName(name);

    if (theme) {
      data.variants[theme] = src;
    } else if (!data.fallback) {
      data.fallback = src;
    }
  });

  // If only theme-named images were authored, use the first as the generic fallback too.
  if (!data.fallback) {
    [data.fallback] = Object.values(data.variants);
  }

  return data;
}

/**
 * Set img.src to the first candidate that loads, walking the list on error.
 * Git logo paths that 404 are cached so later theme switches skip them.
 */
function setLogoSource(img, candidates) {
  const list = candidates.filter(Boolean);
  let index = 0;

  const apply = () => {
    if (index >= list.length) {
      img.onerror = null;
      return;
    }
    img.onerror = () => {
      const failed = list[index];
      if (failed.includes('/icons/logo-')) gitLogoMissing.add(failed);
      index += 1;
      apply();
    };
    img.src = list[index];
  };

  apply();
}

/**
 * Render / update the logo for the current theme.
 */
function updateLogo(container, data) {
  const theme = getCurrentTheme();
  const gitPaths = gitLogoPaths(theme).filter((path) => !gitLogoMissing.has(path));

  const candidates = [
    data.variants[theme], // theme-specific image authored in the block
    ...gitPaths, // theme logo committed in git (svg/png/jpg/...)
    data.fallback, // DA-authored (or generic) fallback image
  ];

  if (!candidates.some(Boolean)) {
    // No image anywhere: fall back to text.
    if (!container.querySelector('.logo-text')) {
      container.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'logo-text';
      span.textContent = data.text;
      container.appendChild(span);
    }
    return;
  }

  let img = container.querySelector('.logo-image');
  if (!img) {
    container.innerHTML = '';
    img = document.createElement('img');
    img.className = 'logo-image';
    container.appendChild(img);
  }
  img.alt = data.text || 'Logo';
  setLogoSource(img, candidates);
}

export default function decorate(block) {
  const data = parseLogoData(block);

  block.innerHTML = '';

  const logoLink = document.createElement('a');
  logoLink.href = data.href;
  logoLink.className = 'logo-link';
  logoLink.setAttribute('aria-label', data.text || 'Home');

  const logoContent = document.createElement('div');
  logoContent.className = 'logo-content';

  logoLink.appendChild(logoContent);
  block.appendChild(logoLink);

  updateLogo(logoContent, data);

  // Re-resolve the logo whenever the header theme switcher fires.
  window.addEventListener('themechange', () => updateLogo(logoContent, data));
}
