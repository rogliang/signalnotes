import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

// GET all macro goals
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const goals = await prisma.macroGoal.findMany({
      include: {
        actions: {
          where: {
            status: {
              in: ['ACTIVE', 'SUGGESTED'],
            },
          },
          orderBy: {
            sortScore: 'desc',
          },
          take: 3, // Top 3 actions per goal
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(goals)
  } catch (error) {
    console.error('Macro goals GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch macro goals' }, { status: 500 })
  }
}

// POST create manual macro goal
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { goal } = body

    const macroGoal = await prisma.macroGoal.create({
      data: {
        goal,
        topicKeys: [],
        editedByUser: true, // User-created goals won't be overwritten
      },
    })

    return NextResponse.json(macroGoal)
  } catch (error) {
    console.error('Macro goal POST error:', error)
    return NextResponse.json({ error: 'Failed to create macro goal' }, { status: 500 })
  }
}
