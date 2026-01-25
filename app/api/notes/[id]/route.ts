import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

// GET single note
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const note = await prisma.note.findUnique({
      where: { id: params.id },
      include: {
        tags: true,
        actions: true,
      },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error('Note GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 })
  }
}

// PATCH update note
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
    const { title, date, subtitle, content } = body

    const note = await prisma.note.update({
      where: { id: params.id },
      data: {
        title,
        date: date ? new Date(date) : undefined,
        subtitle,
        content,
      },
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Note PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

// DELETE note
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.note.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Note DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
