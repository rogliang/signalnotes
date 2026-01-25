import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

// GET all notes
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const notes = await prisma.note.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { subtitle: { contains: search, mode: 'insensitive' } },
              { content: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { date: 'desc' },
      include: {
        tags: true,
      },
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Notes GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

// POST create new note
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, date, subtitle, content } = body

    const note = await prisma.note.create({
      data: {
        title: title || 'Untitled',
        date: date ? new Date(date) : new Date(),
        subtitle,
        content: content || '',
      },
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Notes POST error:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
