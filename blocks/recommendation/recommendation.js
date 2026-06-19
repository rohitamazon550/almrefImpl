import { createOptimizedPicture } from '../../scripts/aem.js';
import { createFluidicPlayerModal } from '../course-overview/ui-components.js';
import { getAlmAccessToken } from '../../scripts/alm-token.js';
import {
  enrollUser as apiEnrollUser,
  fetchEnrollmentState,
  bookmarkLearningObject,
  fetchLearningObject,
  fetchRecommendations
} from '../../scripts/api-service.js';
import { addManagedListener, cleanupChildren } from '../../scripts/dom-utils.js';

const i18n = window.alm.i18n;

/**
 * Determine button text based on enrollment state
 * @param {Object} enrollmentState - Enrollment state data
 * @returns {string} - Button text (START, CONTINUE, or REVISIT)
 */
function getButtonText(enrollmentState) {
  if (!enrollmentState || enrollmentState.state === 'NOT_ENROLLED') {
    return i18n.translations['alm.button.start'];
  }

  if (enrollmentState.state === 'COMPLETED') {
    return 'REVISIT';
  }

  if (enrollmentState.state === 'STARTED' || enrollmentState.progressPercent > 0) {
    return 'CONTINUE';
  }

  return i18n.translations['alm.button.start'];
}

/**
 * Format duration from seconds to readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration (e.g., "10m", "1h 30m")
 */
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '';
}

/**
 * Format date to readable format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date (e.g., "10 Jun")
 */
