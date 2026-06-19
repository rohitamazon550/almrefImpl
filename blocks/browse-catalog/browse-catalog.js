import { getAlmAccessToken } from '../../scripts/alm-token.js';

// API Configuration
const API_CONFIG = {
  baseUrl: 'https://learningmanager.adobe.com/primeapi/v2',
  headers: {
    'Accept': 'application/vnd.api+json',
    'Authorization': `oauth ${getAlmAccessToken()}`
  }
};

// Search API function
async function searchLearningObjects(searchTerm, limit = 9, cursor = null) {
  try {
    const params = new URLSearchParams({
      'filter.loTypes': 'course,learningProgram,certification,jobAid',
      'sort': 'relevance',
      'page[limit]': limit,
      'include': 'model.instances.loResources.resources,model.instances.badge,model.supplementaryResources,model.enrollment.loResourceGrades,model.skills.skillLevel.skill',
      'filter.ignoreEnhancedLP': 'false',
      'enforcedFields[learningObject]': 'extensionOverrides',
      'query': searchTerm,
      'snippetType': 'courseName,courseOverview,courseDescription,moduleName,certificationName,certificationOverview,certificationDescription,jobAidName,jobAidDescription,lpName,lpDescription,lpOverview,embedLpName,embedLpDesc,embedLpOverview,skillName,skillDescription,note,badgeName,courseTag,moduleTag,jobAidTag,lpTag,certificationTag,embedLpTag,discussion',
      'language': 'en-US'
    });

    if (cursor) {
      params.append('page[cursor]', cursor);
    }

    const url = `${API_CONFIG.baseUrl}/search?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching learning objects:', error);
    return { data: [], meta: { count: 0 }, links: {} };
  }
}

// Fetch learning objects from API
async function fetchLearningObjects(limit = 9, searchTerm = '', filters = {}, cursor = null) {
  try {
    const params = new URLSearchParams({
      'include': 'instances.loResources.resources,instances.badge,supplementaryResources,enrollment.loResourceGrades,skills.skillLevel.skill,instances.loResources.resources.room',
      'page[limit]': limit,
      'sort': '-date',
      'filter.ignoreEnhancedLP': 'false'
    });

    // Add cursor for pagination if provided
    if (cursor) {
      params.append('page[cursor]', cursor);
    }

    // Add search filter if provided
    if (searchTerm) {
      params.append('filter.search', searchTerm);
    }

    // Add type filters if provided
    if (filters.loTypes && filters.loTypes.length > 0) {
      params.append('filter.loTypes', filters.loTypes.join(','));
    }

    // Add skill filters if provided
    if (filters.skillNames && filters.skillNames.length > 0) {
      // Use the first skill for now, API might not support multiple skills
      params.append('filter.skillName', filters.skillNames[0]);
    }

    // Add tag filters if provided
    if (filters.tagNames && filters.tagNames.length > 0) {
      // Use the first tag for now, API might not support multiple tags
      params.append('filter.tagName', filters.tagNames[0]);
    }

    const url = `${API_CONFIG.baseUrl}/learningObjects?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching learning objects:', error);
    // Return fallback data in case of error
    return { data: [], meta: { count: 0 }, links: {} };
  }
}

