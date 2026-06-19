// Event Handlers for Course Overview
// Handles all user interactions and event listeners

import { getAccessToken } from './api-service.js';
import { enrollUser, unenrollUser, bookmarkCourse, rateCourse, fetchLearnerCourseData, fetchCourseNotes } from './api-service.js';
import { createFluidicPlayerModal } from './ui-components.js';
import { generateNotesHTML } from './html-generator.js';
import { addManagedListener } from '../../scripts/dom-utils.js';

// Handle enrollment/continue button click
async function handleEnrollmentAction(courseId) {
  try {
    const learnerData = await fetchLearnerCourseData(courseId);
    const isEnrolled = learnerData && learnerData.data && 
                      learnerData.data.relationships && 
                      learnerData.data.relationships.enrollment;
    
    if (!isEnrolled) {
      // Get the first instance ID from the course/LP data
      let instanceId = null;
      if (learnerData && learnerData.data && learnerData.data.relationships && learnerData.data.relationships.instances) {
        const instances = learnerData.data.relationships.instances.data;
        if (instances && instances.length > 0) {
          // Get the first (default) instance ID - this will be the full ID like:
          // "course:12495374_13216648" or "learningProgram:121645_174581"
          instanceId = instances[0].id;
        }
      }
      
      // If no instance found, enrollUser will construct a default one
      // Enroll the user
      const enrollResult = await enrollUser(courseId, instanceId);
      
      if (enrollResult) {
        // Refresh the page to update the UI
        window.location.reload();
      } else {
        alert('Failed to enroll in the course. Please try again.');
      }
    } else {
      // Launch the course player
      const accessToken = getAccessToken();
      const baseUrl = 'https://learningmanager.adobe.com';
      const playerUrl = `${baseUrl}/app/player?lo_id=${courseId}&access_token=${accessToken}`;
      
      createFluidicPlayerModal(playerUrl);
    }
  } catch (error) {
    console.error('Error handling enrollment action:', error);
    alert('An error occurred. Please try again.');
  }
}

// Handle save/bookmark button click
async function handleSaveAction(courseId) {
  
  const bookmarkResult = await bookmarkCourse(courseId);
  
  if (bookmarkResult) {
    alert('Course saved to your bookmarks!');
  } else {
    alert('Failed to save course to bookmarks. Please try again.');
  }
}

// Handle unenroll button click
async function handleUnenrollAction(enrollmentId) {
  const confirmUnenroll = confirm('Are you sure you want to unenroll from this course? Your progress will be lost.');
  if (!confirmUnenroll) {
    return;
  }
  
  const unenrollResult = await unenrollUser(enrollmentId);
  
  if (unenrollResult) {
    alert('Successfully unenrolled from the course!');
    // Refresh the page to update the UI
    window.location.reload();
  } else {
    alert('Failed to unenroll from the course. Please try again.');
  }
}

// Handle rating submission
async function handleRatingSubmission(enrollmentId, stars, ratingSection) {
  // Get selected rating from stars
  let selectedRating = 0;
  
  stars.forEach((star, index) => {
    if (star.textContent === '⭐') {
      selectedRating = index + 1;
    }
  });
  
  if (selectedRating === 0) {
    alert('Please select a rating before submitting.');
    return;
  }
  
  const ratingResult = await rateCourse(enrollmentId, selectedRating);
  
  if (ratingResult) {
    // Show temporary feedback message
    showTemporaryFeedback(ratingSection);
  } else {
    alert('Failed to submit rating. Please try again.');
  }
}