function formatDate(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Parse API response and extract recommendation data
 * @param {Object} apiResponse - API response from recommendations endpoint
 * @returns {Object} - Object containing recommendations array and skill name
 */
function parseApiResponse(apiResponse) {
  const recommendations = [];
  let skillName = '';

  if (!apiResponse || !apiResponse.data || !apiResponse.included) {
    return { recommendations, skillName };
  }

  // Extract skill name from meta
  if (apiResponse.meta && apiResponse.meta.skillName) {
    skillName = apiResponse.meta.skillName;
  }

  // Create a map of learningObjects by ID for quick lookup
  const learningObjectsMap = new Map();
  apiResponse.included.forEach((item) => {
    if (item.type === 'learningObject') {
      learningObjectsMap.set(item.id, item);
    }
  });

  // Process each recommendation
  apiResponse.data.forEach((recommendation) => {
    if (recommendation.type !== 'recommendation') return;

    // Get the learningObject reference
    const loRef = recommendation.relationships?.learningObject?.data;
    if (!loRef) return;

    const learningObject = learningObjectsMap.get(loRef.id);
    if (!learningObject) return;

    const { attributes } = learningObject;
    const currentLocale = i18n?.currentLocale;
    const localizedMetadata = (currentLocale && attributes.localizedMetadata?.find((m) => m.locale === currentLocale))
      || attributes.localizedMetadata?.[0]
      || {};

    // Extract reason (label)
    const reason = i18n.translations['alm.recommendation.suggestedforyou'] || 'Suggested for you';

    // Get instance ID from relationships
    const instanceId = learningObject.relationships?.instances?.data?.[0]?.id || '';
    const instanceIdParts = instanceId.split('_');
    const shortInstanceId = instanceIdParts.length >= 2 ? instanceIdParts[1] : '';

    // Determine button text based on enrollment status or other logic
    const buttonText = attributes.duration === 0 ? i18n.translations['alm.button.explore'] : i18n.translations['alm.button.start'];

    // Get rating badge
    const rating = attributes.rating?.averageRating || 0;
    const ratingsCount = attributes.rating?.ratingsCount || 0;
    const hasRating = ratingsCount > 0;

    const badge = {
      type: hasRating ? 'stars' : 'nr',
      rating,
      ratingsCount,
    };

    const cardData = {
      id: learningObject.id,
      instanceId: shortInstanceId,
      image: attributes.imageUrl || '',
      imageAlt: localizedMetadata.name || 'Course Image',
      badge,
      title: localizedMetadata.name || 'Untitled Course',
      date: formatDate(attributes.datePublished),
      author: attributes.authorNames?.[0] || '',
      duration: formatDuration(attributes.duration),
      label: reason,
      buttonText,
      buttonLink: '#',
      isBookmarked: attributes.isBookmarked || false,
    };

    recommendations.push(cardData);
  });

  return { recommendations, skillName };
}

/**
 * Creates a "Go To Catalog" card
 * @returns {HTMLElement} - The card element
 */
function createGoToCatalogCard() {
  const li = document.createElement('li');
  li.className = 'recommendation-card recommendation-card-goto';

  const link = document.createElement('a');
  link.href = '/browse-catalog';
  link.className = 'recommendation-goto-link';

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'recommendation-goto-body';

  const title = document.createElement('h3');
  title.className = 'recommendation-goto-title';
  title.textContent = i18n.translations['alm.recommendation.gotocatalog'];
  bodyDiv.appendChild(title);

  link.appendChild(bodyDiv);
  li.appendChild(link);

  return li;
}

/**
 * Update add button icon based on enrollment state
 * @param {HTMLElement} button - Add button element
 * @param {boolean} isEnrolled - Whether user is enrolled
 */
function updateAddButtonIcon(button, isEnrolled) {
  if (isEnrolled) {
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#0D66D0" stroke-width="2" fill="#0D66D0"/>
        <path d="M8 12L11 15L16 9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    button.disabled = true;
    button.style.opacity = '0.7';
    button.style.cursor = 'default';
  } else {
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#0D66D0" stroke-width="2"/>
        <path d="M12 8V16M8 12H16" stroke="#0D66D0" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
  }
}

/**
 * Show loading spinner in add button
 * @param {HTMLElement} button - Add button element
 */
function showAddButtonSpinner(button) {
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="#E0E0E0" stroke-width="2" fill="none"/>
      <path d="M12 2 A10 10 0 0 1 22 12" stroke="#0D66D0" stroke-width="2" fill="none" stroke-linecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
      </path>
    </svg>
  `;
  button.disabled = true;
}

/**
 * Update rating badge on a card
 * @param {HTMLElement} card - The card element
 * @param {Object} ratingData - Rating data {rating, ratingsCount}
 */
function updateCardRating(card, ratingData) {
  const badgeElement = card.querySelector('.recommendation-badge');
  if (!badgeElement) return;

  const hasRating = ratingData.ratingsCount > 0;

  badgeElement.className = 'recommendation-badge';
  badgeElement.innerHTML = '';

  if (hasRating) {
    badgeElement.classList.add('has-rating');

    const starsContainer = document.createElement('div');
    starsContainer.className = 'recommendation-stars';

    const ratingValue = Math.round(ratingData.rating);
    for (let i = 1; i <= 5; i += 1) {
      const star = document.createElement('span');
      star.className = 'recommendation-star';
      if (i <= ratingValue) {
        star.classList.add('filled');
      }
      star.textContent = '★';
      starsContainer.appendChild(star);
    }

    badgeElement.appendChild(starsContainer);

    const ratingCount = document.createElement('span');
    ratingCount.className = 'recommendation-rating-count';
    ratingCount.textContent = ratingData.ratingsCount;
    badgeElement.appendChild(ratingCount);
  } else {
    badgeElement.textContent = 'NR';
  }
}

/**
 * Update button text based on enrollment state
 * @param {HTMLElement} button - Action button element
 * @param {string} learningObjectId - Learning object ID
 * @param {string} instanceId - Instance ID
 */
async function updateButtonState(button, learningObjectId, instanceId) {
  if (!instanceId) return;

  const enrollmentState = await fetchEnrollmentState(learningObjectId, instanceId);
  if (enrollmentState) {
    const newButtonText = getButtonText(enrollmentState);
    button.textContent = newButtonText;
  }
}

/**
 * Update card after fluidic player closes (button state and rating)
 * @param {HTMLElement} card - The card element
 * @param {HTMLElement} button - Action button element
 * @param {string} learningObjectId - Learning object ID
 * @param {string} instanceId - Instance ID
 */
async function updateCardAfterPlayer(card, button, learningObjectId, instanceId) {
  await updateButtonState(button, learningObjectId, instanceId);

  const loDetails = await fetchLearningObject(learningObjectId);
  if (loDetails && loDetails.attributes && loDetails.attributes.rating) {
    const rating = loDetails.attributes.rating.averageRating || 0;
    const ratingsCount = loDetails.attributes.rating.ratingsCount || 0;
    updateCardRating(card, { rating, ratingsCount });
  }
}

/**
 * Create and show bookmark overlay
 * @param {HTMLElement} card - The card element
 * @param {string} learningObjectId - Learning object ID
 * @param {boolean} isBookmarked - Current bookmark status
 */
function showBookmarkOverlay(card, learningObjectId, isBookmarked) {
  const existingOverlay = document.querySelector('.bookmark-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.className = 'bookmark-overlay';

  const overlayContent = document.createElement('div');
  overlayContent.className = 'bookmark-overlay-content';

  const closeButton = document.createElement('button');
  closeButton.className = 'bookmark-overlay-close';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.innerHTML = '✕';
  addManagedListener(closeButton, 'click', () => {
    overlay.remove();
  });

  const bookmarkButton = document.createElement('button');
  bookmarkButton.className = 'bookmark-button';

  const bookmarkIcon = document.createElement('span');
  bookmarkIcon.className = 'bookmark-icon';
  bookmarkIcon.innerHTML = '🔖';

  const bookmarkText = document.createElement('span');
  bookmarkText.className = 'bookmark-text';
  bookmarkText.textContent = isBookmarked ? i18n.translations['alm.button.unsave'] : i18n.translations['alm.button.save'];

  bookmarkButton.appendChild(bookmarkIcon);
  bookmarkButton.appendChild(bookmarkText);

  addManagedListener(bookmarkButton, 'click', async (e) => {
    e.stopPropagation();

    bookmarkButton.disabled = true;
    const originalContent = bookmarkButton.innerHTML;
    bookmarkButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
        <circle cx="12" cy="12" r="10" stroke="#E0E0E0" stroke-width="2" fill="none"/>
        <path d="M12 2 A10 10 0 0 1 22 12" stroke="#0D66D0" stroke-width="2" fill="none" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
        </path>
      </svg>
      <span style="margin-left: 8px;">Loading...</span>
    `;

    const success = await bookmarkLearningObject(learningObjectId, !isBookmarked);

    if (success) {
      isBookmarked = !isBookmarked;

      bookmarkButton.innerHTML = '';
      const newIcon = document.createElement('span');
      newIcon.className = 'bookmark-icon';
      newIcon.innerHTML = '🔖';
      const newText = document.createElement('span');
      newText.className = 'bookmark-text';
      newText.textContent = isBookmarked ? i18n.translations['alm.button.unsave'] : i18n.translations['alm.button.save'];
      bookmarkButton.appendChild(newIcon);
      bookmarkButton.appendChild(newText);
      bookmarkButton.disabled = false;

      const moreOptionsBtn = card.querySelector('.more-options');
      if (moreOptionsBtn) {
        moreOptionsBtn.dataset.isBookmarked = isBookmarked;
      }
    } else {
      bookmarkButton.innerHTML = originalContent;
      bookmarkButton.disabled = false;
      alert(`Failed to ${isBookmarked ? 'unsave' : 'save'} the course. Please try again.`);
    }
  });

  overlayContent.appendChild(closeButton);
  overlayContent.appendChild(bookmarkButton);
  overlay.appendChild(overlayContent);

  addManagedListener(overlayContent, 'click', (e) => {
    e.stopPropagation();
  });

  card.style.position = 'relative';
  card.appendChild(overlay);

  setTimeout(() => {
    function closeOverlay(e) {
      if (!overlayContent.contains(e.target) && !e.target.closest('.more-options')) {
        overlay.remove();
        document.removeEventListener('click', closeOverlay);
      }
    }
    addManagedListener(document, 'click', closeOverlay);
  }, 0);
}

