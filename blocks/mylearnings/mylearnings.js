import { createOptimizedPicture } from '../../scripts/aem.js';
import { createFluidicPlayerModal } from '../course-overview/ui-components.js';
import { getAlmAccessToken } from '../../scripts/alm-token.js';
import { fetchEnrolledLearningObjects } from '../../scripts/api-service.js';
import { addManagedListener, cleanupChildren } from '../../scripts/dom-utils.js';

const i18n = window.alm.i18n;
/**
 * Converts duration in seconds to minutes format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration (e.g., "8m")
 */
function formatDuration(seconds) {
  if (!seconds) return '0m';
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

/**
 * Formats date from ISO string
 * @param {string} isoDate - ISO date string
 * @returns {string} - Formatted date (e.g., "29 Jun")
 */
function formatDate(isoDate) { 
  if (!isoDate) return ''; 
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${day} ${month}`; 
}

/**
 * Finds enrollment data from included array
 * @param {Array} included - Included array from API response
 * @param {string} enrollmentId - Enrollment ID to find
 * @returns {Object|null} - Enrollment data or null
 */
function findEnrollment(included, enrollmentId) {
  return included.find(item =>
    item.type === 'learningObjectInstanceEnrollment' && item.id === enrollmentId
  );
}

/**
 * Finds skill data from included array
 * @param {Array} included - Included array from API response
 * @param {string} skillId - Skill ID to find
 * @returns {string} - Skill name or empty string
 */
function findSkillName(included, skillId) {
  const skill = included.find(item =>
    item.type === 'skill' && item.id === skillId
  );
  return skill ? skill.attributes.name : '';
}

/**
 * Transforms API learning object to card data
 * @param {Object} learningObject - Learning object from API
 * @param {Array} included - Included array from API response
 * @returns {Object} - Card data
 */
function transformLearningObjectToCard(learningObject, included) {
  const { attributes, relationships } = learningObject;
  const currentLocale = i18n?.currentLocale;
  const metadata = (currentLocale && attributes.localizedMetadata?.find((m) => m.locale === currentLocale))
    || attributes.localizedMetadata?.[0]
    || {};

  // Get enrollment data
  const enrollmentId = relationships.enrollment?.data?.id;
  const enrollment = enrollmentId ? findEnrollment(included, enrollmentId) : null;
  const progressPercent = enrollment?.attributes?.progressPercent || 0;

  // Get skill/category
  const skillData = relationships.skills?.data?.[0];
  let category = '';
  if (skillData) {
    const learningObjectSkill = included.find(item =>
      item.type === 'learningObjectSkill' && item.id === skillData.id
    );
    if (learningObjectSkill) {
      const skillLevelId = learningObjectSkill.relationships?.skillLevel?.data?.id;
      if (skillLevelId) {
        const skillLevel = included.find(item =>
          item.type === 'skillLevel' && item.id === skillLevelId
        );
        if (skillLevel) {
          const skillId = skillLevel.relationships?.skill?.data?.id;
          category = findSkillName(included, skillId);
        }
      }
    }
  }

  // Get rating badge
  const rating = attributes.rating?.averageRating || 0;
  const ratingsCount = attributes.rating?.ratingsCount || 0;
  const hasRating = ratingsCount > 0;

  const badge = {
    type: hasRating ? 'stars' : 'nr',
    rating: rating,
    ratingsCount: ratingsCount
  };

  // Format enrollment date
  const dateEnrolled = enrollment?.attributes?.dateEnrolled;
  const formattedDate = formatDate(dateEnrolled);

  return {
    title: metadata.name || 'Untitled Course',
    category: category || attributes.loType || 'Course',
    date: formattedDate,
    duration: formatDuration(attributes.duration),
    progressText: `${progressPercent}% ${i18n.translations['alm.mylearning.completed']}`,
    progress: `${progressPercent}%`,
    badge: badge,
    image: {
      src: attributes.imageUrl || 'https://placehold.co/420x220/4a5568/white?text=Course',
      alt: metadata.name || 'Course'
    },
    learningObjectId: learningObject.id
  };
}

/**
 * Fetches learning objects from API
 * @returns {Promise<Array>} - Array of card data
 */
async function fetchLearningObjects() {
  try {
    // Use centralized API service
    const data = await fetchEnrolledLearningObjects(5);

    // Transform learning objects to card data
    const cards = data.data.map(learningObject =>
      transformLearningObjectToCard(learningObject, data.included || [])
    );

    return cards;
  } catch (error) {
    console.error('Error fetching learning objects:', error);
    return [];
  }
}

/**
 * Creates a "Go to My Learning" card
 * @returns {HTMLElement} - The card element
 */
function createGoToMyLearningCard() {
  const li = document.createElement('li');
  li.className = 'mylearning-card mylearning-card-goto';

  // Card link wrapper
  const link = document.createElement('a');
  link.href = '/mylearning'; // Update this URL as needed
  link.className = 'mylearning-goto-link';

  // Card body (no image for this card)
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'mylearning-card-body mylearning-goto-body';

  // Title
  const title = document.createElement('h3');
  title.className = 'mylearning-card-title mylearning-goto-title';
  title.textContent = i18n.translations['alm.gotomylearning'] || 'Go to My Learning';
  bodyDiv.appendChild(title);

  link.appendChild(bodyDiv);
  li.appendChild(link);

  return li;
}

/**
 * Creates a learning card element
 * @param {Object} cardData - Data for the card
 * @returns {HTMLElement} - The card element
 */
function createCard(cardData) {
  const li = document.createElement('li');
  li.className = 'mylearning-card';

  // Card image
  const imageDiv = document.createElement('div');
  imageDiv.className = 'mylearning-card-image';

  const img = cardData.image;
  if (img) {
    const picture = createOptimizedPicture(img.src, img.alt || 'Learning course', false, [{ width: '420' }]);
    imageDiv.appendChild(picture);
  }

  // Badge (NR - Not Rated or star rating)
  const badge = document.createElement('div');
  badge.className = 'mylearning-badge';

  if (cardData.badge && cardData.badge.type === 'stars') {
    // Has rating - show stars
    badge.classList.add('has-rating');

    // Create stars container
    const starsContainer = document.createElement('div');
    starsContainer.className = 'mylearning-stars';

    // Create 5 stars
    const rating = Math.round(cardData.badge.rating); // Round to nearest whole number
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = 'mylearning-star';
      if (i <= rating) {
        star.classList.add('filled');
      }
      star.textContent = '★';
      starsContainer.appendChild(star);
    }

    badge.appendChild(starsContainer);

    // Add rating count
    const ratingCount = document.createElement('span');
    ratingCount.className = 'mylearning-rating-count';
    ratingCount.textContent = cardData.badge.ratingsCount;
    badge.appendChild(ratingCount);
  } else {
    // No rating - show NR
    badge.textContent = 'NR';
  }

  imageDiv.appendChild(badge);

  // Card body
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'mylearning-card-body';

  // Title
  const title = document.createElement('h3');
  title.className = 'mylearning-card-title';
  title.textContent = cardData.title || '';
  bodyDiv.appendChild(title);

  // Category
  const category = document.createElement('p');
  category.className = 'mylearning-card-category';
  category.textContent = cardData.category || '';
  bodyDiv.appendChild(category);

  // Meta (date and duration)
  const meta = document.createElement('p');
  meta.className = 'mylearning-card-meta';
  meta.innerHTML = `${cardData.date || ''} <span style="margin: 0 4px;">•</span> ${cardData.duration || ''}`;
  bodyDiv.appendChild(meta);

  // Footer (progress + button)
  const footer = document.createElement('div');
  footer.className = 'mylearning-card-footer';

  // Progress section
  const progressDiv = document.createElement('div');
  progressDiv.className = 'mylearning-progress';

  const progressText = document.createElement('p');
  progressText.className = 'mylearning-progress-text';
  progressText.textContent = cardData.progressText || '0% completed';
  progressDiv.appendChild(progressText);

  const progressBar = document.createElement('div');
  progressBar.className = 'mylearning-progress-bar';
  const progressFill = document.createElement('div');
  progressFill.className = 'mylearning-progress-fill';
  progressFill.style.width = cardData.progress || '0%';
  progressBar.appendChild(progressFill);
  progressDiv.appendChild(progressBar);

  footer.appendChild(progressDiv);

  // Continue button
  const continueBtn = document.createElement('button');
  continueBtn.className = 'mylearning-continue-btn';
  continueBtn.textContent = i18n.translations['alm.mylearning.continue'];
  addManagedListener(continueBtn, 'click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Get access token from session storage
    const accessToken = getAlmAccessToken();

    if (!accessToken) {
      console.error('No access token found');
      alert('Please log in to continue');
      return;
    }

    // Build fluidic player URL
    const playerUrl = `https://learningmanager.adobe.com/app/player?lo_id=${cardData.learningObjectId}&access_token=${accessToken}&hostname=https://learningmanager.adobe.com&trapfocus=true`;

    // Launch fluidic player modal with refresh callback
    createFluidicPlayerModal(playerUrl, cardData.onRefresh);
  });
  footer.appendChild(continueBtn);

  bodyDiv.appendChild(footer);

  li.appendChild(imageDiv);
  li.appendChild(bodyDiv);

  return li;
}