// Show temporary feedback message
function showTemporaryFeedback(ratingSection) {
  // Store original content
  const originalContent = ratingSection.innerHTML;
  
  // Show feedback message
  ratingSection.innerHTML = `
    <h4>Rate this Course</h4>
    <div class="feedback-message" style="
      color: #4f46e5;
      font-weight: 600;
      text-align: center;
      padding: 20px;
      font-size: 1.1rem;
    ">
      Thanks For Your Feedback!
    </div>
  `;
  
  // Restore original content after 3 seconds
  setTimeout(() => {
    ratingSection.innerHTML = originalContent;
    
    // Re-setup event listeners for the restored rating section
    const stars = ratingSection.querySelectorAll('.star-rating .star');
    const submitBtn = ratingSection.querySelector('.submit-rating');
    
    // Re-add star click handlers
    stars.forEach((star, index) => {
      star.addEventListener('click', (e) => {
        e.preventDefault();
        handleStarClick(stars, index);
      });
      star.style.cursor = 'pointer';
    });
    
    // Re-add submit handler
    if (submitBtn) {
      submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        // Get the enrollment ID from the parent context
        const unenrollBtn = submitBtn.closest('.enrolled-sidebar').querySelector('.unenroll-btn');
        if (unenrollBtn && unenrollBtn.dataset.enrollmentId) {
          const enrollmentId = unenrollBtn.dataset.enrollmentId;
          await handleRatingSubmission(enrollmentId, stars, ratingSection);
        }
      });
    }
  }, 3000);
}

// Handle star rating clicks
function handleStarClick(stars, clickedIndex) {
  // Update star display
  stars.forEach((star, index) => {
    if (index <= clickedIndex) {
      star.textContent = '⭐';
    } else {
      star.textContent = '☆';
    }
  });
}

// Handle module click
async function handleModuleClick(resourceId, courseId, learnerData) {
  
  const isEnrolled = learnerData && learnerData.data && 
                    learnerData.data.relationships && 
                    learnerData.data.relationships.enrollment;
  
  if (!isEnrolled) {
    alert('Please enroll in the course first to access modules.');
    return;
  }
  
  const accessToken = getAccessToken();
  const baseUrl = 'https://learningmanager.adobe.com';
  const playerUrl = `${baseUrl}/app/player?lo_id=${courseId}&access_token=${accessToken}`;
  
  createFluidicPlayerModal(playerUrl);
}

// Setup all event listeners
function setupEventListeners(block, courseId, learnerData) {
  // Add event listeners for the enrollment/continue button
  const enrollBtn = block.querySelector('.enroll-btn');
  if (enrollBtn) {
    addManagedListener(enrollBtn, 'click', async (e) => {
      e.preventDefault();
      await handleEnrollmentAction(courseId);
    });
  }
  
  // Add event listener for start button (for enrolled users)
  const startBtn = block.querySelector('.start-btn');
  if (startBtn) {
    addManagedListener(startBtn, 'click', async (e) => {
      e.preventDefault();
      const accessToken = getAccessToken();
      const baseUrl = 'https://learningmanager.adobe.com';
      const playerUrl = `${baseUrl}/app/player?lo_id=${courseId}&access_token=${accessToken}`;
      createFluidicPlayerModal(playerUrl);
    });
  }
  
  // Add event listener for save button
  const saveBtn = block.querySelector('.save-btn');
  if (saveBtn && !saveBtn.classList.contains('disabled')) {
    addManagedListener(saveBtn, 'click', async (e) => {
      e.preventDefault();
      await handleSaveAction(courseId);
    });
  }
  
  // Add event listener for unenroll button (only if enrolled)
  const unenrollBtn = block.querySelector('.unenroll-btn');
  if (unenrollBtn && learnerData && learnerData.data && learnerData.data.relationships && learnerData.data.relationships.enrollment) {
    // Use the enrollment ID as-is from the API (format: course:courseId_instanceId_userId)
    const enrollmentId = learnerData.data.relationships.enrollment.data.id;
    
    // Store the enrollment ID in the button for use in other handlers
    unenrollBtn.dataset.enrollmentId = enrollmentId;
    
    addManagedListener(unenrollBtn, 'click', async (e) => {
      e.preventDefault();
      await handleUnenrollAction(enrollmentId);
    });
  }

  // Add event listener for rating functionality (only if enrolled)
  const submitRatingBtn = block.querySelector('.submit-rating');
  if (submitRatingBtn && learnerData && learnerData.data && learnerData.data.relationships && learnerData.data.relationships.enrollment) {
    // Use the enrollment ID as-is from the API (format: course:courseId_instanceId_userId)
    const enrollmentId = learnerData.data.relationships.enrollment.data.id;
    const ratingSection = block.querySelector('.rating-section');
    
    addManagedListener(submitRatingBtn, 'click', async (e) => {
      e.preventDefault();
      const stars = block.querySelectorAll('.star-rating .star');
      await handleRatingSubmission(enrollmentId, stars, ratingSection);
    });
    
    // Add click handlers for stars
    const stars = block.querySelectorAll('.star-rating .star');
    stars.forEach((star, index) => {
      addManagedListener(star, 'click', (e) => {
        e.preventDefault();
        handleStarClick(stars, index);
      });
      
      star.style.cursor = 'pointer';
    });
  }

  // Add click handlers for modules
  const moduleItems = block.querySelectorAll('.module-item');
  moduleItems.forEach(moduleItem => {
    addManagedListener(moduleItem, 'click', async (e) => {
      e.preventDefault();
      
      const resourceId = moduleItem.dataset.resourceId;
      
      if (resourceId && courseId) {
        await handleModuleClick(resourceId, courseId, learnerData);
      }
    });
    
    moduleItem.style.cursor = 'pointer';
  });
}

