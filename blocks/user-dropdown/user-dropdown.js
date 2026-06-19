// User Dropdown Block - Displays user profile dropdown in header
import { fetchUserProfile } from '../../scripts/api-service.js';
import { addManagedListener, cleanupChildren } from '../../scripts/dom-utils.js';

// Generate user dropdown HTML
function generateUserDropdownHTML(userProfile) {
  const user = userProfile?.attributes;
  const userName = user?.name || 'User';
  const userAvatar = user?.avatarUrl || '';

  return `
    <div class="user-dropdown-container">
      <button class="user-profile-btn" aria-expanded="false" aria-haspopup="true">
        <div class="user-avatar">
          ${userAvatar ? 
            `<img src="${userAvatar}" alt="${userName}" class="avatar-image">` : 
            `<div class="avatar-placeholder">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="16" fill="#e0e0e0"/>
                <circle cx="16" cy="12" r="5" fill="#999"/>
                <path d="M8 26c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#999"/>
              </svg>
            </div>`
          }
        </div>
        <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="user-dropdown-menu" role="menu">
        <a href="/profile.html" class="dropdown-item" role="menuitem">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Your Profile
        </a>
      </div>
    </div>
  `;
}

// Setup dropdown event listeners with proper cleanup
function setupDropdownEventListeners(block) {
  const dropdownBtn = block.querySelector('.user-profile-btn');
  const dropdownMenu = block.querySelector('.user-dropdown-menu');

  if (!dropdownBtn || !dropdownMenu) return;

  // Add click handler for dropdown toggle
  addManagedListener(dropdownBtn, 'click', (e) => {
    e.stopPropagation();
    const isExpanded = dropdownBtn.getAttribute('aria-expanded') === 'true';
    dropdownBtn.setAttribute('aria-expanded', !isExpanded);
    dropdownMenu.classList.toggle('show', !isExpanded);
  });

  // Close dropdown when clicking outside
  const closeDropdown = (e) => {
    if (!block.contains(e.target)) {
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

  // Add event listeners with cleanup
  addManagedListener(document, 'click', closeDropdown);
  addManagedListener(document, 'keydown', handleKeydown);
}

// Main decorate function
export default async function decorate(block) {
  try {
    // Show loading state
    block.innerHTML = '<div class="user-dropdown-loading">Loading...</div>';

    // Fetch user profile using centralized API service
    const userProfile = await fetchUserProfile();
    
    if (!userProfile) {
      // Hide the block if no user profile is available
      block.style.display = 'none';
      return;
    }

    // Generate and display HTML
    const dropdownHTML = generateUserDropdownHTML(userProfile);
    block.innerHTML = dropdownHTML;

    // Setup event listeners
    setupDropdownEventListeners(block);

  } catch (error) {
    console.error('Error initializing user dropdown block:', error);
    // Hide the block on error
    block.style.display = 'none';
  }
  
  // Return cleanup function
  return () => cleanupChildren(block);
}
