import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Simple session cookie handling (MVP - no JWT)
export function createSession(userId: string): string {
  return Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64')
}

export function verifySession(session: string): { userId: string } | null {
  try {
    const data = JSON.parse(Buffer.from(session, 'base64').toString())
    // Basic validation - session expires after 7 days
    if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
      return null
    }
    return { userId: data.userId }
  } catch {
    return null
  }
}