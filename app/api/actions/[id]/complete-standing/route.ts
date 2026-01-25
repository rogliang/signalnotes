import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { handleStandingActionCompletion } from '@/lib/services/standingActions'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await handleStandingActionCompletion(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Standing action completion error:', error)
    return NextResponse.json(
      { error: 'Failed to complete standing action' },
      { status: 500 }
    )
  }
}
