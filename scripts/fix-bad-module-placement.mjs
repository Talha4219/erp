/**
 * Fix: module option was incorrectly added to NextResponse.json() calls
 * in files where the handler is a standalone function (not inline arrow).
 * 
 * Removes `, { module: 'xxx' }` from NextResponse.json and moves it to the withAuth() call.
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')

const files = [
  'app/api/fulfillment/courier/route.ts',
  'app/api/fulfillment/drivers/route.ts',
  'app/api/fulfillment/orders/route.ts',
  'app/api/fulfillment/returns/route.ts',
  'app/api/fulfillment/settings/route.ts',
  'app/api/fulfillment/vehicles/route.ts',
  'app/api/sales/invoices/route.ts',
  'app/api/sales/orders/route.ts',
  'app/api/workflow/definitions/route.ts',
]

function fixNextResponseModule(content) {
  // Remove `, { module: 'xxx' }` from NextResponse.json() calls
  const re = /(NextResponse\.json\(\{[^}]*\},\s*\{[^}]*\})\s*,\s*\{\s*module:\s*'([^']+)'\s*\}\))/g
  return content.replace(re, (match, before, moduleName) => {
    return before  // just the NextResponse.json(...) without the module arg
  })
}

function addModuleToWithAuth(content, moduleName) {
  // Find the first withAuth( that has only 1 argument (no opts)
  // and add { module: 'xxx' } as the second argument
  const re = /(withAuth\()(\w+)(\))/g
  return content.replace(re, (match, prefix, handlerName, suffix) => {
    return `${prefix}${handlerName}, { module: '${moduleName}' }${suffix}`
  })
}

// Extract module name from the bad NextResponse.json call
function findModuleNames(content) {
  const modules = new Set()
  const re = /\{ module: '([^']+)'\}/g
  let m
  while ((m = re.exec(content)) !== null) {
    modules.add(m[1])
  }
  return [...modules]
}

for (const f of files) {
  const fullPath = join(ROOT, f)
  let content = readFileSync(fullPath, 'utf-8')

  // Find module names from badly-placed opts
  const moduleNames = findModuleNames(content)
  if (moduleNames.length === 0) {
    console.log(`  SKIP ${f} — no module options found`)
    continue
  }

  // Remove bad module from NextResponse.json
  content = fixNextResponseModule(content)

  // Add module to the first withAuth call that has only 1 argument
  for (const mod of moduleNames) {
    content = addModuleToWithAuth(content, mod)
  }

  writeFileSync(fullPath, content, 'utf-8')
  console.log(`  FIXED ${f} (module: ${moduleNames.join(', ')})`)
}
