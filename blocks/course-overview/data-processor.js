// Data Processor for Course Overview
// Handles data extraction and processing from API responses

// Extract author names from API data
function extractAuthorNames(learnerData) {
  let authorNames = 'Unknown Author';
  
  if (learnerData && learnerData.data) {
    // First try to get from the simple authorNames array in attributes
    if (learnerData.data.attributes && learnerData.data.attributes.authorNames && learnerData.data.attributes.authorNames.length > 0) {
      authorNames = learnerData.data.attributes.authorNames.join(', ');
    } 
    // Fallback to authorDetails if authorNames is not available
    else if (learnerData.data.attributes && learnerData.data.attributes.authorDetails && learnerData.data.attributes.authorDetails.length > 0) {
      authorNames = learnerData.data.attributes.authorDetails.map(author => author.authorName).join(', ');
    }
    // Last fallback to relationships approach
    else if (learnerData.data.relationships && learnerData.data.relationships.authors) {
      const authors = learnerData.data.relationships.authors.data;
      const authorNamesList = authors.map(authorRef => {
        const authorData = learnerData.included.find(item => 
          item.type === 'user' && item.id === authorRef.id
        );
        return authorData ? authorData.attributes.name : null;
      }).filter(name => name !== null);
      
      if (authorNamesList.length > 0) {
        authorNames = authorNamesList.join(', ');
      }
    }
  }
  
  return authorNames;
}

// Extract skills from API data
function extractSkillsData(learnerData) {
  let skillsHtml = '';
  
  if (!learnerData || !learnerData.included) {
    return skillsHtml;
  }
  
  // Get all learningObjectSkill items from included array
  const learningObjectSkills = learnerData.included.filter(item => 
    item.type === 'learningObjectSkill'
  );
  
  
  learningObjectSkills.forEach(skillObj => {
    
    if (skillObj.relationships && skillObj.relationships.skillLevel && skillObj.relationships.skillLevel.data) {
      const skillLevelId = skillObj.relationships.skillLevel.data.id;
      
      const skillLevel = learnerData.included.find(item => 
        item.type === 'skillLevel' && item.id === skillLevelId
      );
      
      
      if (skillLevel && skillLevel.relationships && skillLevel.relationships.skill && skillLevel.relationships.skill.data) {
        const skillId = skillLevel.relationships.skill.data.id;
        
        const skill = learnerData.included.find(item => 
          item.type === 'skill' && item.id === skillId
        );
        
        
        if (skill && skillLevel && skillObj) {
          const skillName = skill.attributes.name;
          const skillLevelNum = skillLevel.attributes.level;
          const credits = skillObj.attributes.credits;
          
          skillsHtml += `${skillName} - Level ${skillLevelNum} (${credits} Credits)<br>`;
        }
      }
    }
  });
  
  return skillsHtml;
}

// Extract enrollment data
function extractEnrollmentData(learnerData) {
  const isEnrolled = learnerData && learnerData.data && 
                    learnerData.data.relationships && 
                    learnerData.data.relationships.enrollment;
  
  if (!isEnrolled) {
    return {
      isEnrolled: false,
      progressPercent: 0,
      enrollmentData: null,
      resourceGrades: [],
      moduleResources: [],
      completedModules: 0,
      currentRating: 0
    };
  }
  
  const enrollmentData = learnerData.included.find(item => 
    item.type === 'learningObjectInstanceEnrollment' && 
    item.id === learnerData.data.relationships.enrollment.data.id
  );
  
  const progressPercent = enrollmentData ? enrollmentData.attributes.progressPercent : 0;
  
  // Extract current rating from enrollment data
  const currentRating = enrollmentData && enrollmentData.attributes && enrollmentData.attributes.rating 
    ? enrollmentData.attributes.rating : 0;
  
  // Extract unenrollmentAllowed flag from learning object attributes (not enrollment)
  const unenrollmentAllowed = learnerData && learnerData.data && learnerData.data.attributes && learnerData.data.attributes.unenrollmentAllowed 
    ? learnerData.data.attributes.unenrollmentAllowed : false;
  
  
  // Get module completion data from resource grades
  const resourceGrades = learnerData.included.filter(item => 
    item.type === 'learningObjectResourceGrade'
  );
  
  // Get actual modules from API data
  const enrolledInstance = learnerData.included.find(item => 
    item.type === 'learningObjectInstance' && 
    item.relationships && 
    item.relationships.enrollment
  );
  
  const moduleResources = enrolledInstance ? 
    enrolledInstance.relationships.loResources.data : [];
  
  // Calculate completed modules
  const completedModules = resourceGrades.filter(grade => 
    grade.attributes.completed
  ).length;
  
  return {
    isEnrolled: true,
    progressPercent,
    enrollmentData,
    resourceGrades,
    moduleResources,
    completedModules,
    currentRating,
    unenrollmentAllowed
  };
}