/**
 * Update both action button and add button based on enrollment state
 * @param {HTMLElement} actionButton - Action button element
 * @param {HTMLElement} addButton - Add button element
 * @param {string} learningObjectId - Learning object ID
 * @param {string} instanceId - Instance ID
 * @returns {Promise<boolean>} - Whether user is enrolled
 */
async function updateCardState(actionButton, addButton, learningObjectId, instanceId) {
  if (!instanceId) return false;

  const enrollmentState = await fetchEnrollmentState(learningObjectId, instanceId);
  const isEnrolled = enrollmentState && enrollmentState.state !== 'NOT_ENROLLED';

  if (enrollmentState) {
    const newButtonText = getButtonText(enrollmentState);
    actionButton.textContent = newButtonText;
  }

  updateAddButtonIcon(addButton, isEnrolled);

  return isEnrolled;
}

/**
 * Creates a recommendation card element
 * @param {Object} cardData - Data for the card
 * @param {Function} refreshCallback - Callback to refresh the component
 * @returns {Object} - Object containing card element and action button
 */
function createRecommendationCard(cardData, refreshCallback) {
  const li = document.createElement('li');
  li.className = 'recommendation-card';

  const cardImage = document.createElement('div');
  cardImage.className = 'card-image';

  if (cardData.image) {
    const picture = createOptimizedPicture(cardData.image, cardData.imageAlt, false, [{ width: '400' }]);
    cardImage.appendChild(picture);
  } else {
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="250"%3E%3Crect width="400" height="250" fill="%23e8e8e8"/%3E%3C/svg%3E';
    img.alt = cardData.imageAlt;
    cardImage.appendChild(img);
  }

  const badge = document.createElement('div');
  badge.className = 'recommendation-badge';

  if (cardData.badge && cardData.badge.type === 'stars') {
    badge.classList.add('has-rating');

    const starsContainer = document.createElement('div');
    starsContainer.className = 'recommendation-stars';

    const ratingValue = Math.round(cardData.badge.rating);
    for (let i = 1; i <= 5; i += 1) {
      const star = document.createElement('span');
      star.className = 'recommendation-star';
      if (i <= ratingValue) {
        star.classList.add('filled');
      }
      star.textContent = '★';
      starsContainer.appendChild(star);
    }

    badge.appendChild(starsContainer);

    const ratingCount = document.createElement('span');
    ratingCount.className = 'recommendation-rating-count';
    ratingCount.textContent = cardData.badge.ratingsCount;
    badge.appendChild(ratingCount);
  } else {
    badge.textContent = 'NR';
  }

  cardImage.appendChild(badge);

  const cardContent = document.createElement('div');
  cardContent.className = 'card-content';

  const titleRow = document.createElement('div');
  titleRow.className = 'card-title-row';

  const titleElement = document.createElement('h3');
  titleElement.className = 'card-title';
  titleElement.textContent = cardData.title;

  const addButton = document.createElement('button');
  addButton.className = 'add-button';
  addButton.setAttribute('aria-label', 'Add to list');
  addButton.dataset.learningObjectId = cardData.id;
  addButton.dataset.instanceId = cardData.instanceId;
  addButton.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="#0D66D0" stroke-width="2"/>
      <path d="M12 8V16M8 12H16" stroke="#0D66D0" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  addManagedListener(addButton, 'click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const { learningObjectId, instanceId } = addButton.dataset;

    if (!instanceId) {
      console.error('No instance ID found');
      return;
    }

    showAddButtonSpinner(addButton);

    const success = await apiEnrollUser(learningObjectId, instanceId);

    if (success) {
      await updateCardState(actionButton, addButton, learningObjectId, instanceId);
    } else {
      console.error('Enrollment failed');
      updateAddButtonIcon(addButton, false);
      alert('Failed to enroll in the course. Please try again.');
    }
  });

  titleRow.appendChild(titleElement);
  titleRow.appendChild(addButton);

  const cardMeta = document.createElement('div');
  cardMeta.className = 'card-meta';

  const metaParts = [];
  if (cardData.date) {
    metaParts.push(`<span class="date">${cardData.date}</span>`);
  }
  if (cardData.author) {
    metaParts.push(`<span class="author">${cardData.author}</span>`);
  }
  if (cardData.duration) {
    metaParts.push(`<span class="duration">${cardData.duration}</span>`);
  }

  cardMeta.innerHTML = metaParts.join('<span class="separator">•</span>');

  const cardLabel = document.createElement('p');
  cardLabel.className = 'card-label';
  cardLabel.textContent = cardData.label;

  const cardActions = document.createElement('div');
  cardActions.className = 'card-actions';

  const actionButton = document.createElement('button');
  actionButton.className = 'action-button primary';
  actionButton.textContent = cardData.buttonText;
  actionButton.dataset.learningObjectId = cardData.id;
  actionButton.dataset.instanceId = cardData.instanceId;

  addManagedListener(actionButton, 'click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const { learningObjectId, instanceId } = actionButton.dataset;
    const accessToken = getAlmAccessToken();

    if (!accessToken) {
      console.error('No access token found');
      alert('Please log in to continue');
      return;
    }

    if (!learningObjectId || !instanceId) {
      console.error('No learning object ID or instance ID found');
      return;
    }

    const enrollmentState = await fetchEnrollmentState(learningObjectId, instanceId);
    const isEnrolled = enrollmentState && enrollmentState.state !== 'NOT_ENROLLED';

    if (!isEnrolled) {
      showAddButtonSpinner(addButton);

      const enrollmentSuccess = await apiEnrollUser(learningObjectId, instanceId);

      if (!enrollmentSuccess) {
        console.error('Enrollment failed');
        updateAddButtonIcon(addButton, false);
        alert('Failed to enroll in the course. Please try again.');
        return;
      }

      updateAddButtonIcon(addButton, true);
      actionButton.textContent = 'CONTINUE';
    }

    const playerUrl = `https://learningmanager.adobe.com/app/player?lo_id=${learningObjectId}&access_token=${accessToken}&hostname=https://learningmanager.adobe.com&trapfocus=true`;

    createFluidicPlayerModal(playerUrl, async () => {
      await updateCardAfterPlayer(li, actionButton, learningObjectId, instanceId);

      if (refreshCallback && typeof refreshCallback === 'function') {
        refreshCallback();
      }
    });
  });

  const moreOptions = document.createElement('button');
  moreOptions.className = 'more-options';
  moreOptions.setAttribute('aria-label', 'More options');
  moreOptions.textContent = '⋮';
  moreOptions.dataset.learningObjectId = cardData.id;
  moreOptions.dataset.isBookmarked = cardData.isBookmarked;

  addManagedListener(moreOptions, 'click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const { learningObjectId, isBookmarked } = moreOptions.dataset;

    showBookmarkOverlay(li, learningObjectId, isBookmarked === 'true');
  });

  cardActions.appendChild(actionButton);
  cardActions.appendChild(moreOptions);

  cardContent.appendChild(titleRow);
  cardContent.appendChild(cardMeta);
  cardContent.appendChild(cardLabel);
  cardContent.appendChild(cardActions);

  li.appendChild(cardImage);
  li.appendChild(cardContent);

  return { card: li, actionButton };
}

