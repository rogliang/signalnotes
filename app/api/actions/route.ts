import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

// GET all actions
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actions = await prisma.action.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'SUGGESTED'],
        },
      },
      include: {
        evidences: {
          include: {
            note: {
              select: {
                id: true,
                title: true,
                date: true,
              },
            },
          },
        },
        topics: {
          include: {
            topic: true,
          },
        },
        macroGoal: true,
      },
      orderBy: {
        sortScore: 'desc',
      },
    })

    return NextResponse.json(actions)
  } catch (error) {
    console.error('Actions GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch actions' }, { status: 500 })
  }
}

// POST create manual action
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { activity, priority, dueDate, noteId } = body

    const action = await prisma.action.create({
      data: {
        activity,
        priority: priority || 'P1',
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'ACTIVE',
        noteId: noteId || null,
      },
    })

    return NextResponse.json(action)
  } catch (error) {
    console.error('Action POST error:', error)
    return NextResponse.json({ error: 'Failed to create action' }, { status: 500 })
  }
}
