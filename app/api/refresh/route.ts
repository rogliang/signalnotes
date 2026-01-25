import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateAllTopicFrequencies } from '@/lib/services/topicFrequency'
import { recalculateAllActionScores } from '@/lib/services/actionScoring'
import { detectStandingActions } from '@/lib/services/standingActions'
import { updateMacroGoals } from '@/lib/services/macroGoals'

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting global refresh...')

    // 1. Update topic frequencies (28-day window)
    console.log('Calculating topic frequencies...')
    await updateAllTopicFrequencies()

    // 2. Detect standing actions (recurring CEO asks)
    console.log('Detecting standing actions...')
    await detectStandingActions()

    // 3. Infer macro goals
    console.log('Inferring macro goals...')
    await updateMacroGoals()

    // 4. Recalculate action scores
    console.log('Recalculating action scores...')
    await recalculateAllActionScores()

    // 5. Prune low-priority suggested actions (keep top 10)
    console.log('Pruning suggested actions...')
    await pruneLoSuggestedActions()

    console.log('Refresh complete!')

    return NextResponse.json({
      success: true,
      message: 'System refreshed successfully',
    })
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json(
      {
        error: 'Refresh failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

async function pruneLoSuggestedActions() {
  // Get all suggested actions sorted by score
  const suggestedActions = await prisma.action.findMany({
    where: {
      status: 'SUGGESTED',
    },
    orderBy: {
      sortScore: 'desc',
    },
  })

  // Keep top 10, dismiss the rest
  if (suggestedActions.length > 10) {
    const toDismiss = suggestedActions.slice(10)
    
    for (const action of toDismiss) {
      await prisma.action.delete({
        where: { id: action.id },
      })
    }
    
    console.log(`Pruned ${toDismiss.length} low-priority suggestions`)
  }
}
