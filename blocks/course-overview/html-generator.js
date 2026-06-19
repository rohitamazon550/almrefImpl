// HTML Generator for Course Overview
// Handles HTML template generation for different states

import { formatDuration } from './ui-components.js';

// Create a module item element using createElement
function createModuleItem(module) {
  const moduleItem = document.createElement('div');
  moduleItem.className = `module-item ${module.statusClass || ''}`;
  moduleItem.dataset.resourceId = module.id || module.resourceId;

  const moduleIcon = document.createElement('div');
  moduleIcon.className = 'module-icon';
  moduleIcon.textContent = module.moduleIcon || module.icon;

  const moduleContent = document.createElement('div');
  moduleContent.className = 'module-content';

  const moduleLeft = document.createElement('div');
  moduleLeft.className = 'module-left';

  const moduleHeader = document.createElement('div');
  moduleHeader.className = 'module-header';

  const moduleFormat = document.createElement('span');
  moduleFormat.className = 'module-format';
  moduleFormat.textContent = module.format || 'SELF PACED';

  moduleHeader.appendChild(moduleFormat);

  const moduleTitle = document.createElement('div');
  moduleTitle.className = 'module-title';

  const moduleName = document.createElement('h4');
  moduleName.className = 'module-name';
  moduleName.textContent = module.name || module.title;

  moduleTitle.appendChild(moduleName);
  moduleLeft.appendChild(moduleHeader);
  moduleLeft.appendChild(moduleTitle);

  const moduleMeta = document.createElement('div');
  moduleMeta.className = 'module-meta';

  const moduleDuration = document.createElement('span');
  moduleDuration.className = 'module-duration';
  moduleDuration.textContent = module.duration;

  moduleMeta.appendChild(moduleDuration);

  if (module.statusText) {
    const moduleStatus = document.createElement('span');
    moduleStatus.className = 'module-status';
    moduleStatus.innerHTML = `${module.statusIcon} ${module.statusText}`;
    moduleMeta.appendChild(moduleStatus);
  }

  moduleContent.appendChild(moduleLeft);
  moduleContent.appendChild(moduleMeta);

  moduleItem.appendChild(moduleIcon);
  moduleItem.appendChild(moduleContent);

  return moduleItem;
}