// Process module data for enrolled users
function processModuleData(moduleResources, resourceGrades, learnerData, cdnModules) {
  return moduleResources.map((moduleRef, index) => {
    const moduleResource = learnerData.included.find(item => 
      item.type === 'learningObjectResource' && item.id === moduleRef.id
    );
    const resourceGrade = resourceGrades.find(grade => 
      grade.relationships.loResource.data.id === moduleRef.id
    );
    
    if (!moduleResource) return null;
    
    const moduleName = moduleResource.attributes.localizedMetadata[0].name;
    const isCompleted = resourceGrade ? resourceGrade.attributes.completed : false;
    const hasStarted = resourceGrade && resourceGrade.attributes.progressPercent > 0;
    const hasPassed = resourceGrade ? resourceGrade.attributes.hasPassed : false;
    
    // Get the loResourceType to determine if this is a testout module
    const loResourceType = moduleResource.attributes.loResourceType;
    
    // Get resource details for duration and type
    const resource = moduleResource.relationships.resources ? 
      learnerData.included.find(item => 
        item.type === 'resource' && 
        item.id === moduleResource.relationships.resources.data[0].id
      ) : null;
    
    const duration = resource ? 
      (resource.attributes.desiredDuration ? 
        `${Math.floor(resource.attributes.desiredDuration / 60)} mins` : 
        '0 mins') : 
      cdnModules[index]?.duration || 'N/A';
    
    const contentType = resource ? resource.attributes.contentType : 'Content';
    
    // Determine status based on completion and progress
    let statusText = '';
    let statusIcon = '';
    let statusClass = '';
    
    if (isCompleted) {
      statusText = 'Last Visited';
      statusIcon = '✓';
      statusClass = 'completed';
    } else if (hasStarted) {
      statusText = 'In Progress';
      statusIcon = '⏱️';
      statusClass = 'in-progress';
    } else {
      statusText = '';
      statusIcon = '';
      statusClass = '';
    }
    
    // Map content types to icons
    let moduleIcon = '📖';
    if (contentType === 'QUIZ') moduleIcon = '✓';
    else if (contentType === 'PDF') moduleIcon = '📄';
    else if (contentType === 'VIDEO') moduleIcon = '▶️';
    else if (contentType === 'Activity') moduleIcon = '🔧';
    
    // Use different icon for testout modules
    if (loResourceType === 'Test Out') {
      moduleIcon = '✖️'; // X icon for testout as shown in screenshot
    }
    
    return {
      id: moduleRef.id,
      name: moduleName,
      duration,
      contentType,
      loResourceType,
      statusText,
      statusIcon,
      statusClass,
      moduleIcon,
      isCompleted,
      hasStarted
    };
  }).filter(module => module !== null);
}

// Filter modules by type
function filterModulesByType(processedModules, type) {
  if (type === 'testout') {
    return processedModules.filter(module => module.loResourceType === 'Test Out');
  } else {
    // Regular modules (exclude Test Out)
    return processedModules.filter(module => module.loResourceType !== 'Test Out');
  }
}