/**
 * Updates navigation button states
 * @param {HTMLElement} scrollContainer - The scroll container
 * @param {HTMLElement} prevBtn - Previous button
 * @param {HTMLElement} nextBtn - Next button
 */
function updateNavigationButtons(scrollContainer, prevBtn, nextBtn) {
  const isAtStart = scrollContainer.scrollLeft <= 0;
  const isAtEnd = scrollContainer.scrollLeft + scrollContainer.clientWidth >= scrollContainer.scrollWidth - 1;

  prevBtn.disabled = isAtStart;
  nextBtn.disabled = isAtEnd;
}

/**
 * Decorates the myLearning block
 * @param {HTMLElement} block - The block element
 */
export default async function decorate(block) {
  // Show loading state
  block.innerHTML = '<div style="text-align: center; padding: 40px; color: #707070;">Loading learning objects...</div>';

  // Fetch learning objects from API
  const cards = await fetchLearningObjects();

  // If no cards fetched, show message
  if (cards.length === 0) {
    block.innerHTML = '<div style="text-align: center; padding: 40px; color: #707070;">No learning objects found. Please make sure you are logged in.</div>';
    return;
  }

  // Clear the block
  block.innerHTML = '';

  // Create header with title and navigation
  const header = document.createElement('div');
  header.className = 'mylearning-header';

  const title = document.createElement('h2');
  title.textContent = i18n?.translations['alm.mylearning.heading'] || 'My Learning';
  header.appendChild(title);

  const navigation = document.createElement('div');
  navigation.className = 'mylearning-navigation';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'mylearning-nav-button prev';
  prevBtn.setAttribute('aria-label', 'Previous');

  const nextBtn = document.createElement('button');
  nextBtn.className = 'mylearning-nav-button next';
  nextBtn.setAttribute('aria-label', 'Next');

  navigation.appendChild(prevBtn);
  navigation.appendChild(nextBtn);
  header.appendChild(navigation);

  // Create scroll container
  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'mylearning-scroll-container';

  // Create card list
  const ul = document.createElement('ul');
  ul.className = 'mylearning-list';

  // Define refresh callback function
  const refreshBlock = async () => {
    // Re-fetch and re-render the block
    await decorate(block);
  };

  // Add learning cards with refresh callback
  cards.forEach(cardData => {
    // Add refresh callback to card data
    cardData.onRefresh = refreshBlock;
    const card = createCard(cardData);
    ul.appendChild(card);
  });

  // Add "Go to My Learning" card as the 6th card
  const goToCard = createGoToMyLearningCard();
  ul.appendChild(goToCard);

  scrollContainer.appendChild(ul);

  // Add elements to block
  block.appendChild(header);
  block.appendChild(scrollContainer);

  // Set up pagination navigation (3 cards per page)
  const cardsPerPage = 3;
  const cardWidth = 400 + 24; // card width + gap
  const pageWidth = cardWidth * cardsPerPage;
  let currentPage = 0;
  const totalCards = cards.length + 1; // +1 for "Go to My Learning" card
  const totalPages = Math.ceil(totalCards / cardsPerPage);

  const scrollToPage = (page) => {
    const scrollPosition = page * pageWidth;
    scrollContainer.scrollTo({
      left: scrollPosition,
      behavior: 'smooth'
    });
    currentPage = page;
    updatePaginationButtons();
  };

  const updatePaginationButtons = () => {
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1;
  };

  addManagedListener(prevBtn, 'click', () => {
    if (currentPage > 0) {
      scrollToPage(currentPage - 1);
    }
  });

  addManagedListener(nextBtn, 'click', () => {
    if (currentPage < totalPages - 1) {
      scrollToPage(currentPage + 1);
    }
  });

  // Update current page based on scroll position
  addManagedListener(scrollContainer, 'scroll', () => {
    const scrollLeft = scrollContainer.scrollLeft;
    const newPage = Math.round(scrollLeft / pageWidth);
    if (newPage !== currentPage) {
      currentPage = newPage;
      updatePaginationButtons();
    }
  });

  // Initial button state
  updatePaginationButtons();

  // Update on resize
  addManagedListener(window, 'resize', () => {
    updatePaginationButtons();
  });
  
  // Return cleanup function
  return () => cleanupChildren(block);
}
