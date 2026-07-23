export const TEST_USER = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@erp.test',
  role: 'ADMIN' as const,
}

export const TEST_SESSION = {
  user: TEST_USER,
  expires: new Date(Date.now() + 3600_000).toISOString(),
}

export const UNAUTH_SESSION = null