// Process learning program data from API
function processLearningProgramData(learnerData) {
  if (!learnerData || !learnerData.data) {
    return null;
  }
  
  const lpData = learnerData.data;
  const isLP = lpData.attributes.loType === 'learningProgram';
  
  if (!isLP) {
    return null;
  }
  
  // Check if user is enrolled in the LP
  const lpEnrollment = lpData.relationships?.enrollment?.data;
  const isLPEnrolled = !!lpEnrollment;
  
  let lpEnrollmentInfo = null;
  if (isLPEnrolled && learnerData.included) {
    const enrollmentData = learnerData.included.find(item => 
      item.type === 'learningObjectInstanceEnrollment' && 
      item.id === lpEnrollment.id
    );
    
    if (enrollmentData) {
      lpEnrollmentInfo = {
        id: lpEnrollment.id,
        progressPercent: enrollmentData.attributes?.progressPercent || 0,
        isCompleted: enrollmentData.attributes?.progressPercent === 100,
        hasStarted: enrollmentData.attributes?.progressPercent > 0
      };
    }
  }
  
  // Extract subLOs (courses) from relationships
  const subLOs = lpData.relationships?.subLOs?.data || [];
  
  // Get sections to determine which courses are required
  const sections = lpData.attributes.sections || [];
  const requiredCourseIds = new Set();
  
  sections.forEach(section => {
    if (section.mandatory) {
      section.loIds?.forEach(courseId => requiredCourseIds.add(courseId));
    }
  });
  
  // Extract course details from included array
  const courses = subLOs.map(subLORef => {
    const courseData = learnerData.included?.find(item => 
      item.type === 'learningObject' && item.id === subLORef.id
    );
    
    if (!courseData) return null;
    
    const courseAttrs = courseData.attributes;
    const courseMeta = courseAttrs.localizedMetadata?.[0] || {};
    
    // Get enrollment data for this course if available
    const courseEnrollment = courseData.relationships?.enrollment?.data;
    let enrollmentInfo = null;
    
    if (courseEnrollment && learnerData.included) {
      const enrollmentData = learnerData.included.find(item => 
        item.type === 'learningObjectInstanceEnrollment' && 
        item.id === courseEnrollment.id
      );
      
      if (enrollmentData) {
        enrollmentInfo = {
          id: courseEnrollment.id,
          progressPercent: enrollmentData.attributes?.progressPercent || 0,
          isCompleted: enrollmentData.attributes?.progressPercent === 100,
          hasStarted: enrollmentData.attributes?.progressPercent > 0,
          dateCompleted: enrollmentData.attributes?.dateCompleted || null
        };
      }
    }
    
    // Get instances for this course
    const instances = courseData.relationships?.instances?.data || [];
    const instanceResources = [];
    
    instances.forEach(instanceRef => {
      const instance = learnerData.included?.find(item => 
        item.type === 'learningObjectInstance' && item.id === instanceRef.id
      );
      
      if (instance && instance.relationships?.loResources) {
        instance.relationships.loResources.data.forEach(resourceRef => {
          instanceResources.push(resourceRef);
        });
      }
    });
    
    // Determine if this course is required based on sections
    const isRequired = requiredCourseIds.has(courseData.id);
    
    return {
      id: courseData.id,
      name: courseMeta.name || 'Untitled Course',
      overview: courseMeta.overview || '',
      duration: courseAttrs.duration || 0,
      imageUrl: courseAttrs.imageUrl || '',
      state: courseAttrs.state || 'Published',
      loFormat: courseAttrs.loFormat || 'Self Paced',
      isRequired: isRequired,
      enrollment: enrollmentInfo,
      instanceResources: instanceResources,
      // Store the full course ID and first instance ID for navigation
      courseId: courseData.id.replace('course:', ''),
      instanceId: instances[0]?.id.replace('course:', '').replace('_', '-') || null
    };
  }).filter(course => course !== null);
  
  return {
    isLearningProgram: true,
    lpId: lpData.id,
    lpName: lpData.attributes.localizedMetadata?.[0]?.name || 'Learning Program',
    lpDescription: lpData.attributes.localizedMetadata?.[0]?.description || '',
    lpDuration: lpData.attributes.duration || 0,
    lpFormat: lpData.attributes.loFormat || 'Self Paced',
    isSubLoOrderEnforced: lpData.attributes.isSubLoOrderEnforced || false,
    isEnrolled: isLPEnrolled,
    enrollmentInfo: lpEnrollmentInfo,
    sections: sections,
    courses: courses
  };
}

