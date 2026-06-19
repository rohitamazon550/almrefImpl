import { fetchPlaceholders, getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { fetchUserProfile } from '../../scripts/api-service.js';

// Theme Switcher Constants
const THEME_KEY = 'site-theme';
const THEMES = ['light', 'dark', 'green', 'linkedin'];

// Theme Switcher Functions
function getCurrentTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function setTheme(theme) {
  if (!THEMES.includes(theme)) {
    console.warn(`Invalid theme: ${theme}. Defaulting to light.`);
    theme = 'light';
  }

  const root = document.documentElement;
  root.removeAttribute('data-theme');
  
  if (theme !== 'light') {
    root.setAttribute('data-theme', theme);
  }
  
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

function addThemeSwitcher(navTools) {
  const themeSwitcher = document.createElement('div');
  themeSwitcher.className = 'theme-switcher';
  
  const button = document.createElement('button');
  button.className = 'theme-switcher-btn';
  button.setAttribute('aria-label', 'Switch theme');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('type', 'button');
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  `;
  
  const menu = document.createElement('div');
  menu.className = 'theme-switcher-menu';
  
  const currentTheme = getCurrentTheme();
  
  const themeNames = {
    light: 'Light Theme',
    dark: 'Dark Theme',
    green: 'Green Theme',
    linkedin: 'LinkedIn Theme'
  };
  
  THEMES.forEach(theme => {
    const item = document.createElement('button');
    item.className = 'theme-option';
    item.setAttribute('data-theme', theme);
    item.setAttribute('type', 'button');
    if (theme === currentTheme) {
      item.classList.add('active');
    }
    
    item.textContent = themeNames[theme] || theme;
    item.addEventListener('click', () => {
      setTheme(theme);
      
      menu.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.remove('active');
      });
      item.classList.add('active');
      
      button.setAttribute('aria-expanded', 'false');
      menu.classList.remove('show');
    });
    
    menu.appendChild(item);
  });
  
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', !isExpanded);
    menu.classList.toggle('show');
  });
  
  document.addEventListener('click', (e) => {
    if (!themeSwitcher.contains(e.target)) {
      button.setAttribute('aria-expanded', 'false');
      menu.classList.remove('show');
    }
  });
  
  themeSwitcher.appendChild(button);
  themeSwitcher.appendChild(menu);
  
  // Insert before the first child of navTools to ensure it appears
  if (navTools.firstChild) {
    navTools.insertBefore(themeSwitcher, navTools.firstChild);
  } else {
    navTools.appendChild(themeSwitcher);
  }
}

// Initialize theme on page load
function initTheme() {
  const currentTheme = getCurrentTheme();
  setTheme(currentTheme);
}

// Initialize theme immediately
initTheme();

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  const navDrops = navSections.querySelectorAll('.nav-drop');
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

function getDirectTextContent(menuItem) {
  const menuLink = menuItem.querySelector(':scope > a');
  if (menuLink) {
    return menuLink.textContent.trim();
  }
  return Array.from(menuItem.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent)
    .join(' ');
}

async function buildBreadcrumbsFromNavTree(nav, currentUrl) {
  const crumbs = [];

  const homeUrl = document.querySelector('.nav-brand a[href]').href;

  let menuItem = Array.from(nav.querySelectorAll('a')).find((a) => a.href === currentUrl);
  if (menuItem) {
    do {
      const link = menuItem.querySelector(':scope > a');
      crumbs.unshift({ title: getDirectTextContent(menuItem), url: link ? link.href : null });
      menuItem = menuItem.closest('ul')?.closest('li');
    } while (menuItem);
  } else if (currentUrl !== homeUrl) {
    crumbs.unshift({ title: getMetadata('og:title'), url: currentUrl });
  }

  const placeholders = await fetchPlaceholders();
  const homePlaceholder = placeholders.breadcrumbsHomeLabel || 'Home';

  crumbs.unshift({ title: homePlaceholder, url: homeUrl });

  // last link is current page and should not be linked
  if (crumbs.length > 1) {
    crumbs[crumbs.length - 1].url = null;
  }
  crumbs[crumbs.length - 1]['aria-current'] = 'page';
  return crumbs;
}


// Add user dropdown to nav tools
async function addUserDropdown(navTools) {
  try {
    // Fetch user profile using centralized API service
    const user = await fetchUserProfile();
    if (!user) {
      return; // Don't show dropdown if no user profile
    }

    const userName = user?.attributes?.name || 'User';
    const userAvatar = user?.attributes?.avatarUrl || '';

    // Create user dropdown element using createElement
    const userDropdownDiv = document.createElement('div');
    userDropdownDiv.className = 'user-dropdown';

    const container = document.createElement('div');
    container.className = 'user-dropdown-container';

    const profileBtn = document.createElement('button');
    profileBtn.className = 'user-profile-btn';
    profileBtn.setAttribute('aria-expanded', 'false');
    profileBtn.setAttribute('aria-haspopup', 'true');

    const userAvatarDiv = document.createElement('div');
    userAvatarDiv.className = 'user-avatar';

    if (userAvatar) {
      const avatarImg = document.createElement('img');
      avatarImg.src = userAvatar;
      avatarImg.alt = userName;
      avatarImg.className = 'avatar-image';
      userAvatarDiv.appendChild(avatarImg);
    } else {
      const avatarPlaceholder = document.createElement('div');
      avatarPlaceholder.className = 'avatar-placeholder';
      avatarPlaceholder.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#e0e0e0"/>
          <circle cx="16" cy="12" r="5" fill="#999"/>
          <path d="M8 26c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#999"/>
        </svg>
      `;
      userAvatarDiv.appendChild(avatarPlaceholder);
    }

    const dropdownArrow = document.createElement('svg');
    dropdownArrow.className = 'dropdown-arrow';
    dropdownArrow.setAttribute('width', '12');
    dropdownArrow.setAttribute('height', '12');
    dropdownArrow.setAttribute('viewBox', '0 0 12 12');
    dropdownArrow.setAttribute('fill', 'none');
    dropdownArrow.innerHTML = '<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';

    profileBtn.appendChild(userAvatarDiv);
    profileBtn.appendChild(dropdownArrow);

    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'user-dropdown-menu';
    dropdownMenu.setAttribute('role', 'menu');

    const profileLink = document.createElement('a');
    profileLink.href = '/profile';
    profileLink.className = 'dropdown-item';
    profileLink.setAttribute('role', 'menuitem');
    
    const profileIcon = document.createElement('svg');
    profileIcon.setAttribute('width', '16');
    profileIcon.setAttribute('height', '16');
    profileIcon.setAttribute('viewBox', '0 0 16 16');
    profileIcon.setAttribute('fill', 'none');
    profileIcon.innerHTML = `
      <circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/>
      <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.5"/>
    `;
    
    profileLink.appendChild(profileIcon);
    profileLink.appendChild(document.createTextNode('Your Profile'));

    dropdownMenu.appendChild(profileLink);

    container.appendChild(profileBtn);
    container.appendChild(dropdownMenu);
    userDropdownDiv.appendChild(container);

    // Add to nav tools
    navTools.appendChild(userDropdownDiv);

    // Setup event listeners
    setupUserDropdownEventListeners(userDropdownDiv);

  } catch (error) {
    console.error('Error adding user dropdown:', error);
  }
}