// Handle tab switching
async function handleTabSwitch(tabButton, courseId, courseTitle, learnerData, moduleData = {}) {
  const tabText = tabButton.textContent.trim();
  const block = tabButton.closest('.course-overview');
  const leftContent = block.querySelector('.course-left-content');
  
  // Store original modules content if not already stored
  if (!block.dataset.originalModulesContent) {
    block.dataset.originalModulesContent = leftContent.innerHTML;
  }
  
  // Store testout modules content if not already stored
  if (!block.dataset.testoutModulesContent && moduleData.testout) {
    block.dataset.testoutModulesContent = generateTestoutModulesHTML(moduleData.testout, learnerData);
  }
  
  // Update active tab
  const allTabs = block.querySelectorAll('.tab-button');
  allTabs.forEach(tab => tab.classList.remove('active'));
  tabButton.classList.add('active');
  
  if (tabText === 'Testout') {
    // Show testout modules
    if (block.dataset.testoutModulesContent) {
      leftContent.innerHTML = block.dataset.testoutModulesContent;
      
      // Re-setup event listeners for the testout modules
      const moduleItems = leftContent.querySelectorAll('.module-item');
      moduleItems.forEach(moduleItem => {
        moduleItem.addEventListener('click', async (e) => {
          e.preventDefault();
          
          const resourceId = moduleItem.dataset.resourceId;
          
          if (resourceId && courseId) {
            await handleModuleClick(resourceId, courseId, learnerData);
          }
        });
        
        moduleItem.style.cursor = 'pointer';
      });
    } else {
      leftContent.innerHTML = `
        <div class="course-section modules-section">
          <h3 class="content-title">Testout Content</h3>
          <div class="no-testout-modules">
            <p>No testout modules available for this course.</p>
          </div>
        </div>
      `;
    }
  } else if (tabText === 'Notes') {
    // Show loading state
    leftContent.innerHTML = '<div class="loading">Loading notes...</div>';
    
    try {
      // Debug: Log the learner data structure
      
      // Extract instanceId from learnerData - try multiple possible paths
      let instanceId = null;
      
      // Try loInstance first
      if (learnerData && learnerData.data && learnerData.data.relationships && learnerData.data.relationships.loInstance) {
        const instanceData = learnerData.data.relationships.loInstance.data;
        instanceId = instanceData.id;
      }
      
      // Try loInstanceId as fallback
      if (!instanceId && learnerData && learnerData.data && learnerData.data.relationships && learnerData.data.relationships.loInstanceId) {
        const instanceData = learnerData.data.relationships.loInstanceId.data;
        instanceId = instanceData.id;
      }
      
      // Try instance as fallback
      if (!instanceId && learnerData && learnerData.data && learnerData.data.relationships && learnerData.data.relationships.instance) {
        const instanceData = learnerData.data.relationships.instance.data;
        instanceId = instanceData.id;
      }
      
      // Try extracting from enrollment data attributes
      if (!instanceId && learnerData && learnerData.data && learnerData.data.relationships && learnerData.data.relationships.enrollment) {
        const enrollmentData = learnerData.data.relationships.enrollment.data;
        // Check if enrollment has instance reference
        if (enrollmentData.relationships && enrollmentData.relationships.loInstance) {
          instanceId = enrollmentData.relationships.loInstance.data.id;
        }
      }
      
      // Last resort: extract instance ID from enrollment ID
      if (!instanceId && learnerData && learnerData.data && learnerData.data.relationships && learnerData.data.relationships.enrollment) {
        const enrollmentId = learnerData.data.relationships.enrollment.data.id;
        // Enrollment ID format: course:courseId_instanceId_userId
        // Extract the instance ID part
        const parts = enrollmentId.split('_');
        if (parts.length >= 2) {
          // parts[0] is course:courseId, parts[1] is instanceId
          instanceId = `${parts[0]}_${parts[1]}`;
        }
      }
      
      if (!instanceId) {
        console.error('Could not find instance ID in any expected location');
        throw new Error('Instance ID not found. Please ensure you are enrolled in the course.');
      }
      
      // Fetch notes data
      const notesData = await fetchCourseNotes(courseId, instanceId);
      
      // Generate and display notes HTML
      const notesHTML = generateNotesHTML(notesData, courseTitle, moduleData.all || []);
      leftContent.innerHTML = notesHTML;
      
    } catch (error) {
      console.error('Error loading notes:', error);
      leftContent.innerHTML = `
        <div class="notes-content">
          <div class="notes-header">
            <h3 class="content-title">${courseTitle}</h3>
            <button class="download-btn">📥 Download</button>
          </div>
          <div class="error-message">
            <p>Failed to load notes: ${error.message}</p>
          </div>
        </div>
      `;
    }
  } else if (tabText === 'Module') {
    // Restore original modules content
    if (block.dataset.originalModulesContent) {
      leftContent.innerHTML = block.dataset.originalModulesContent;
      
      // Re-setup event listeners for the restored modules
      const moduleItems = leftContent.querySelectorAll('.module-item');
      moduleItems.forEach(moduleItem => {
        moduleItem.addEventListener('click', async (e) => {
          e.preventDefault();
          
          const resourceId = moduleItem.dataset.resourceId;
          
          if (resourceId && courseId) {
            await handleModuleClick(resourceId, courseId, learnerData);
          }
        });
        
        moduleItem.style.cursor = 'pointer';
      });
    }
  }
}

