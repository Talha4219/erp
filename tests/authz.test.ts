import { hasModuleAccess, canAssignRole } from '@/lib/authz'

function session(role: string, allowedModules: string[] | null = null) {
  return {
    user: { id: 'u1', email: 't@t.com', name: 'Test', role, allowedModules },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  } as any
}

describe('hasModuleAccess', () => {
  describe('SUPER_ADMIN', () => {
    const s = session('SUPER_ADMIN')

    it('has access to all modules', () => {
      expect(hasModuleAccess(s, 'sales')).toBe(true)
      expect(hasModuleAccess(s, 'finance')).toBe(true)
      expect(hasModuleAccess(s, 'hr')).toBe(true)
      expect(hasModuleAccess(s, 'nonexistent')).toBe(true)
    })
  })

  describe('ADMIN', () => {
    const s = session('ADMIN')

    it('has access to listed modules', () => {
      expect(hasModuleAccess(s, 'sales')).toBe(true)
      expect(hasModuleAccess(s, 'finance')).toBe(true)
      expect(hasModuleAccess(s, 'pos')).toBe(true)
    })

    it('does NOT have access to unlisted modules', () => {
      expect(hasModuleAccess(s, 'audit')).toBe(false)
    })
  })

  describe('VIEWER', () => {
    const s = session('VIEWER')

    it('has access to viewer modules', () => {
      expect(hasModuleAccess(s, 'dashboard')).toBe(true)
      expect(hasModuleAccess(s, 'reports')).toBe(true)
      expect(hasModuleAccess(s, 'workflow')).toBe(true)
    })

    it('does NOT have access to restricted modules', () => {
      expect(hasModuleAccess(s, 'sales')).toBe(false)
      expect(hasModuleAccess(s, 'finance')).toBe(false)
      expect(hasModuleAccess(s, 'pos')).toBe(false)
      expect(hasModuleAccess(s, 'hr')).toBe(false)
    })
  })

  describe('custom allowedModules', () => {
    it('allows only modules in allowedModules', () => {
      const s = session('OPERATOR', ['sales', 'pos'])
      expect(hasModuleAccess(s, 'sales')).toBe(true)
      expect(hasModuleAccess(s, 'pos')).toBe(true)
      expect(hasModuleAccess(s, 'finance')).toBe(false)
      expect(hasModuleAccess(s, 'hr')).toBe(false)
    })

    it('returns false for empty allowedModules', () => {
      const s = session('ADMIN', [])
      expect(hasModuleAccess(s, 'sales')).toBe(false)
      expect(hasModuleAccess(s, 'finance')).toBe(false)
    })

    it('ignores static ROLE_PERMISSIONS when allowedModules is set', () => {
      const s = session('VIEWER', ['sales'])
      expect(hasModuleAccess(s, 'sales')).toBe(true)
      expect(hasModuleAccess(s, 'dashboard')).toBe(false)
      expect(hasModuleAccess(s, 'reports')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('returns false for null role', () => {
      const s = session(null as any)
      expect(hasModuleAccess(s, 'sales')).toBe(false)
    })

    it('returns false for undefined role', () => {
      const s = session(undefined as any)
      expect(hasModuleAccess(s, 'sales')).toBe(false)
    })

    it('MANAGER has sales and finance access', () => {
      expect(hasModuleAccess(session('MANAGER'), 'sales')).toBe(true)
      expect(hasModuleAccess(session('MANAGER'), 'finance')).toBe(true)
      expect(hasModuleAccess(session('MANAGER'), 'pos')).toBe(true)
    })

    it('MANAGER has hr and procurement access', () => {
      expect(hasModuleAccess(session('MANAGER'), 'hr')).toBe(true)
      expect(hasModuleAccess(session('MANAGER'), 'procurement')).toBe(true)
    })

    it('OPERATOR has pos and inventory access', () => {
      expect(hasModuleAccess(session('OPERATOR'), 'pos')).toBe(true)
      expect(hasModuleAccess(session('OPERATOR'), 'inventory')).toBe(true)
    })

    it('OPERATOR has hr access', () => {
      expect(hasModuleAccess(session('OPERATOR'), 'hr')).toBe(true)
    })

    it('OPERATOR lacks finance access', () => {
      expect(hasModuleAccess(session('OPERATOR'), 'finance')).toBe(false)
    })
  })
})

describe('canAssignRole — edge cases', () => {
  it('ADMIN cannot assign MANAGER when allowedModules includes nothing', () => {
    expect(canAssignRole('ADMIN', 'SUPER_ADMIN')).toBe(false)
    expect(canAssignRole('ADMIN', 'ADMIN')).toBe(false)
    expect(canAssignRole('ADMIN', 'MANAGER')).toBe(true)
    expect(canAssignRole('ADMIN', 'VIEWER')).toBe(true)
    expect(canAssignRole('ADMIN', 'OPERATOR')).toBe(true)
  })

  it('MANAGER cannot assign any role', () => {
    expect(canAssignRole('MANAGER', 'VIEWER')).toBe(false)
    expect(canAssignRole('MANAGER', 'OPERATOR')).toBe(false)
    expect(canAssignRole('MANAGER', 'MANAGER')).toBe(false)
  })

  it('OPERATOR cannot assign any role', () => {
    expect(canAssignRole('OPERATOR', 'VIEWER')).toBe(false)
    expect(canAssignRole('OPERATOR', 'OPERATOR')).toBe(false)
  })

  it('VIEWER cannot assign any role', () => {
    expect(canAssignRole('VIEWER', 'VIEWER')).toBe(false)
  })

  it('SUPER_ADMIN can assign every role', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']) {
      expect(canAssignRole('SUPER_ADMIN', role as any)).toBe(true)
    }
  })
})

describe('canAssignRole', () => {
  it('SUPER_ADMIN can assign any role', () => {
    expect(canAssignRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true)
    expect(canAssignRole('SUPER_ADMIN', 'ADMIN')).toBe(true)
    expect(canAssignRole('SUPER_ADMIN', 'VIEWER')).toBe(true)
  })

  it('ADMIN cannot assign SUPER_ADMIN or ADMIN', () => {
    expect(canAssignRole('ADMIN', 'SUPER_ADMIN')).toBe(false)
    expect(canAssignRole('ADMIN', 'ADMIN')).toBe(false)
    expect(canAssignRole('ADMIN', 'MANAGER')).toBe(true)
    expect(canAssignRole('ADMIN', 'VIEWER')).toBe(true)
  })

  it('non-admin roles cannot assign any role', () => {
    expect(canAssignRole('MANAGER', 'VIEWER')).toBe(false)
    expect(canAssignRole('OPERATOR', 'VIEWER')).toBe(false)
    expect(canAssignRole('VIEWER', 'VIEWER')).toBe(false)
  })
})
