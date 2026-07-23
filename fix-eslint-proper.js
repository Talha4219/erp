const fs = require('fs');
const path = require('path');

function fixApiRoutes() {
  const apiDir = path.join(__dirname, 'app/api');
  
  function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix 1: Remove unused hasModuleAccess import
    const hasModuleAccessImport = content.match(/^import\s+\{[^}]*\bhasModuleAccess\b[^}]*\}\s+from\s+['"]([^'"]+)['"]/m);
    if (hasModuleAccessImport) {
      const importLine = hasModuleAccessImport[0];
      const imports = importLine.match(/\{([^}]+)\}/)[1];
      const newImports = imports.split(',').map(i => i.trim()).filter(i => i !== 'hasModuleAccess').join(', ');
      if (newImports) {
        content = content.replace(importLine, `import { ${newImports} } from '${hasModuleAccessImport[1]}'`);
      } else {
        content = content.replace(importLine + '\n', '');
      }
      modified = true;
    }
    
    // Fix 2: Remove unused Params type import
    const paramsImport = content.match(/^import\s+\{[^}]*\bParams\b[^}]*\}\s+from\s+['"]([^'"]+)['"]/m);
    if (paramsImport) {
      const importLine = paramsImport[0];
      const imports = importLine.match(/\{([^}]+)\}/)[1];
      const newImports = imports.split(',').map(i => i.trim()).filter(i => i !== 'Params').join(', ');
      if (newImports) {
        content = content.replace(importLine, `import { ${newImports} } from '${paramsImport[1]}'`);
      } else {
        content = content.replace(importLine + '\n', '');
      }
      modified = true;
    }
    
    // Fix 3: Remove unused apiError, stripeBreaker, processPosReturn imports
    const unusedImports = ['apiError', 'stripeBreaker', 'processPosReturn'];
    for (const imp of unusedImports) {
      const regex = new RegExp(`^import\\s+\\{[^}]*\\b${imp}\\b[^}]*\\}\\s+from\\s+['"]([^'"]+)['"]`, 'm');
      const match = content.match(regex);
      if (match) {
        const importLine = match[0];
        const imports = importLine.match(/\{([^}]+)\}/)[1];
        const newImports = imports.split(',').map(i => i.trim()).filter(i => i !== imp).join(', ');
        if (newImports) {
          content = content.replace(importLine, `import { ${newImports} } from '${match[1]}'`);
        } else {
          content = content.replace(importLine + '\n', '');
        }
        modified = true;
      }
    }
    
    // Fix 4: Prefix unused req parameter with _
    // Match: async (req: NextRequest, { session, params }: any) => or async (req: NextRequest, ctx: any) =>
    content = content.replace(
      /(export const (?:GET|POST|PUT|PATCH|DELETE) = withAuth[^=]*= async\s*\(\s*)req(\s*:\s*NextRequest)/g,
      (match, prefix, type) => {
        // Check if req is used in the function body
        const fnStart = content.indexOf(match);
        const fnEnd = content.indexOf('})', fnStart);
        const fnBody = content.substring(fnStart, fnEnd);
        if (!fnBody.includes('req.') && !fnBody.includes(' req') && !fnBody.includes('(req') && !fnBody.includes('[req') && !fnBody.includes('{ req')) {
          modified = true;
          return prefix + '_req' + type;
        }
        return match;
      }
    );
    
    // Fix 5: Prefix unused session parameter with _
    content = content.replace(
      /(export const (?:GET|POST|PUT|PATCH|DELETE) = withAuth[^=]*= async\s*\([^)]*\{[^}]*session[^}]*\}[^)]*\))/g,
      (match) => {
        const fnStart = content.indexOf(match);
        const fnEnd = content.indexOf('})', fnStart);
        const fnBody = content.substring(fnStart, fnEnd);
        if (!fnBody.includes('session.') && !fnBody.includes(' session') && !fnBody.includes('(session') && !fnBody.includes('[session') && !fnBody.includes('{ session')) {
          modified = true;
          return match.replace(/\bsession\b/g, '_session');
        }
        return match;
      }
    );
    
    // Fix 6: Prefix unused catch error variables
    content = content.replace(/catch\s*\(\s*(e|err|error|e2)\s*\)\s*\{/g, 'catch (_$1) {');
    
    // Fix 7: Remove unused variable assignments (const X = ... where X is never used)
    // This is more complex, we'll handle specific patterns
    
    // Clean up empty import lines
    content = content.replace(/^import\s+\{\s*\}\s+from\s+['"][^'"]+['"];\s*$/gm, '');
    content = content.replace(/^import\s+\{\s*\}\s+from\s+['"][^'"]+['"]\s*$/gm, '');
    content = content.replace(/\n{3,}/g, '\n\n');
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
    }
  }
  
  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        processFile(fullPath);
      }
    }
  }
  
  walk(apiDir);
}

fixApiRoutes();