// Main Course Overview Module
// Orchestrates all components and handles the main decorate function

import { fetchLearnerCourseData, fetchCourseNotes } from './api-service.js';
import { getCourseIdFromUrl, extractDataFromCDN } from './ui-components.js';
import { addManagedListener, cleanupChildren, showLoading, showError } from '../../scripts/dom-utils.js';
import { 
  extractAuthorNames, 
  extractSkillsData, 
  extractEnrollmentData, 
  processModuleData,
  filterModulesByType,
  processLearningProgramData,
  processLPCourseModules
} from './data-processor.js';
import { createCourseOverviewHTML } from './html-generator.js';
import { setupEventListeners, setupTabEventListeners } from './event-handlers.js';

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

export default async function decorate(block) {
  try {
    // First check URL to determine if this is a Learning Program
    const urlCourseId = getCourseIdFromUrl();
    const isLPFromUrl = urlCourseId && urlCourseId.startsWith('learningProgram:');
    
    // Get ID from meta tag
    let courseId = document.querySelector('meta[name="course-id"]')?.content;
    
    if (courseId) {
      // If we have a meta tag ID, apply the correct prefix based on URL
      if (!courseId.startsWith('course:') && !courseId.startsWith('learningProgram:')) {
        if (isLPFromUrl) {
          courseId = `learningProgram:${courseId}`;
        } else {
          courseId = `course:${courseId}`;
        }
      }
    } else {
      // No meta tag, use URL-based ID
      courseId = urlCourseId;
    }
    
    if (!courseId) {
      console.error('No course/learning program ID found in meta tag or URL');
      return;
    }
    
    // Fetch learner-specific data
    const learnerData = await fetchLearnerCourseData(courseId);
    
    // Extract data from CDN HTML
    const cdnData = extractDataFromCDN(block);
    
    // Check if this is a learning program
    const isLearningProgram = learnerData?.data?.attributes?.loType === 'learningProgram' || cdnData.isLearningProgram;
    
    if (isLearningProgram) {
      // Handle Learning Program
      await handleLearningProgram(block, courseId, learnerData, cdnData);
    } else {
      // Handle Regular Course
      await handleRegularCourse(block, courseId, learnerData, cdnData);
    }
    
  } catch (error) {
    console.error('Error initializing course overview:', error);
    showError(block, 'Failed to load course overview. Please try again.', () => {
      decorate(block);
    });
  }
  
  // Return cleanup function
  return () => cleanupChildren(block);
}

// Handle regular course flow
async function handleRegularCourse(block, courseId, learnerData, cdnData) {
  // Process all data
  const authorNames = extractAuthorNames(learnerData);
  const skillsHtml = extractSkillsData(learnerData);
  const enrollmentInfo = extractEnrollmentData(learnerData);
  
  // Process modules for enrolled users
  let processedModules = [];
  let regularModules = [];
  let testoutModules = [];
  let hasNotes = false;
  
  if (enrollmentInfo.isEnrolled) {
    processedModules = processModuleData(
      enrollmentInfo.moduleResources, 
      enrollmentInfo.resourceGrades, 
      learnerData, 
      cdnData.modules
    );
    
    // Filter modules by type
    regularModules = filterModulesByType(processedModules, 'regular');
    testoutModules = filterModulesByType(processedModules, 'testout');
    
    // Check if notes are available
    try {
      let instanceId = null;
      
      if (learnerData?.data?.relationships?.loInstance) {
        instanceId = learnerData.data.relationships.loInstance.data.id;
      } else if (learnerData?.data?.relationships?.enrollment) {
        const enrollmentData = learnerData.data.relationships.enrollment.data;
        if (enrollmentData.relationships?.loInstance) {
          instanceId = enrollmentData.relationships.loInstance.data.id;
        }
      }
      
      // Last resort: extract instance ID from enrollment ID
      if (!instanceId && learnerData?.data?.relationships?.enrollment) {
        const enrollmentId = learnerData.data.relationships.enrollment.data.id;
        // Enrollment ID format: course:courseId_instanceId_userId
        // Extract the instance ID part
        const parts = enrollmentId.split('_');
        if (parts.length >= 2) {
          // parts[0] is course:courseId, parts[1] is instanceId
          instanceId = `${parts[0]}_${parts[1]}`;
        }
      }
      
      if (instanceId) {
        const notesData = await fetchCourseNotes(courseId, instanceId);
        hasNotes = notesData && notesData.data && notesData.data.length > 0;
      }
    } catch (error) {
      hasNotes = false;
    }
  }
  
  // Generate HTML
  const courseHTML = createCourseOverviewHTML(
    cdnData, 
    courseId, 
    learnerData, 
    authorNames, 
    skillsHtml, 
    enrollmentInfo, 
    regularModules,
    testoutModules,
    hasNotes,
    null
  );
  
  // Replace block content with new structure
  block.innerHTML = courseHTML;
  
  // Populate modules using createElement
  const modulesContainer = block.querySelector('[data-modules-container]');
  if (modulesContainer) {
    const containerType = modulesContainer.dataset.modulesContainer;
    
    if (containerType === 'enrolled' && processedModules) {
      processedModules.forEach(module => {
        const moduleElement = createModuleItem(module);
        modulesContainer.appendChild(moduleElement);
      });
    } else if (containerType === 'non-enrolled' && cdnData.modules) {
      cdnData.modules.forEach(module => {
        const moduleElement = createModuleItem(module);
        modulesContainer.appendChild(moduleElement);
      });
    }
  }
  
  // Setup all event listeners
  setupEventListeners(block, courseId, learnerData);
  
  // Setup tab event listeners (only for enrolled users with tabs)
  if (enrollmentInfo.isEnrolled) {
    setupTabEventListeners(block, courseId, cdnData.courseTitle, learnerData, {
      regular: regularModules,
      testout: testoutModules,
      all: processedModules
    });
  }
}