// Setup dropdown event listeners
function setupUserDropdownEventListeners(userDropdownDiv) {
  const dropdownBtn = userDropdownDiv.querySelector('.user-profile-btn');
  const dropdownMenu = userDropdownDiv.querySelector('.user-dropdown-menu');

  if (!dropdownBtn || !dropdownMenu) return;

  // Add click handler for dropdown toggle
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = dropdownBtn.getAttribute('aria-expanded') === 'true';
    dropdownBtn.setAttribute('aria-expanded', !isExpanded);
    dropdownMenu.classList.toggle('show', !isExpanded);
  });

  // Close dropdown when clicking outside
  const closeDropdown = (e) => {
    if (!userDropdownDiv.contains(e.target)) {
      dropdownBtn.setAttribute('aria-expanded', 'false');
      dropdownMenu.classList.remove('show');
    }
  };

  // Close dropdown on escape key
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      dropdownBtn.setAttribute('aria-expanded', 'false');
      dropdownMenu.classList.remove('show');
    }
  };

  // Add event listeners
  document.addEventListener('click', closeDropdown);
  document.addEventListener('keydown', handleKeydown);
}

async function buildBreadcrumbs() {
  const breadcrumbs = document.createElement('nav');
  breadcrumbs.className = 'breadcrumbs';

  const crumbs = await buildBreadcrumbsFromNavTree(document.querySelector('.nav-sections'), document.location.href);

  const ol = document.createElement('ol');
  ol.append(...crumbs.map((item) => {
    const li = document.createElement('li');
    if (item['aria-current']) li.setAttribute('aria-current', item['aria-current']);
    if (item.url) {
      const a = document.createElement('a');
      a.href = item.url;
      a.textContent = item.title;
      li.append(a);
    } else {
      li.textContent = item.title;
    }
    return li;
  }));

  breadcrumbs.append(ol);
  return breadcrumbs;
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });
    });
  }

  const navTools = nav.querySelector('.nav-tools');
  if (navTools) {
    const search = navTools.querySelector('a[href*="search"]');
    if (search && search.textContent === '') {
      search.setAttribute('aria-label', 'Search');
    }

    // Add theme switcher
    addThemeSwitcher(navTools);

    // Add user dropdown directly
    await addUserDropdown(navTools);
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);

  if (getMetadata('breadcrumbs').toLowerCase() === 'true') {
    navWrapper.append(await buildBreadcrumbs());
  }
}
