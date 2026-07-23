const fs = require('fs');
const path = require('path');

function fixApiRoutes() {
  const apiDir = path.join(__dirname, 'app/api');
  
  function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Remove unused imports
    const unusedImports = [
      'hasModuleAccess',
      'Params',
      'apiError',
      'stripeBreaker',
      'processPosReturn',
    ];
    
    // Pattern: import { ..., hasModuleAccess, ... } from '...'
    for (const imp of unusedImports) {
      const importRegex = new RegExp(`\\{\\s*([^}]*\\b${imp}\\b[^}]*)\\}\\s*from\\s*['"]([^'"]+)['"]`);
      const match = content.match(importRegex);
      if (match) {
        // Remove the specific import
        const imports = match[1].split(',').map(i => i.trim()).filter(i => i !== imp && i !== '');
        if (imports.length > 0) {
          content = content.replace(match[0], `{ ${imports.join(', ')} } from '${match[2]}'`);
        } else {
          content = content.replace(match[0], '');
        }
        modified = true;
      }
    }
    
    // Remove import lines that are now empty
    content = content.replace(/^import\s+\{\s*\}\s+from\s+['"][^'"]+['"];\s*$/gm, '');
    content = content.replace(/^import\s+\{\s*\}\s+from\s+['"][^'"]+['"]\s*$/gm, '');
    
    // Fix unused req parameter in handler functions
    content = content.replace(/async\s*\(\s*req\s*:\s*NextRequest\s*,\s*(\{[^}]*\})\s*\)\s*=>/g, (match, destructure) => {
      const bodyStart = content.indexOf(match) + match.length;
      const bodyEnd = content.indexOf('})', bodyStart);
      const body = content.substring(bodyStart, bodyEnd);
      
      if (!body.includes('req.') && !body.includes(' req') && !body.includes('(req') && !body.includes('[req') && !body.includes('{ req')) {
        modified = true;
        return match.replace('req: NextRequest', '_req: NextRequest');
      }
      return match;
    });
    
    // Fix session parameter if unused
    content = content.replace(/async\s*\([^)]*\{[^}]*session[^}]*\}[^)]*\)\s*=>/g, (match) => {
      const bodyStart = content.indexOf(match) + match.length;
      const bodyEnd = content.indexOf('})', bodyStart);
      const body = content.substring(bodyStart, bodyEnd);
      
      if (!body.includes('session.') && !body.includes(' session') && !body.includes('(session') && !body.includes('[session') && !body.includes('{ session')) {
        modified = true;
        return match.replace(/\bsession\b/g, '_session');
      }
      return match;
    });
    
    // Fix req parameter in GET/POST/PATCH/DELETE handlers that don't use it
    const handlerRegex = /export const (GET|POST|PATCH|DELETE|PUT) = withAuth[^=]*=\s*async\s*\(\s*req\s*:\s*NextRequest\s*,\s*(\{[^}]*\})\s*\)/g;
    content = content.replace(handlerRegex, (match, method, destructure) => {
      const handlerStart = content.indexOf(match) + match.length;
      const handlerEnd = content.indexOf('})', handlerStart);
      const handlerBody = content.substring(handlerStart, handlerEnd);
      
      if (!handlerBody.includes('req.') && !handlerBody.includes(' req') && !handlerBody.includes('(req') && !handlerBody.includes('[req') && !handlerBody.includes('{ req')) {
        modified = true;
        return match.replace('req: NextRequest', '_req: NextRequest');
      }
      return match;
    });
    
    // DON'T modify catch blocks - the error variables are typically used for error handling
    // Just remove trailing empty lines
    content = content.replace(/\n{3,}/g, '\n\n');
    
    if (modified || content !== fs.readFileSync(filePath, 'utf8')) {
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