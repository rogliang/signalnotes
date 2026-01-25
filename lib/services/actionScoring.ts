import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'

export async function calculateActionScore(actionId: string): Promise<number> {
  const action = await prisma.action.findUnique({
    where: { id: actionId },
    include: {
      topics: {
        include: {
          topic: true,
        },
      },
    },
  })

  if (!action) return 0

  let score = 0

  // 1. CEO boost - 1000 points (highest priority)
  if (action.isCeoRelated) {
    score += 1000
  }

  // 2. Topic frequency scores
  const topicScores = action.topics.reduce((sum, actionTopic) => {
    return sum + actionTopic.topic.frequency
  }, 0)
  score += topicScores

  // 3. Urgency boost based on due date
  if (action.dueDate) {
    const daysUntil = differenceInDays(action.dueDate, new Date())

    if (daysUntil < 0) {
      score += 200 // Overdue
    } else if (daysUntil === 0) {
      score += 150 // Due today
    } else if (daysUntil === 1) {
      score += 100 // Due tomorrow
    } else if (daysUntil <= 3) {
      score += 50 // Due this week
    }
  }

  // 4. Aging boost - actions open longer get priority
  const daysOpen = differenceInDays(new Date(), action.createdAt)
  score += Math.min(daysOpen * 5, 100) // Cap at 100 points

  // 5. Standing action boost
  if (action.isStanding) {
    score += 500
  }

  return score
}

export async function recalculateAllActionScores(): Promise<void> {
  const actions = await prisma.action.findMany({
    where: {
      status: {
        in: ['ACTIVE', 'SUGGESTED'],
      },
    },
  })

  for (const action of actions) {
    const score = await calculateActionScore(action.id)

    await prisma.action.update({
      where: { id: action.id },
      data: { sortScore: score },
    })
  }
}
