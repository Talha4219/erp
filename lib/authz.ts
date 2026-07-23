import type { Session } from 'next-auth'
import { hasPermission } from '@/lib/utils'
import type { Role } from '@/types/next-auth'

/**
 * Server-side module authorization for API routes.
 *
 * The Next.js middleware only gates *page* routes by module — `/api/*` requests
 * are NOT covered by it (their first path segment is "api"). Every API handler
 * that exposes module data must therefore check access itself. Call this right
 * after the existing `if (!session) …` guard so `session` is already non-null:
 *
 *   if (!session) return NextResponse.json({ success:false, error:'Unauthorized' }, { status:401 })
 *   if (!hasModuleAccess(session, 'finance'))
 *     return NextResponse.json({ success:false, error:'Forbidden' }, { status:403 })
 *
 * Custom-role users are checked against their assigned modules; everyone else
 * against the static ROLE_PERMISSIONS table.
 */
export function hasModuleAccess(session: Session, module: string): boolean {
  const { role, allowedModules } = session.user
  return allowedModules != null
    ? allowedModules.includes(module)
    : hasPermission(role, module)
}

/**
 * Which target role an actor is allowed to grant. Prevents privilege
 * escalation through the user create/update endpoints:
 *   - SUPER_ADMIN may grant any role.
 *   - ADMIN may grant anything except SUPER_ADMIN and ADMIN.
 *   - No one else may assign roles.
 */
export function canAssignRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === 'SUPER_ADMIN') return true
  if (actorRole === 'ADMIN') return !['SUPER_ADMIN', 'ADMIN'].includes(targetRole)
  return false
}