// Generate enrolled user HTML layout
function generateEnrolledHTML(data, courseId, learnerData, authorNames, skillsHtml, enrollmentInfo, processedModules, testoutModules = [], hasNotes = false) {
  const { progressPercent, completedModules, moduleResources } = enrollmentInfo;
  
  // Determine button text based on progress
  const hasProgress = progressPercent > 0;
  const buttonText = hasProgress ? 'Continue' : 'Start';
  
  // Determine which tabs to show
  const hasTestoutModules = testoutModules && testoutModules.length > 0;
  
  // Generate tabs HTML conditionally
  let tabsHTML = '';
  if (hasTestoutModules || hasNotes) {
    tabsHTML = `
      <!-- Tabs Section -->
      <div class="course-tabs">
        <button class="tab-button active">Module</button>
        ${hasTestoutModules ? '<button class="tab-button">Testout</button>' : ''}
        ${hasNotes ? '<button class="tab-button">Notes</button>' : ''}
      </div>
    `;
  }
  
  return `
    <!-- Course Header with Progress -->
    <div class="course-header enrolled-header">
      <div class="course-header-content">
        <h1 class="course-title">${data.courseTitle}</h1>
        <div class="course-format">${data.courseFormat}</div>
        <div class="progress-section">
          <span class="progress-label">Progress:</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <span class="progress-text">${progressPercent}%</span>
        </div>
      </div>
      <button class="share-btn">🔗 Share</button>
    </div>
    
    <!-- Course Description -->
    <div class="course-overview-section">
      <p class="course-description">${data.courseDescription}</p>
    </div>
    
    ${tabsHTML}
    
    <!-- Main Content -->
    <div class="course-main-content enrolled-layout">
      <!-- Left Content -->
      <div class="course-left-content">
        <div class="course-section modules-section">
          <h3 class="content-title">
            Core Content 
            <span class="duration-badge">${Math.floor(learnerData.data.attributes.duration / 60)} mins ${learnerData.data.attributes.duration % 60} secs</span>
          </h3>
          <div class="modules-list" data-modules-container="enrolled">
          </div>
          
          
        </div>
      </div>
      
      <!-- Learner Sidebar -->
      <div class="learner-sidebar enrolled-sidebar">
        <div class="sidebar-actions">
          <button class="start-btn">${buttonText}</button>
          <button class="save-btn">🔖 Save</button>
        </div>
        
        <!-- Rating Section -->
        <div class="sidebar-section">
          <div class="rating-section">
            <h4>Rate this Course</h4>
            <div class="star-rating">
              ${Array.from({length: 5}, (_, i) => {
                const starIndex = i + 1;
                const isSelected = starIndex <= enrollmentInfo.currentRating;
                return `<span class="star" data-rating="${starIndex}">${isSelected ? '⭐' : '☆'}</span>`;
              }).join('')}
              <button class="submit-rating">Submit</button>
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="instance-details">
            <h4>📋 Instance details</h4>
            <p>Default Instance</p>
            <a href="#" class="view-instances">View All Instances</a>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="progress-info">
            <h4>${completedModules}/${moduleResources.length} Core Content Completed</h4>
          </div>
        </div>
        
        <!-- Badges Section -->
        <div class="sidebar-section">
          <div class="badges-section">
            <h4>🏆 Badges</h4>
            <div class="badge-item">
              <img src="https://cpcontents.adobe.com/public/account/121816/accountassets/121816/badges/1f250de126e649e2b5dfb0434e0702b3/badge_hero.png" 
                   alt="Hero Badge" class="badge-icon">
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="skills-covered">
            <h4>✈️ Skills covered</h4>
            <div class="skills-list">
              <p>${skillsHtml || 'No skills specified'}</p>
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="author-info">
            <h4>Author(s)</h4>
            <div class="author-item">
              <div class="author-avatar">👤</div>
              <span class="author-name">${authorNames}</span>
            </div>
          </div>
        </div>
        
        <!-- Unenroll Button - Only show if enrolled and unenrollment is allowed -->
        ${enrollmentInfo.unenrollmentAllowed ? `
        <div class="sidebar-section">
          <button class="unenroll-btn" data-course-id="${courseId}">Unenroll from Course</button>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Generate non-enrolled user HTML layout
function generateNonEnrolledHTML(data, courseId, authorNames) {
  const enrollButtonText = 'Enroll';
  const saveButtonClass = 'save-btn disabled';
  const progressText = '0 enrollment(s)';
  
  return `
    <!-- Course Header -->
    <div class="course-header">
      <div class="course-header-content">
        <h1 class="course-title">${data.courseTitle}</h1>
        <div class="course-format">${data.courseFormat}</div>
      </div>
      <button class="share-btn">🔗 Share</button>
    </div>
    
    <!-- Course Description -->
    <div class="course-overview-section">
      <p class="course-description">${data.courseDescription}</p>
    </div>
    
    <!-- Main Content -->
    <div class="course-main-content">
      <!-- Left Content -->
      <div class="course-left-content">
        <div class="course-section modules-section">
          <h3 class="content-title">
            Core Content 
            <span class="duration-badge">41m</span>
          </h3>
          <div class="modules-list" data-modules-container="non-enrolled">
          </div>
        </div>
      </div>
      
      <!-- Learner Sidebar -->
      <div class="learner-sidebar">
        <div class="sidebar-actions">
          <button class="enroll-btn" data-course-id="${courseId}">${enrollButtonText}</button>
          <button class="${saveButtonClass}">🔖 Save</button>
        </div>
        
        <div class="sidebar-section">
          <div class="instance-details">
            <h4>📋 Instance details</h4>
            <p>Default Instance</p>
            <a href="#" class="view-instances">View All Instances</a>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="enrollment-info">
            <h4>👥 ${progressText}</h4>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="skills-covered">
            <h4>✈️ Skills covered</h4>
            <div class="skills-list">
              <p>Photoshop - Level 2 (3 Credits)<br>AEM - Level 1 (2 Credits)</p>
            </div>
          </div>
        </div>
        
        <div class="sidebar-section">
          <div class="author-info">
            <h4>Author(s)</h4>
            <div class="author-item">
              <div class="author-avatar">👤</div>
              <span class="author-name">${authorNames}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Generate Learning Program HTML layout
function generateLearningProgramHTML(data, lpData, lpId, learnerData, authorNames, skillsHtml, enrollmentInfo) {
  const { progressPercent } = enrollmentInfo;
  const lpDuration = formatDuration(lpData.lpDuration);
  
  // Determine button text based on progress
  const hasProgress = progressPercent > 0;
  const buttonText = hasProgress ? 'Continue' : 'Start';
  
  return `
    <!-- Learning Program Header with Progress -->
    <div class="course-header enrolled-header lp-header">
      <div class="course-header-content">
        <h1 class="course-title">${data.courseTitle}</h1>
        <div class="course-format">${data.courseFormat}</div>
        ${enrollmentInfo.isEnrolled ? `
        <div class="progress-section">
          <span class="progress-label">Progress:</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <span class="progress-text">${progressPercent}%</span>
        </div>
        ` : ''}
      </div>
      <button class="share-btn">🔗 Share</button>
    </div>
    
    <!-- Duration Display (No course description for LP) -->
    <div class="course-overview-section lp-duration-section">
      <p class="lp-duration-display">⏱️ Duration: ${lpDuration}</p>
    </div>
    
    <!-- Main Content -->
    <div class="course-main-content lp-layout">
      <!-- Left Content -->
      <div class="course-left-content">
        <!-- Course Cards -->
        ${lpData.courses.map((course, index) => {
          // Parse metadata if available (format: "Self Paced ● P Rahul, Neelansh ● 1h ● ★★★☆☆ 3")
          let courseAuthor = authorNames || 'Unknown Author';
          let courseDurationText = formatDuration(course.duration);
          let courseRating = null; // No default rating
          
          if (course.metadata) {
            const parts = course.metadata.split('●').map(p => p.trim());
            // parts[0] = format, parts[1] = author, parts[2] = duration, parts[3] = rating
            if (parts.length >= 2) {
              courseAuthor = parts[1]; // Author name
            }
            if (parts.length >= 3) {
              courseDurationText = parts[2]; // Duration
            }
            if (parts.length >= 4) {
              // Extract rating value from format like "★★★☆☆ 3"
              const ratingText = parts[3];
              const ratingMatch = ratingText.match(/(\d+)/); // Extract number
              if (ratingMatch) {
                const ratingValue = parseInt(ratingMatch[1]);
                courseRating = `⭐ ${ratingValue}/5`; // Format: ⭐ 3/5
              }
            }
          }
          
          // Determine if course is required
          // Priority 1: Check CDN data isRequired flag (from metadata)
          // Priority 2: Check API sections data
          let isRequired = false;
          
          if (course.isRequired !== undefined) {
            // Use CDN parsed value
            isRequired = course.isRequired;
          } else if (lpData.sections && lpData.sections.length > 0) {
            // Fallback to API sections data
            for (const section of lpData.sections) {
              if (section.loIds && section.loIds.includes(course.id)) {
                isRequired = section.mandatory === true;
                break;
              }
            }
          }
          
          // Required badge HTML - only show if course is required
          const requiredBadgeHtml = isRequired ? '<span class="course-required-badge">Required</span>' : '';
          
          // Completed badge HTML - show if course is completed
          const isCompleted = course.enrollment?.isCompleted === true;
          const completedBadgeHtml = isCompleted ? '<span class="course-completed-badge">✓ Completed</span>' : '';
          
          return `
          <div class="lp-course-card ${isCompleted ? 'completed' : ''}" data-course-id="${course.id}">
            <!-- Course Metadata Bar -->
            <div class="course-metadata-bar">
              <span class="course-type">Course</span>
              <span class="course-author">${courseAuthor}</span>
              <span class="course-duration-meta">Duration: ${courseDurationText}</span>
              ${requiredBadgeHtml}
              ${courseRating ? `<span class="course-rating">${courseRating}</span>` : ''}
              ${completedBadgeHtml}
            </div>
            
            <!-- Course Header -->
            <div class="course-card-header">
              <img src="${course.imageUrl || course.metadata || 'https://via.placeholder.com/120x80'}" alt="${course.name}" class="course-thumbnail" onerror="this.src='https://via.placeholder.com/120x80'">
              <div class="course-card-info">
                <h3 class="course-card-title">${course.name}</h3>
                <p class="course-card-description">${course.overview || 'No description available'}</p>
              </div>
              <button class="course-card-expand-btn" data-course-id="${course.id}">
                <span class="expand-icon">▼</span>
              </button>
            </div>
            
            <!-- Expandable Module Section -->
            <div class="course-card-modules" data-course-modules="${course.id}" style="display: none;">
              <div class="course-tabs">
                <button class="tab-button active">Curriculum</button>
                <button class="tab-button">Testout</button>
              </div>
              <div class="modules-loading">Loading modules...</div>
            </div>
          </div>
        `;
        }).join('')}
      </div>
      
      <!-- Learner Sidebar -->
      <div class="learner-sidebar lp-sidebar">
        ${enrollmentInfo.isEnrolled ? `
        <div class="sidebar-actions">
          <button class="start-btn">${buttonText}</button>
          <button class="save-btn">🔖 Save</button>
        </div>
        
        <!-- Rating Section -->
        <div class="sidebar-section">
          <div class="rating-section">
            <h4>Rate this Learning Path</h4>
            <div class="star-rating">
              ${Array.from({length: 5}, (_, i) => {
                const starIndex = i + 1;
                const isSelected = starIndex <= enrollmentInfo.currentRating;
                return `<span class="star" data-rating="${starIndex}">${isSelected ? '⭐' : '☆'}</span>`;
              }).join('')}
              <button class="submit-rating">Submit</button>
            </div>
          </div>
        </div>
        ` : `
        <div class="sidebar-actions">
          <button class="enroll-btn" data-course-id="${lpId}">Enroll</button>
          <button class="save-btn disabled">🔖 Save</button>
        </div>
        `}
        
        <div class="sidebar-section">
          <div class="progress-info">
            <h4>📋 Completion status</h4>
            <p>Complete</p>
            <p>${lpData.courses.filter(c => c.enrollment?.isCompleted).length} out of ${lpData.courses.length} Courses/Paths</p>
          </div>
        </div>
        
        ${skillsHtml ? `
        <div class="sidebar-section">
          <div class="skills-covered">
            <h4>✈️ Skills covered</h4>
            <div class="skills-list">
              <p>${skillsHtml}</p>
            </div>
          </div>
        </div>
        ` : ''}
        
        ${authorNames ? `
        <div class="sidebar-section">
          <div class="author-info">
            <h4>Author(s)</h4>
            <div class="author-item">
              <div class="author-avatar">👤</div>
              <span class="author-name">${authorNames}</span>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Main HTML generation function
function createCourseOverviewHTML(data, courseId, learnerData, authorNames, skillsHtml, enrollmentInfo, processedModules, testoutModules = [], hasNotes = false, lpData = null) {
  // Check if this is a learning program
  if (data.isLearningProgram && lpData) {
    return generateLearningProgramHTML(data, lpData, courseId, learnerData, authorNames, skillsHtml, enrollmentInfo);
  }
  
  // Regular course handling
  if (enrollmentInfo.isEnrolled) {
    return generateEnrolledHTML(data, courseId, learnerData, authorNames, skillsHtml, enrollmentInfo, processedModules, testoutModules, hasNotes);
  } else {
    return generateNonEnrolledHTML(data, courseId, authorNames);
  }
}

// Generate notes content HTML with module segregation
function generateNotesHTML(notesData, courseTitle, processedModules = []) {
  if (!notesData || !notesData.data || notesData.data.length === 0) {
    return `
      <div class="notes-content">
        <div class="notes-header">
          <h3 class="content-title">${courseTitle}</h3>
        </div>
        <div class="no-notes">
          <p>No notes available for this course.</p>
        </div>
      </div>
    `;
  }

  const notes = notesData.data;
  
  // Group notes by module (loResource)
  const notesByModule = {};
  
  notes.forEach(note => {
    // Get module/resource ID from relationships
    const resourceId = note.relationships?.loResource?.data?.id || 'unknown';
    
    if (!notesByModule[resourceId]) {
      notesByModule[resourceId] = [];
    }
    notesByModule[resourceId].push(note);
  });
  
  // Create a lookup map for module names
  const moduleNameMap = {};
  processedModules.forEach(module => {
    moduleNameMap[module.id] = module.name;
  });
  
  // Generate HTML for each module section
  const moduleNotesHTML = Object.entries(notesByModule).map(([resourceId, moduleNotes]) => {
    // Get the actual module name from the processed modules data
    const moduleName = moduleNameMap[resourceId] || `Module ${resourceId.split('_')[1] || resourceId}`;
    
    return `
      <div class="module-notes-section">
        <div class="module-notes-header">
          <h4 class="module-name">${moduleName}</h4>
        </div>
        <div class="module-notes-list">
          ${moduleNotes.map(note => `
            <div class="note-item">
              <div class="note-icon">💬</div>
              <div class="note-content">
                <div class="note-page">Page ${note.attributes.marker || 'N/A'}</div>
                <div class="note-text">${note.attributes.text || ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="notes-content">
      <div class="notes-header">
        <h3 class="content-title">${courseTitle}</h3>
      </div>
      <div class="notes-modules">
        ${moduleNotesHTML}
      </div>
    </div>
  `;
}

// Export functions
export {
  generateEnrolledHTML,
  generateNonEnrolledHTML,
  createCourseOverviewHTML,
  generateNotesHTML
};