/**
 * Create a skill section with recommendations
 * @param {Object} skillGroup - Skill group data
 * @param {boolean} isFirst - Whether this is the first section
 * @returns {HTMLElement} - Skill section element
 */
function createSkillSection(skillGroup, isFirst = false) {
  const section = document.createElement('div');
  section.className = `skill-section${isFirst ? ' visible' : ''}`;

  const { skillName, recommendations } = skillGroup;

  const header = document.createElement('div');
  header.className = 'recommendations-header';

  const title = document.createElement('h2');
  title.textContent = `${i18n.translations['alm.recommendation.heading']} - ${skillName}`;
  header.appendChild(title);

  const navigationArrows = document.createElement('div');
  navigationArrows.className = 'navigation-arrows';

  const prevArrow = document.createElement('button');
  prevArrow.className = 'nav-arrow prev';
  prevArrow.setAttribute('aria-label', 'Previous');

  const nextArrow = document.createElement('button');
  nextArrow.className = 'nav-arrow next';
  nextArrow.setAttribute('aria-label', 'Next');

  navigationArrows.appendChild(prevArrow);
  navigationArrows.appendChild(nextArrow);
  header.appendChild(navigationArrows);

  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'recommendations-scroll-container';

  const grid = document.createElement('div');
  grid.className = 'recommendations-grid';

  const cardButtons = [];

  recommendations.forEach((recommendation) => {
    const { card, actionButton } = createRecommendationCard(recommendation);
    grid.appendChild(card);
  });

  const goToCatalogCard = createGoToCatalogCard();
  grid.appendChild(goToCatalogCard);

  scrollContainer.appendChild(grid);

  section.appendChild(header);
  section.appendChild(scrollContainer);

  const cardsPerPage = 3;
  const cardWidth = 400 + 24;
  const pageWidth = cardWidth * cardsPerPage;
  let currentPage = 0;
  const totalCards = recommendations.length + 1;
  const totalPages = Math.ceil(totalCards / cardsPerPage);

  const updatePaginationButtons = () => {
    prevArrow.disabled = currentPage === 0;
    nextArrow.disabled = currentPage >= totalPages - 1;
  };

  const scrollToPage = (page) => {
    const scrollPosition = page * pageWidth;
    scrollContainer.scrollTo({
      left: scrollPosition,
      behavior: 'smooth',
    });
    currentPage = page;
    updatePaginationButtons();
  };

  addManagedListener(prevArrow, 'click', () => {
    if (currentPage > 0) {
      scrollToPage(currentPage - 1);
    }
  });

  addManagedListener(nextArrow, 'click', () => {
    if (currentPage < totalPages - 1) {
      scrollToPage(currentPage + 1);
    }
  });

  addManagedListener(scrollContainer, 'scroll', () => {
    const { scrollLeft } = scrollContainer;
    const newPage = Math.round(scrollLeft / pageWidth);
    if (newPage !== currentPage) {
      currentPage = newPage;
      updatePaginationButtons();
    }
  });

  updatePaginationButtons();

  return section;
}

