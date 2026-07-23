import 'next-auth'

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER'

declare module 'next-auth' {
  interface User {
    id: string
    role: Role
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      role: Role
      /** Modules from the user's custom role. null = no custom role → use static ROLE_PERMISSIONS. */
      allowedModules: string[] | null
      /** Sub-modules per module from the user's custom role. null = all sub-modules allowed. */
      allowedSubmodules: Record<string, string[]> | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    allowedModules: string[] | null
    allowedSubmodules: Record<string, string[]> | null
  }
}