// Process modules for a specific course within an LP
function processLPCourseModules(courseId, learnerData, resourceGrades) {
  // Handle null/undefined learnerData
  if (!learnerData || !learnerData.included) {
    return [];
  }
  
  const courseData = learnerData.included.find(item => 
    item.type === 'learningObject' && item.id === courseId
  );
  
  if (!courseData) {
    return [];
  }
  
  // Get instances for this course
  const instances = courseData.relationships?.instances?.data || [];
  let moduleResources = [];
  
  instances.forEach(instanceRef => {
    const instance = learnerData.included?.find(item => 
      item.type === 'learningObjectInstance' && item.id === instanceRef.id
    );
    
    if (instance && instance.relationships?.loResources) {
      moduleResources = instance.relationships.loResources.data;
    }
  });
  
  return moduleResources.map((moduleRef, index) => {
    const moduleResource = learnerData.included?.find(item => 
      item.type === 'learningObjectResource' && item.id === moduleRef.id
    );
    
    const resourceGrade = resourceGrades?.find(grade => 
      grade.relationships?.loResource?.data?.id === moduleRef.id
    );
    
    if (!moduleResource) return null;
    
    const moduleName = moduleResource.attributes.localizedMetadata?.[0]?.name || 'Module';
    const isCompleted = resourceGrade ? resourceGrade.attributes.completed : false;
    const hasStarted = resourceGrade && resourceGrade.attributes.progressPercent > 0;
    
    // Get resource details
    const resource = moduleResource.relationships?.resources ? 
      learnerData.included?.find(item => 
        item.type === 'resource' && 
        item.id === moduleResource.relationships.resources.data[0]?.id
      ) : null;
    
    const duration = resource ? 
      (resource.attributes.desiredDuration ? 
        `${Math.floor(resource.attributes.desiredDuration / 60)} mins` : 
        '0 mins') : 'N/A';
    
    const contentType = resource ? resource.attributes.contentType : 'Content';
    const loResourceType = moduleResource.attributes.loResourceType;
    
    // Determine status
    let statusText = '';
    let statusIcon = '';
    let statusClass = '';
    
    if (isCompleted) {
      statusText = 'Completed';
      statusIcon = '✓';
      statusClass = 'completed';
    } else if (hasStarted) {
      statusText = 'In Progress';
      statusIcon = '⏱️';
      statusClass = 'in-progress';
    }
    
    // Map content types to icons
    let moduleIcon = '📖';
    if (contentType === 'QUIZ') moduleIcon = '✓';
    else if (contentType === 'PDF') moduleIcon = '📄';
    else if (contentType === 'VIDEO') moduleIcon = '▶️';
    else if (contentType === 'Activity') moduleIcon = '🔧';
    
    if (loResourceType === 'Test Out') {
      moduleIcon = '✖️';
    }
    
    return {
      id: moduleRef.id,
      name: moduleName,
      duration,
      contentType,
      loResourceType,
      statusText,
      statusIcon,
      statusClass,
      moduleIcon,
      isCompleted,
      hasStarted
    };
  }).filter(module => module !== null);
}

// Export functions
export {
  extractAuthorNames,
  extractSkillsData,
  extractEnrollmentData,
  processModuleData,
  filterModulesByType,
  processLearningProgramData,
  processLPCourseModules
};