// Fetch skill details from API
async function fetchSkillDetails(skillId) {
  try {
    const url = `${API_CONFIG.baseUrl}/skills/${skillId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching skill details:', error);
    return null;
  }
}

// Fetch available tags from API
async function fetchTags() {
  try {
    const url = `${API_CONFIG.baseUrl}/data?filter.tagName=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data.attributes.names || [];
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
}

// Fetch available skills from API
async function fetchSkills() {
  try {
    const url = `${API_CONFIG.baseUrl}/data?filter.skillName=true`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data.attributes.names || [];
  } catch (error) {
    console.error('Error fetching skills:', error);
    return [];
  }
}

// Fetch available catalogs from API
async function fetchCatalogs() {
  try {
    const url = `${API_CONFIG.baseUrl}/catalogs`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching catalogs:', error);
    return [];
  }
}

// Cache for skill names to avoid repeated API calls
const skillCache = new Map();

// Get skill names synchronously from cache (for immediate rendering)
function getSkillNamesSync(item) {
  if (!item.relationships || !item.relationships.skills || !item.relationships.skills.data) {
    return ['General'];
  }

  const skillNames = [];
  
  item.relationships.skills.data.forEach((skillRef) => {
    const skillIdMatch = skillRef.id.match(/_(\d+)$/);
    if (skillIdMatch) {
      const skillId = skillIdMatch[1];
      if (skillCache.has(skillId)) {
        skillNames.push(skillCache.get(skillId));
      }
    }
  });

  return skillNames.length > 0 ? skillNames.slice(0, 2) : ['General'];
}

// Load skills progressively with controlled concurrency
async function loadSkillsProgressively(courses) {
  const allSkillIds = new Set();
  
  // Collect all unique skill IDs
  courses.forEach(course => {
    if (course.relationships?.skills?.data) {
      course.relationships.skills.data.forEach(skillRef => {
        const skillIdMatch = skillRef.id.match(/_(\d+)$/);
        if (skillIdMatch) {
          allSkillIds.add(skillIdMatch[1]);
        }
      });
    }
  });
  
  const skillIds = Array.from(allSkillIds);
  const CONCURRENT_LIMIT = 3; // Max 3 concurrent requests to avoid rate limiting
  
  // Process skills in batches
  for (let i = 0; i < skillIds.length; i += CONCURRENT_LIMIT) {
    const batch = skillIds.slice(i, i + CONCURRENT_LIMIT);
    
    // Fetch batch concurrently (only if not in cache)
    await Promise.all(
      batch.map(async (skillId) => {
        if (!skillCache.has(skillId)) {
          try {
            const skillData = await fetchSkillDetails(skillId);
            if (skillData && skillData.attributes && skillData.attributes.name) {
              skillCache.set(skillId, skillData.attributes.name);
            }
          } catch (error) {
            console.error(`Error fetching skill ${skillId}:`, error);
          }
        }
      })
    );
    
    // Update cards with newly loaded skills
    updateCardsWithSkills(courses);
  }
}

// Update all course cards with loaded skill names
function updateCardsWithSkills(courses) {
  courses.forEach(course => {
    const courseId = course.id;
    const card = document.querySelector(`[data-course-id="${courseId}"]`);
    
    if (card) {
      const skillsElement = card.querySelector('.card-skills span:last-child');
      if (skillsElement) {
        const skillNames = getSkillNamesSync(course);
        const skillsText = skillNames.length > 0 ? skillNames.join(', ') : 'General';
        skillsElement.textContent = `Skills: ${skillsText}`;
      }
    }
  });
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return 'Self-paced';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getCardIcon(loFormat, loType) {
  const icons = {
    'Self Paced': '📚',
    'Virtual Classroom': '🎓',
    'certification': '🏆',
    'learningProgram': '📋',
    'jobAid': '🔧'
  };
  
  return icons[loFormat] || icons[loType] || '📖';
}

function getCardClass(loFormat) {
  const formatMap = {
    'Self Paced': 'self-paced',
    'Virtual Classroom': 'virtual-classroom',
    'Blended': 'self-paced'
  };
  
  return formatMap[loFormat] || 'self-paced';
}

function getEnrollmentStatus(item) {
  if (item.relationships && item.relationships.enrollment) {
  }
  return 'Complete';
  return '';
}

function createCourseCard(item, includedData = []) {
  let attributes = item.attributes;
  
  // Handle search API response structure
  if (item.type === 'searchResult' && item.relationships?.model?.data) {
    // Find the actual learning object in the included data
    const modelId = item.relationships.model.data.id;
    const actualLearningObject = includedData.find(included => 
      included.id === modelId && included.type === 'learningObject'
    );
    
    if (actualLearningObject) {
      attributes = actualLearningObject.attributes;
      // Update item to use the actual learning object for other processing
      item = actualLearningObject;
    }
  }
  
  // Handle both regular API and search API response structures
  const metadata = attributes.localizedMetadata && attributes.localizedMetadata[0] 
    ? attributes.localizedMetadata[0] 
    : { name: attributes.name || 'Untitled Course', description: '', overview: '' };
  const cardClass = getCardClass(attributes.loFormat);
  const icon = getCardIcon(attributes.loFormat, attributes.loType);
  const duration = formatDuration(attributes.duration);
  const status = getEnrollmentStatus(item);
  
  // Get skill names synchronously from cache (will show "General" initially if not cached)
  const skillNames = getSkillNamesSync(item);
  const skillsText = skillNames.length > 0 ? skillNames.join(', ') : 'General';
  
  const card = document.createElement('div');
  card.className = 'course-card';
  card.dataset.courseId = item.id;
  
  // Check if course has an image
  const hasImage = attributes.imageUrl && attributes.imageUrl.trim() !== '';
  
  // Create card structure using createElement
  if (hasImage) {
    const cardImage = document.createElement('div');
    cardImage.className = 'card-image';
    
    const img = document.createElement('img');
    img.src = attributes.imageUrl;
    img.alt = metadata.name;
    img.loading = 'lazy';
    img.onerror = function() { this.style.display = 'none'; };
    
    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';
    
    const typeBadge = document.createElement('div');
    typeBadge.className = 'card-type-badge';
    typeBadge.textContent = attributes.loFormat || 'Self Paced';
    
    overlay.appendChild(typeBadge);
    cardImage.appendChild(img);
    cardImage.appendChild(overlay);
    card.appendChild(cardImage);
  } else {
    const cardHeader = document.createElement('div');
    cardHeader.className = `card-header ${cardClass}`;
    
    const typeBadge = document.createElement('div');
    typeBadge.className = 'card-type-badge';
    typeBadge.textContent = attributes.loFormat || 'Self Paced';
    
    const cardIcon = document.createElement('div');
    cardIcon.className = 'card-icon';
    cardIcon.textContent = icon;
    
    cardHeader.appendChild(typeBadge);
    cardHeader.appendChild(cardIcon);
    card.appendChild(cardHeader);
  }
  
  // Card body
  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';
  
  const cardTitle = document.createElement('h4');
  cardTitle.className = 'card-title';
  cardTitle.textContent = metadata.name;
  
  const cardType = document.createElement('div');
  cardType.className = 'card-type';
  cardType.textContent = attributes.loType;
  
  const cardFooter = document.createElement('div');
  cardFooter.className = 'card-footer';
  
  const cardSkills = document.createElement('div');
  cardSkills.className = 'card-skills';
  
  const skillIcon = document.createElement('span');
  skillIcon.textContent = '🎯';
  
  const skillText = document.createElement('span');
  skillText.textContent = `Skills: ${skillsText}`;
  
  cardSkills.appendChild(skillIcon);
  cardSkills.appendChild(skillText);
  cardFooter.appendChild(cardSkills);
  
  if (status) {
    const cardStatus = document.createElement('div');
    cardStatus.className = 'card-status status-complete';
    cardStatus.textContent = status;
    cardFooter.appendChild(cardStatus);
  }
  
  const cardDuration = document.createElement('div');
  cardDuration.className = 'card-duration';
  cardDuration.textContent = duration;
  
  cardBody.appendChild(cardTitle);
  cardBody.appendChild(cardType);
  cardBody.appendChild(cardFooter);
  cardBody.appendChild(cardDuration);
  card.appendChild(cardBody);
  
  // Add click handler
  card.addEventListener('click', () => {
    
    let trainingId;
    let instanceId;
    
    // Check if this is a learning program
    if (attributes.loType === 'learningProgram') {
      // Extract numeric ID from learningProgram:163767 format
      const lpNumericId = item.id.replace('learningProgram:', '');
      trainingId = `lp-${lpNumericId}`;
      instanceId = lpNumericId;
      
      // Try to get the first instance ID from the LP data
      if (item.relationships && item.relationships.instances && item.relationships.instances.data && item.relationships.instances.data.length > 0) {
        const fullInstanceId = item.relationships.instances.data[0].id;
        // Extract numeric part and format as lpId-instanceId
        instanceId = fullInstanceId.replace('learningProgram:', '').replace('_', '-');
      }
    } else {
      // Regular course handling
      trainingId = item.id.replace('course:', '');
      instanceId = trainingId;
      
      // Try to get the first instance ID from the course data
      if (item.relationships && item.relationships.instances && item.relationships.instances.data && item.relationships.instances.data.length > 0) {
        const fullInstanceId = item.relationships.instances.data[0].id;
        // Extract numeric part and format as courseId-instanceId (e.g., "7235190-7875851")
        instanceId = fullInstanceId.replace('course:', '').replace('_', '-');
      }
    }
    
    // Construct the overview URL with proper path format
    const overviewUrl = `/overview/trainingId/${trainingId}/trainingInstanceId/${instanceId}`;
    
    
    // Navigate to the overview page
    window.location.href = overviewUrl;
  });
  
  return card;
}

async function createSidebar() {
  const sidebar = document.createElement('div');
  sidebar.className = 'catalog-sidebar';
  
  // Fetch catalogs, tags and skills data
  const [catalogs, tags, skills] = await Promise.all([fetchCatalogs(), fetchTags(), fetchSkills()]);
  
  // Create catalog filter items
  const catalogFilterItems = catalogs.map((catalog, index) => {
    const catalogName = catalog.attributes?.localizedMetadata?.[0]?.name || catalog.attributes?.name || `Catalog ${catalog.id}`;
    const catalogId = `catalog-${catalog.id}`;
    
    return `
      <div class="filter-item">
        <input type="checkbox" id="${catalogId}" data-catalog="${catalog.id}">
        <label for="${catalogId}">${catalogName}</label>
      </div>
    `;
  }).join('');
  
  // Create tags filter items
  const tagsFilterItems = tags.map(tag => `
    <div class="filter-item">
      <input type="checkbox" id="tag-${tag.toLowerCase().replace(/\s+/g, '-')}" data-tag="${tag}">
      <label for="tag-${tag.toLowerCase().replace(/\s+/g, '-')}">${tag}</label>
    </div>
  `).join('');
  
  // Create skills filter items
  const skillsFilterItems = skills.map(skill => `
    <div class="filter-item">
      <input type="checkbox" id="skill-${skill.toLowerCase().replace(/\s+/g, '-')}" data-skill="${skill}">
      <label for="skill-${skill.toLowerCase().replace(/\s+/g, '-')}">${skill}</label>
    </div>
  `).join('');
  
  sidebar.innerHTML = `
    <div class="sidebar-section">
      <h3>Catalogs</h3>
      <div class="filter-group" id="catalogs-filter-group">
        ${catalogFilterItems || '<div class="filter-item">No catalogs available</div>'}
      </div>
    </div>
    
    <div class="sidebar-section">
      <h3>Type</h3>
      <div class="filter-group">
        <div class="filter-item">
          <input type="checkbox" id="courses">
          <label for="courses">Courses</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="learning-paths">
          <label for="learning-paths">Learning Paths</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="job-aids">
          <label for="job-aids">Job aids</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="certifications">
          <label for="certifications">Certifications</label>
        </div>
      </div>
    </div>
    
    <div class="sidebar-section">
      <h3>Tags</h3>
      <div class="filter-group" id="tags-filter-group">
        ${tagsFilterItems || '<div class="filter-item">No tags available</div>'}
      </div>
    </div>
    
    <div class="sidebar-section">
      <h3>Skills</h3>
      <div class="filter-group" id="skills-filter-group">
        ${skillsFilterItems || '<div class="filter-item">No skills available</div>'}
      </div>
    </div>
    
    <div class="sidebar-section">
      <h3>Format</h3>
      <div class="filter-group" id="format-filter-group">
        <div class="filter-item">
          <input type="checkbox" id="format-activity" data-format="Activity">
          <label for="format-activity">Activity</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="format-blended" data-format="Blended">
          <label for="format-blended">Blended</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="format-self-paced" data-format="Self Paced">
          <label for="format-self-paced">Self Paced</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="format-virtual-classroom" data-format="Virtual Classroom">
          <label for="format-virtual-classroom">Virtual Classroom</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="format-classroom" data-format="Classroom">
          <label for="format-classroom">Classroom</label>
        </div>
      </div>
    </div>
    
    <div class="sidebar-section">
      <h3>Duration</h3>
      <div class="filter-group" id="duration-filter-group">
        <div class="filter-item">
          <input type="checkbox" id="duration-30-mins" data-duration="30-mins">
          <label for="duration-30-mins">30 mins or less</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="duration-30-mins-2-hours" data-duration="30-mins-2-hours">
          <label for="duration-30-mins-2-hours">30 mins to 2 hours</label>
        </div>
        <div class="filter-item">
          <input type="checkbox" id="duration-2-hours-plus" data-duration="2-hours-plus">
          <label for="duration-2-hours-plus">2 hours+</label>
        </div>
      </div>
    </div>
  `;
  
  return sidebar;
}

function createHeader() {
  const header = document.createElement('div');
  header.className = 'catalog-header';
  
  header.innerHTML = `
    <h1 class="catalog-title">Repository of Courses, Certifications and Learning Paths</h1>
    <div class="catalog-search">
      <input type="text" class="search-input" placeholder="Search">
      <button class="filters-toggle">
        <span>Search</span>
      </button>
    </div>
  `;
  
  return header;
}

function filterCourses(courses, searchTerm) {
  if (!searchTerm) return courses;
  
  return courses.filter(course => {
    const metadata = course.attributes.localizedMetadata[0];
    const name = metadata.name.toLowerCase();
    const description = metadata.description?.toLowerCase() || '';
    const overview = metadata.overview?.toLowerCase() || '';
    const tags = course.attributes.tags?.join(' ').toLowerCase() || '';
    
    const searchLower = searchTerm.toLowerCase();
    
    return name.includes(searchLower) || 
           description.includes(searchLower) || 
           overview.includes(searchLower) ||
           tags.includes(searchLower);
  });
}

export default async function decorate(block) {
  // Clear the block
  block.innerHTML = '';
  
  // Show loading state
  block.innerHTML = '<div style="text-align: center; padding: 40px;">Loading courses...</div>';
  
  // Create header
  const header = createHeader();
  
  // Create main content container
  const contentContainer = document.createElement('div');
  contentContainer.className = 'catalog-content';
  
  // Create sidebar (now async)
  const sidebar = await createSidebar();
  contentContainer.appendChild(sidebar);
  
  // Create main content area
  const mainContent = document.createElement('div');
  mainContent.className = 'catalog-main';
  
  // Create course grid
  const courseGrid = document.createElement('div');
  courseGrid.className = 'catalog-grid';
  
  // Create load more container
  const loadMoreContainer = document.createElement('div');
  loadMoreContainer.className = 'load-more-container';
  
  // Store current data and pagination state
  let allCourses = [];
  let nextCursor = null;
  let hasMoreData = false;
  let isLoading = false;
  let currentFilters = {
    searchTerm: '',
    loTypes: ['course', 'learningProgram', 'certification', 'jobAid']
  };
  
  async function renderCourses(courses, append = false, includedData = []) {
    if (!append) {
      courseGrid.innerHTML = '';
    }
    
    // Apply client-side filtering
    const filteredCourses = filterCoursesByClientSide(courses);
    
    if (filteredCourses.length === 0 && !append) {
      courseGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">No courses found matching your criteria.</div>';
      return;
    }
    
    // STEP 1: Render cards immediately (synchronous - no API calls)
    filteredCourses.forEach(course => {
      const card = createCourseCard(course, includedData);
      courseGrid.appendChild(card);
    });
    
    // STEP 2: Load skills progressively in background (non-blocking)
    loadSkillsProgressively(filteredCourses).catch(error => {
      console.error('Error loading skills:', error);
    });
  }
  
  function showError(message) {
    courseGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #d32f2f;">${message}</div>`;
  }
  
  function updateLoadMoreButton() {
    loadMoreContainer.innerHTML = '';
    
    if (isLoading) {
      loadMoreContainer.innerHTML = '<div class="loading-text">Loading more courses...</div>';
    } else if (hasMoreData) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'load-more-btn';
      loadMoreBtn.textContent = 'Load More';
      loadMoreBtn.addEventListener('click', loadMoreCourses);
      loadMoreContainer.appendChild(loadMoreBtn);
    }
  }
  
  async function loadCourses(resetData = true) {
    try {
      isLoading = true;
      updateLoadMoreButton();
      
      const cursor = resetData ? null : nextCursor;
      const data = await fetchLearningObjects(9, currentFilters.searchTerm, {
        loTypes: getActiveTypeFilters(),
        skillNames: getActiveSkillFilters(),
        tagNames: getActiveTagFilters()
      }, cursor);
      
      const newCourses = data.data || [];
      
      if (resetData) {
        allCourses = newCourses;
        renderCourses(allCourses, false);
      } else {
        allCourses = [...allCourses, ...newCourses];
        renderCourses(newCourses, true);
      }
      
      // Extract cursor from next link if available
      nextCursor = null;
      hasMoreData = false;
      
      if (data.links && data.links.next) {
        const nextUrl = new URL(data.links.next);
        nextCursor = nextUrl.searchParams.get('page[cursor]');
        hasMoreData = true;
      }
      
      // Update course count if available
      if (data.meta && data.meta.count) {
      }
      
      isLoading = false;
      updateLoadMoreButton();
      
    } catch (error) {
      console.error('Failed to load courses:', error);
      isLoading = false;
      if (resetData) {
        showError('Failed to load courses. Please try again later.');
      }
      updateLoadMoreButton();
    }
  }
  
  async function loadMoreCourses() {
    if (!hasMoreData || isLoading) return;
    await loadCourses(false);
  }
  
  function getActiveTypeFilters() {
    const typeCheckboxes = sidebar.querySelectorAll('#courses, #learning-paths, #job-aids, #certifications');
    const activeTypes = [];
    
    typeCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        switch (checkbox.id) {
          case 'courses':
            activeTypes.push('course');
            break;
          case 'learning-paths':
            activeTypes.push('learningProgram');
            break;
          case 'job-aids':
            activeTypes.push('jobAid');
            break;
          case 'certifications':
            activeTypes.push('certification');
            break;
        }
      }
    });
    
    return activeTypes.length > 0 ? activeTypes : ['course', 'learningProgram', 'certification', 'jobAid'];
  }
  
  function getActiveFormatFilters() {
    const formatCheckboxes = sidebar.querySelectorAll('#format-filter-group input[type="checkbox"]:checked');
    const activeFormats = [];
    
    formatCheckboxes.forEach(checkbox => {
      activeFormats.push(checkbox.dataset.format);
    });
    
    return activeFormats;
  }
  
  function getActiveDurationFilters() {
    const durationCheckboxes = sidebar.querySelectorAll('#duration-filter-group input[type="checkbox"]:checked');
    const activeDurations = [];
    
    durationCheckboxes.forEach(checkbox => {
      activeDurations.push(checkbox.dataset.duration);
    });
    
    return activeDurations;
  }
  
  function getActiveTagFilters() {
    const tagCheckboxes = sidebar.querySelectorAll('#tags-filter-group input[type="checkbox"]:checked');
    const activeTags = [];
    
    tagCheckboxes.forEach(checkbox => {
      activeTags.push(checkbox.dataset.tag);
    });
    
    return activeTags;
  }
  
  function getActiveSkillFilters() {
    const skillCheckboxes = sidebar.querySelectorAll('#skills-filter-group input[type="checkbox"]:checked');
    const activeSkills = [];
    
    skillCheckboxes.forEach(checkbox => {
      activeSkills.push(checkbox.dataset.skill);
    });
    
    return activeSkills;
  }
  
  function getActiveCatalogFilters() {
    const catalogCheckboxes = sidebar.querySelectorAll('#catalogs-filter-group input[type="checkbox"]:checked');
    const activeCatalogs = [];
    
    catalogCheckboxes.forEach(checkbox => {
      activeCatalogs.push(checkbox.dataset.catalog);
    });
    
    return activeCatalogs;
  }
  
  function filterCoursesByClientSide(courses) {
    const activeFormats = getActiveFormatFilters();
    const activeDurations = getActiveDurationFilters();
    const activeTags = getActiveTagFilters();
    const activeSkills = getActiveSkillFilters();
    
    return courses.filter(course => {
      const attributes = course.attributes;
      
      // Format filter
      if (activeFormats.length > 0) {
        const courseFormat = attributes.loFormat || 'Self Paced';
        if (!activeFormats.includes(courseFormat)) {
          return false;
        }
      }
      
      // Duration filter
      if (activeDurations.length > 0) {
        const courseDuration = attributes.duration || 0;
        const durationInMinutes = courseDuration / 60;
        
        let matchesDuration = false;
        activeDurations.forEach(duration => {
          switch (duration) {
            case '30-mins':
              if (durationInMinutes <= 30) matchesDuration = true;
              break;
            case '30-mins-2-hours':
              if (durationInMinutes > 30 && durationInMinutes <= 120) matchesDuration = true;
              break;
            case '2-hours-plus':
              if (durationInMinutes > 120) matchesDuration = true;
              break;
          }
        });
        
        if (!matchesDuration) {
          return false;
        }
      }
      
      // Tags filter
      if (activeTags.length > 0) {
        const courseTags = attributes.tags || [];
        const hasMatchingTag = activeTags.some(tag => 
          courseTags.some(courseTag => courseTag.toLowerCase().includes(tag.toLowerCase()))
        );
        if (!hasMatchingTag) {
          return false;
        }
      }
      
      // Skills filter - check course skills against selected skills
      if (activeSkills.length > 0) {
        let hasMatchingSkill = false;
        
        // Check if course has skills in relationships
        if (course.relationships && course.relationships.skills && course.relationships.skills.data) {
          // Get skill names for this course (we'll need to check against cached skills)
          const courseSkillIds = course.relationships.skills.data.map(skillRef => {
            const skillIdMatch = skillRef.id.match(/_(\d+)$/);
            return skillIdMatch ? skillIdMatch[1] : null;
          }).filter(id => id !== null);
          
          // Check if any of the course's skills match the selected skills
          for (const skillId of courseSkillIds) {
            if (skillCache.has(skillId)) {
              const skillName = skillCache.get(skillId);
              if (activeSkills.some(selectedSkill => 
                skillName.toLowerCase().includes(selectedSkill.toLowerCase()) ||
                selectedSkill.toLowerCase().includes(skillName.toLowerCase())
              )) {
                hasMatchingSkill = true;
                break;
              }
            }
          }
        }
        
        // Also check if any selected skill matches the course tags or metadata
        if (!hasMatchingSkill) {
          const courseTags = attributes.tags || [];
          const metadata = attributes.localizedMetadata && attributes.localizedMetadata[0];
          const courseName = metadata ? metadata.name.toLowerCase() : '';
          const courseDescription = metadata ? (metadata.description || '').toLowerCase() : '';
          
          hasMatchingSkill = activeSkills.some(selectedSkill => {
            const skillLower = selectedSkill.toLowerCase();
            return courseTags.some(tag => tag.toLowerCase().includes(skillLower)) ||
                   courseName.includes(skillLower) ||
                   courseDescription.includes(skillLower);
          });
        }
        
        if (!hasMatchingSkill) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  // Initial load
  await loadCourses(true);
  
  // Clear loading and add content
  block.innerHTML = '';
  block.appendChild(header);
  
  mainContent.appendChild(courseGrid);
  mainContent.appendChild(loadMoreContainer);
  contentContainer.appendChild(mainContent);
  block.appendChild(contentContainer);
  
  // Add search functionality with debouncing
  let searchTimeout;
  const searchInput = header.querySelector('.search-input');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      currentFilters.searchTerm = e.target.value;
      
      // Use search API if there's a search term, otherwise use regular API
      if (currentFilters.searchTerm.trim()) {
        try {
          isLoading = true;
          updateLoadMoreButton();
          
          const data = await searchLearningObjects(currentFilters.searchTerm, 9);
          const newCourses = data.data || [];
          
          allCourses = newCourses;
          await renderCourses(allCourses, false, data.included || []);
          
          // Handle pagination for search results
          nextCursor = null;
          hasMoreData = false;
          if (data.links && data.links.next) {
            const nextUrl = new URL(data.links.next);
            nextCursor = nextUrl.searchParams.get('page[cursor]');
            hasMoreData = true;
          }
          
          isLoading = false;
          updateLoadMoreButton();
        } catch (error) {
          console.error('Search failed:', error);
          isLoading = false;
          showError('Search failed. Please try again.');
        }
      } else {
        await loadCourses(true); // Reset data for new search
      }
    }, 500); // 500ms debounce
  });
  
  // Add filter functionality
  const filterCheckboxes = sidebar.querySelectorAll('input[type="checkbox"]');
  filterCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
      
      // Server-side filters that require API reload
      if (['courses', 'learning-paths', 'job-aids', 'certifications'].includes(checkbox.id) ||
          checkbox.dataset.skill || checkbox.dataset.tag || checkbox.dataset.catalog) {
        await loadCourses(true); // Reset data for new filter
      } else {
        // Client-side filters (format, duration) - just re-render
        await renderCourses(allCourses, false);
      }
    });
  });
}