// Helper function to parse duration string to seconds
function parseDuration(durationStr) {
  if (!durationStr) return 0;
  
  // Handle formats like "47m", "1h 53m", "1h", "1h 41m"
  let totalSeconds = 0;
  
  const hourMatch = durationStr.match(/(\d+)h/);
  const minMatch = durationStr.match(/(\d+)m/);
  
  if (hourMatch) {
    totalSeconds += parseInt(hourMatch[1]) * 3600;
  }
  if (minMatch) {
    totalSeconds += parseInt(minMatch[1]) * 60;
  }
  
  return totalSeconds;
}

// Handle learning program flow
async function handleLearningProgram(block, lpId, learnerData, cdnData) {
  
  // Process LP data from API
  let lpData = processLearningProgramData(learnerData);
  
  // Extract enrollment info for LP
  const enrollmentInfo = {
    isEnrolled: lpData?.isEnrolled || false,
    progressPercent: lpData?.enrollmentInfo?.progressPercent || 0,
    currentRating: 0, // Will be set below from enrollment data
    unenrollmentAllowed: false // Can be updated based on LP attributes if needed
  };
  
  // Extract current rating from LP enrollment data
  if (lpData?.isEnrolled && learnerData?.included) {
    const lpEnrollmentId = lpData.enrollmentInfo?.id;
    if (lpEnrollmentId) {
      const enrollmentData = learnerData.included.find(item => 
        item.type === 'learningObjectInstanceEnrollment' && 
        item.id === lpEnrollmentId
      );
      
      if (enrollmentData && enrollmentData.attributes) {
        if (enrollmentData.attributes.rating) {
          enrollmentInfo.currentRating = enrollmentData.attributes.rating;
        }
        // Use LP enrollment progress if individual course enrollments aren't available
        if (enrollmentData.attributes.progressPercent !== undefined) {
          enrollmentInfo.progressPercent = enrollmentData.attributes.progressPercent;
        }
      }
    }
  }
  
  // Merge CDN course data with API data
  // CDN is the source of truth for which courses exist, API provides enrollment data
  if (cdnData.courses && cdnData.courses.length > 0) {
    
    // Start with CDN courses and merge in API enrollment data
    const mergedCourses = cdnData.courses.map((cdnCourse, index) => {
      
      // Find matching API course by ID
      const apiCourse = lpData?.courses?.find(apiC => {
        // Try to match by course ID extracted from CDN
        if (cdnCourse.courseId && apiC.id) {
          return apiC.id === `course:${cdnCourse.courseId}` || apiC.id === cdnCourse.id;
        }
        return false;
      });
      
      
      // Build merged course object starting with CDN data
      const mergedCourse = {
        id: cdnCourse.id || (cdnCourse.courseId ? `course:${cdnCourse.courseId}` : `course-${index + 1}`),
        name: cdnCourse.title,
        overview: cdnCourse.overview || '',
        duration: parseDuration(cdnCourse.duration),
        imageUrl: cdnCourse.imageUrl || '',
        metadata: cdnCourse.metadata || '',
        isRequired: cdnCourse.isRequired || false,
        courseId: cdnCourse.courseId || null,
        instanceId: cdnCourse.instanceId || null,
        modules: cdnCourse.modules || [],
        state: apiCourse?.state || 'Published',
        loFormat: apiCourse?.loFormat || 'Self Paced',
        // Merge API enrollment data if available
        enrollment: apiCourse?.enrollment || null,
        instanceResources: apiCourse?.instanceResources || []
      };
      
      return mergedCourse;
    });
    
    // Update lpData with merged courses
    if (lpData) {
      lpData.courses = mergedCourses;
    } else {
      // Fallback: use CDN data if no API data
      lpData = {
      isLearningProgram: true,
      lpId: lpId,
      lpName: cdnData.courseTitle,
      lpDescription: cdnData.courseDescription,
      lpDuration: parseDuration(cdnData.lpDuration),
      lpFormat: cdnData.courseFormat,
      isSubLoOrderEnforced: false,
      sections: [], // No section data from CDN fallback
      courses: cdnData.courses.map((course, index) => ({
        id: course.id || `course-${index + 1}`,
        name: course.title,
        overview: course.overview,
        duration: parseDuration(course.duration),
        // IMPORTANT: Include ALL CDN data
        modules: course.modules || [],
        imageUrl: course.imageUrl || '',
        metadata: course.metadata || '',
        isRequired: course.isRequired || false,  // CRITICAL: Copy isRequired flag
        courseId: course.courseId || null,  // CDN extracted course ID
        instanceId: course.instanceId || null,  // CDN extracted instance ID
        enrollment: null,
        instanceResources: []
      }))
      };
    }
    
  }
  
  
  // Process general data
  const authorNames = extractAuthorNames(learnerData);
  const skillsHtml = extractSkillsData(learnerData);
  
  // Generate HTML
  const lpHTML = createCourseOverviewHTML(
    cdnData, 
    lpId, 
    learnerData, 
    authorNames, 
    skillsHtml, 
    enrollmentInfo, 
    [],
    [],
    false,
    lpData
  );
  
  // Replace block content with new structure
  block.innerHTML = lpHTML;
  
  // Setup expand/collapse functionality for courses
  setupLPCourseExpansion(block, lpData, learnerData, enrollmentInfo.resourceGrades);
  
  // Setup event listeners
  setupEventListeners(block, lpId, learnerData);
}

