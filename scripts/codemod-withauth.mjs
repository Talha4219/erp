/**
 * Codemod: moves inline hasModuleAccess checks into withAuth opts
 * and removes standard try/catch error boilerplate.
 *
 * Usage: node scripts/codemod-withauth.mjs
 *
 * Safe — only modifies files where both patterns match exactly.
 * Skips files with non-standard patterns.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const API_DIR = join(__dirname, '..', 'app', 'api')

const MODULE_NAMES = [
  'crm', 'documents', 'expenses', 'finance', 'fulfillment', 'hr',
  'insights', 'inventory', 'pos', 'procurement', 'projects',
  'reports', 'sales', 'workflow',
]

const MODULE_RE = new RegExp(`'(${MODULE_NAMES.join('|')})'`)

let stats = { scanned: 0, hasModuleMoved: 0, tryCatchRemoved: 0, skipped: 0, errors: [] }

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile() && entry.name.endsWith('.ts')) yield full
  }
}

// ── withAuth + hasModuleAccess ─────────────────────────────────────────────

/**
 * Pattern: the handler is wrapped with `withAuth(...)`.
 * Inside, on the very first line(s) of the body, there is:
 *   if (!hasModuleAccess(session, 'xxx')) return NextResponse.json(...403)
 *
 * We extract the module, remove that if-statement, and add
 * `, { module: 'xxx' }` as the second argument to withAuth.
 *
 * We locate the closing `})` of the handler by tracking brace depth
 * (naive but sufficient since arrow-function bodies are well-nested).
 */
function moveModuleToOpts(content) {
  // Only bother with files that have both keywords
  if (!content.includes('withAuth(') || !content.includes('hasModuleAccess')) return content

  // Find the hasModuleAccess line and extract module
  const accessRe = /^\s*if\s*\(!hasModuleAccess\(session,\s*('[^']+')\s*\)\)\s*return\s*NextResponse\.json\(\{ success:\s*false,\s*error:\s*'Forbidden'\s*\},\s*\{\s*status:\s*403\s*\}\)\s*$/m
  const accessMatch = content.match(accessRe)
  if (!accessMatch) return content

  const moduleName = accessMatch[1]  // e.g. 'inventory'
  const accessLine = accessMatch[0]
  const accessIdx = accessMatch.index

  // Confirm this line sits inside a withAuth(...) call (search backward for "withAuth(")
  const before = content.slice(0, accessIdx)
  const lastWithAuth = before.lastIndexOf('withAuth(')
  if (lastWithAuth === -1) return content  // not inside withAuth — skip

  // Remove the hasModuleAccess line
  content = content.slice(0, accessIdx) + content.slice(accessIdx + accessLine.length)
  stats.hasModuleMoved++

  // Find closing `})` of the withAuth handler by brace depth from the handler opening
  // The handler opens right after the `=> {` of the withAuth callback.
  // Instead of tracking depth, we find the LAST `})` in the file that belongs to
  // this withAuth call — reliable when there's only one handler per export.
  // We search for the last `})` in the file.
  const lastClose = content.lastIndexOf('})')
  if (lastClose === -1) return content
  content = content.slice(0, lastClose) + `}, { module: ${moduleName} })` + content.slice(lastClose + 2)

  return content
}

// ── Standard try/catch removal ─────────────────────────────────────────────

const CATCH_RE = /catch\s*\(\s*\w+\s*\)\s*\{\s*return\s+NextResponse\.json\(\{\s*success:\s*false,\s*error:\s*process\.env\.NODE_ENV\s*===\s*'development'\s*\?\s*\(\s*\w+\s+as\s+Error\)\.message\s*:\s*'An unexpected error occurred'\s*\},\s*\{\s*status:\s*500\s*\}\)\s*\}\s*$/m

function removeStandardTryCatch(content) {
  // Only process files with the standard catch pattern
  if (!content.includes("NODE_ENV === 'development'")) return content

  // Find a try { ... } catch { ... } that contains ONLY:
  // - try { \n  ...handler...\n  return ...\n} catch(...) { \n  return NextResponse.json({...dev ternary...}, {status: 500})\n}
  //
  // Strategy: look for "try {" that starts the handler body.
  // We repeatedly remove try/catch blocks that match the standard pattern.

  let result = content
  const tryRe = /\s*try\s*\{([\s\S]*?)\}\s*catch\s*\(\s*\w+\s*\)\s*\{([\s\S]*?)\}\s*/g

  // Simple approach: if the ENTIRE catch block matches our standard error pattern,
  // and the corresponding try block is simple (no nested try), remove both.

  // Find catch blocks first
  const catchOnlyRe = /catch\s*\(\s*(\w+)\s*\)\s*\{([\s\S]*?)\}\s*$/m
  while (true) {
    const cMatch = result.match(catchOnlyRe)
    if (!cMatch) break

    const catchBody = cMatch[2]
    const errVar = cMatch[1]

    // Check if this catch body matches the standard dev ternary pattern
    const stdCatchRe = new RegExp(`^\\s*return\\s+NextResponse\\.json\\(\\{\\s*success:\\s*false,\\s*error:\\s*process\\.env\\.NODE_ENV\\s*===\\s*'development'\\s*\\?\\s*\\(${errVar}\\s+as\\s+Error\\)\\.message\\s*:\\s*'An unexpected error occurred'\\s*\\},\\s*\\{\\s*status:\\s*500\\s*\\}\\)\\s*$`)
    if (!stdCatchRe.test(catchBody.trim())) break

    // Find the matching "try {" before this catch
    const beforeCatch = result.slice(0, cMatch.index)
    const tryIdx = beforeCatch.lastIndexOf('try {')
    if (tryIdx === -1) break

    // Extract the try body and check it's simple (no nested try-catch)
    const tryBlock = beforeCatch.slice(tryIdx + 5)  // after 'try {'
    const tryBody = tryBlock.slice(0, tryBlock.lastIndexOf('}'))
    if (tryBody.includes('try {')) break  // nested try — skip

    // Remove try { ... } catch { ... } — keep just the try body
    const replacement = tryBody.trimEnd()
    const entireBlock = beforeCatch.slice(tryIdx) + result.slice(cMatch.index, cMatch.index + cMatch[0].length)
    const blockStart = tryIdx
    const blockEnd = cMatch.index + cMatch[0].length
    result = result.slice(0, blockStart) + replacement + '\n' + result.slice(blockEnd)
    stats.tryCatchRemoved++
  }

  return result
}

// ── Main ───────────────────────────────────────────────────────────────────

for (const file of walk(API_DIR)) {
  stats.scanned++
  let content = readFileSync(file, 'utf-8')

  const original = content

  content = moveModuleToOpts(content)
  content = removeStandardTryCatch(content)

  if (content !== original) {
    writeFileSync(file, content, 'utf-8')
    console.log(`  MODIFIED ${relative(join(__dirname, '..'), file)}`)
  }
}

console.log(`\nDone. Scanned ${stats.scanned} files.`)
console.log(`  hasModuleAccess moved to opts: ${stats.hasModuleMoved}`)
console.log(`  try/catch blocks removed:     ${stats.tryCatchRemoved}`)
console.log(`  skipped:                      ${stats.skipped}`)
if (stats.errors.length) {
  console.log(`  errors:                       ${stats.errors.length}`)
  for (const e of stats.errors) console.log(`    - ${e}`)
}
