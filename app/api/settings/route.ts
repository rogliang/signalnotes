import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get or create settings
    let settings = await prisma.settings.findFirst()
    
    if (!settings) {
      settings = await prisma.settings.create({
        data: {}
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ceoFirstName, ceoAliases, contextPrompt } = body

    // Get or create settings
    let settings = await prisma.settings.findFirst()
    
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          ceoFirstName,
          ceoAliases,
          contextPrompt
        }
      })
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          ceoFirstName,
          ceoAliases,
          contextPrompt
        }
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Settings PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
