import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

// PATCH update action
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { activity, priority, dueDate, status, macroGoalId, sortScore } = body

    const action = await prisma.action.update({
      where: { id: params.id },
      data: {
        activity,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
        macroGoalId,
        sortScore,
        completedAt: status === 'DONE' ? new Date() : null,
      },
    })

    return NextResponse.json(action)
  } catch (error) {
    console.error('Action PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update action' }, { status: 500 })
  }
}

// DELETE action
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.action.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Action DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete action' }, { status: 500 })
  }
}

// POST accept suggested action (move from SUGGESTED to ACTIVE)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const action = await prisma.action.update({
      where: { id: params.id },
      data: {
        status: 'ACTIVE',
      },
    })

    return NextResponse.json(action)
  } catch (error) {
    console.error('Action accept error:', error)
    return NextResponse.json({ error: 'Failed to accept action' }, { status: 500 })
  }
}