// Generate testout modules HTML
function generateTestoutModulesHTML(testoutModules, learnerData) {
  if (!testoutModules || testoutModules.length === 0) {
    return `
      <div class="course-section modules-section">
        <h3 class="content-title">Testout Content</h3>
        <div class="no-testout-modules">
          <p>No testout modules available for this course.</p>
        </div>
      </div>
    `;
  }
  
  const totalDuration = testoutModules.reduce((total, module) => {
    const duration = parseInt(module.duration) || 0;
    return total + duration;
  }, 0);
  
  return `
    <div class="course-section modules-section">
      <h3 class="content-title">
        Testout Content 
        <span class="duration-badge">${totalDuration} mins</span>
      </h3>
      <div class="modules-list">
        ${testoutModules.map(module => `
          <div class="module-item ${module.statusClass}" data-resource-id="${module.id}">
            <div class="module-icon">${module.moduleIcon}</div>
            <div class="module-content">
              <div class="module-left">
                <div class="module-header">
                  <span class="module-format">SELF PACED</span>
                </div>
                <div class="module-title">
                  <h4 class="module-name">${module.name}</h4>
                </div>
              </div>
              <div class="module-meta">
                <span class="module-duration">${module.duration}</span>
                ${module.statusText ? `<span class="module-status">${module.statusIcon} ${module.statusText}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Setup tab event listeners
function setupTabEventListeners(block, courseId, courseTitle, learnerData, moduleData = {}) {
  const tabButtons = block.querySelectorAll('.tab-button');
  
  tabButtons.forEach(tabButton => {
    addManagedListener(tabButton, 'click', async (e) => {
      e.preventDefault();
      await handleTabSwitch(tabButton, courseId, courseTitle, learnerData, moduleData);
    });
  });
}

// Export functions
export {
  handleEnrollmentAction,
  handleSaveAction,
  handleUnenrollAction,
  handleRatingSubmission,
  handleStarClick,
  handleModuleClick,
  handleTabSwitch,
  setupTabEventListeners,
  setupEventListeners
};
