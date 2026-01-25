import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, createSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Check if any user exists (single user MVP)
    const existingUser = await prisma.user.findFirst()
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Create user
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash
      }
    })

    // Initialize settings
    await prisma.settings.create({
      data: {}
    })

    // Create session
    const session = createSession(user.id)
    const response = NextResponse.json({ success: true })
    
    response.cookies.set('session', session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Signup failed' },
      { status: 500 }
    )
  }
}
