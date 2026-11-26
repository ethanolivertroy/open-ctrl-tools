// Helper function to find line numbers for YAML/JSON paths with hierarchical search
function findLineNumbersForPath(content, path) {
  // Handle null or undefined path
  if (!path || typeof path !== 'string') {
    return null;
  }
  
  const lines = content.split('\n');
  const pathParts = path.split('.');
  
  // Function to get indentation level
  const getIndentLevel = (line) => {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  };
  
  // Hierarchical search - find parent sections first, then child properties
  let searchStartIndex = 0;
  let parentIndentLevel = -1;
  
  for (let partIndex = 0; partIndex < pathParts.length; partIndex++) {
    const part = pathParts[partIndex];
    let found = false;
    
    // Search from the current position forward
    for (let i = searchStartIndex; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const currentIndentLevel = getIndentLevel(line);
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') continue;
      
      // If we're looking for a child property, ensure proper indentation
      if (partIndex > 0) {
        // Child property must be indented more than parent
        if (currentIndentLevel <= parentIndentLevel) {
          // We've exited the parent section, stop searching
          if (trimmedLine !== '' && !trimmedLine.startsWith('#')) {
            break;
          }
          continue;
        }
      }
      
      // Check if this line matches the part we're looking for
      const isMatch = trimmedLine === part + ':' || 
                     trimmedLine.startsWith(part + ':') ||
                     trimmedLine.includes('"' + part + '":');
      
      if (isMatch) {
        // If this is the last part, we found our target
        if (partIndex === pathParts.length - 1) {
          console.log(`Found ${path} at line ${i + 1}: ${line.trim()}`);
          return i + 1;
        }
        
        // Otherwise, prepare to search for the next part
        found = true;
        searchStartIndex = i + 1;
        parentIndentLevel = currentIndentLevel;
        break;
      }
    }
    
    if (!found) {
      console.log(`Could not find '${part}' in path '${path}'`);
      break;
    }
  }
  
  // Special case handling for specific patterns that might be formatted differently
  const specialCases = {
    'outboundTrafficPolicy.mode': /^\s*outboundTrafficPolicy:\s*$/,
    'meshMTLS.mode': /^\s*meshMTLS:\s*$/,
    'rbac.mode': /^\s*rbac:\s*$/,
    'ca.istiod.workloadCertTtl': /^\s*workloadCertTtl:/,
    'defaultConfig.privileged': /^\s*privileged:/,
    'defaultConfig.holdApplicationUntilProxyStarts': /^\s*holdApplicationUntilProxyStarts:/
  };
  
  // Try special case patterns if hierarchical search failed
  if (specialCases[path]) {
    const pattern = specialCases[path];
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        // For parent patterns, look for the next line with the child property
        if (path.includes('.mode')) {
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].trim().startsWith('mode:')) {
              console.log(`Found ${path} at line ${j + 1} (special case): ${lines[j].trim()}`);
              return j + 1;
            }
          }
        } else {
          console.log(`Found ${path} at line ${i + 1} (special case): ${lines[i].trim()}`);
          return i + 1;
        }
      }
    }
  }
  
  console.log(`Could not find line number for path: ${path}`);
  return null;
}

module.exports = { findLineNumbersForPath };