// Setup expand/collapse functionality for LP courses
function setupLPCourseExpansion(block, lpData, learnerData, resourceGrades) {
  const courseCards = block.querySelectorAll('.lp-course-card');
  
  courseCards.forEach((courseCard, index) => {
    const expandBtn = courseCard.querySelector('.course-card-expand-btn');
    const courseId = courseCard.getAttribute('data-course-id');
    const modulesContainer = courseCard.querySelector(`[data-course-modules="${courseId}"]`);
    const courseHeader = courseCard.querySelector('.course-card-header');
    
    // Make course header clickable to navigate to course page
    if (courseHeader && courseId) {
      courseHeader.style.cursor = 'pointer';
      addManagedListener(courseHeader, 'click', (e) => {
        // Don't navigate if clicking the expand button
        if (e.target.closest('.course-card-expand-btn')) {
          return;
        }
        
        const course = lpData.courses[index];
        let trainingId, instanceId;
        
        // Use CDN extracted IDs if available
        if (course.courseId) {
          trainingId = course.courseId;
          instanceId = course.instanceId || course.courseId; // Fallback to courseId if no instanceId
        }
        // Otherwise use API data
        else if (course.id && course.id.startsWith('course:')) {
          trainingId = course.id.replace('course:', '');
          instanceId = trainingId; // Use same as trainingId if no instance
        }
        // Fallback to placeholder
        else {
          trainingId = courseId.replace('course:', '');
          instanceId = trainingId;
        }
        
        // Navigate to course overview page
        const courseUrl = `/overview/trainingId/${trainingId}/trainingInstanceId/${instanceId}`;
        window.location.href = courseUrl;
      });
    }
    
    if (expandBtn && modulesContainer) {
      addManagedListener(expandBtn, 'click', () => {
        const isExpanded = modulesContainer.style.display !== 'none';
        const expandIcon = expandBtn.querySelector('.expand-icon');
        
        if (isExpanded) {
          // Collapse
          modulesContainer.style.display = 'none';
          expandIcon.textContent = '▼';
        } else {
          // Expand
          modulesContainer.style.display = 'block';
          expandIcon.textContent = '▲';
          
          // Load modules if not already loaded
          if (modulesContainer.querySelector('.modules-loading')) {
            
            // Try to get modules from API first
            let modules = processLPCourseModules(courseId, learnerData, resourceGrades);
            
            // If no API modules and we have CDN modules, use those
            if (modules.length === 0 && lpData.courses[index]?.modules?.length > 0) {
              
              // Check if this course is completed to mark all modules as completed
              const courseCompleted = lpData.courses[index]?.enrollment?.isCompleted === true;
              
              modules = lpData.courses[index].modules.map((cdnModule, modIndex) => ({
                id: `module-${index}-${modIndex}`,
                name: cdnModule.title,
                title: cdnModule.title,
                duration: cdnModule.duration,
                format: cdnModule.format,
                icon: cdnModule.icon,
                moduleIcon: cdnModule.icon,
                // If course is completed, mark all modules as completed
                statusText: courseCompleted ? 'Completed' : '',
                statusIcon: courseCompleted ? '✓' : '',
                statusClass: courseCompleted ? 'completed' : '',
                isCompleted: courseCompleted
              }));
            }
            
            // Clear loading message
            modulesContainer.innerHTML = '';
            
            if (modules.length === 0) {
              modulesContainer.innerHTML = '<p class="no-modules">No modules available</p>';
            } else {
              const modulesList = document.createElement('div');
              modulesList.className = 'modules-list lp-course-modules';
              
              modules.forEach(module => {
                const moduleElement = createModuleItem(module);
                modulesList.appendChild(moduleElement);
              });
              
              modulesContainer.appendChild(modulesList);
            }
          }
        }
      });
    }
  });
}
