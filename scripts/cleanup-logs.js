#!/usr/bin/env node
/**
 * Script to remove excessive console.log statements from blocks
 * Keeps console.error, console.warn for production error logging
 * Run this with: node scripts/cleanup-logs.js
 */

const fs = require('fs');
const path = require('path');

// Define files to clean (most verbose ones)
const files = [
  'blocks/recommendation/recommendation.js',
  'blocks/course-overview/course-overview.js',
  'blocks/course-overview/event-handlers.js',
  'blocks/course-overview/data-processor.js',
  'blocks/course-overview/ui-components.js',
  'blocks/course-overview/api-service.js',
  'blocks/profile/profile.js',
  'blocks/user-dropdown/user-dropdown.js',
  'blocks/mylearnings/mylearnings.js',
  'blocks/browse-catalog/browse-catalog.js',
  'blocks/course-info/course-info.js',
  'blocks/user-overview/user-overview.js',
];

console.log('Cleaning up console.log statements from blocks...\n');

let totalRemoved = 0;

files.forEach(filePath => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`  ✗ File not found: ${filePath}`);
      return;
    }

    // Read file content
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalLength = content.split('\n').length;
    
    // Remove console.log statements (but keep console.error, console.warn)
    // Pattern matches: console.log(...) including multi-line
    const lines = content.split('\n');
    const newLines = [];
    let removed = 0;
    let skipNext = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip if this is a continuation of a removed console.log
      if (skipNext) {
        if (!line.includes(');') && !line.includes('}')) {
          removed++;
          continue;
        } else {
          skipNext = false;
          removed++;
          continue;
        }
      }
      
      // Check if line contains console.log (but not console.error or console.warn)
      if (trimmed.startsWith('console.log(')) {
        // Check if it's a complete statement
        if (line.includes(');')) {
          removed++;
          continue;
        } else {
          // Multi-line console.log
          skipNext = true;
          removed++;
          continue;
        }
      }
      
      newLines.push(line);
    }
    
    if (removed > 0) {
      // Write back to file
      fs.writeFileSync(fullPath, newLines.join('\n'), 'utf8');
      console.log(`  ✓ Cleaned ${filePath} (removed ${removed} lines)`);
      totalRemoved += removed;
    } else {
      console.log(`  ○ No changes needed: ${filePath}`);
    }
    
  } catch (error) {
    console.log(`  ✗ Error processing ${filePath}:`, error.message);
  }
});

console.log(`\n✅ Cleanup complete! Removed ${totalRemoved} console.log statements.`);
console.log('Console.error and console.warn statements were preserved for production error logging.');