/**
 * Main decoration function
 */
export default async function decorate(block) {
  block.innerHTML = '<div class="loading-state">Loading recommendations...</div>';

  let firstValidStrip = null;
  let firstValidStripNumber = 0;
  let totalStripCount = 1;

  const maxStripsToCheck = 10;

  for (let i = 1; i <= maxStripsToCheck; i++) {
    try {
      const data = await fetchRecommendations(i, 10);
      
      if (data.meta?.stripCount) {
        totalStripCount = data.meta.stripCount;
      }

      const result = parseApiResponse(data);

      if (result.recommendations.length > 0) {
        firstValidStrip = {
          skillGroup: {
            skillName: result.skillName,
            recommendations: result.recommendations,
          },
          stripCount: totalStripCount,
        };
        firstValidStripNumber = i;
        break;
      } else if (totalStripCount > 1 && i >= totalStripCount) {
        break;
      }
    } catch (error) {
      console.error(`Error fetching strip ${i}:`, error);
      break;
    }
  }

  block.innerHTML = '';

  if (!firstValidStrip?.skillGroup) {
    block.innerHTML = `<div class="error-state">${i18n.translations['alm.norecommendation']}</div>`;
    return;
  }

  const container = document.createElement('div');
  container.className = 'recommendations-container';

  const firstSection = createSkillSection(firstValidStrip.skillGroup, true);
  container.appendChild(firstSection);

  const remainingStripsCount = totalStripCount - firstValidStripNumber;

    if (remainingStripsCount > 0) {
    const showMoreButton = document.createElement('button');
    showMoreButton.className = 'show-more-button';
    showMoreButton.textContent = i18n.translations['alm.recommendation.showmore'] || 'Show More';

    addManagedListener(showMoreButton, 'click', async () => {
      showMoreButton.disabled = true;
      showMoreButton.textContent = (i18n.translations['alm.recommendation.loading'] || 'Loading') + '...';

      const stripPromises = [];
      for (let i = firstValidStripNumber + 1; i <= totalStripCount; i++) {
        stripPromises.push(fetchRecommendations(i, 10).then(data => ({
          data,
          result: parseApiResponse(data)
        })).catch(err => {
          console.error(`Error fetching strip ${i}:`, err);
          return null;
        }));
      }

      const remainingStrips = await Promise.all(stripPromises);

      remainingStrips.forEach((stripResult) => {
        if (stripResult && stripResult.result && stripResult.result.recommendations.length > 0) {
          const section = createSkillSection({
            skillName: stripResult.result.skillName,
            recommendations: stripResult.result.recommendations,
          }, true);
          container.insertBefore(section, showMoreButton);
        }
      });

      showMoreButton.remove();
    });

    container.appendChild(showMoreButton);
  }

  block.appendChild(container);
  
  // Return cleanup function
  return () => cleanupChildren(block);
}
