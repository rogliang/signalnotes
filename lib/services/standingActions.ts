import { prisma } from '@/lib/prisma'
import { subDays, addDays, startOfDay } from 'date-fns'

export async function detectStandingActions(): Promise<void> {
  const twentyEightDaysAgo = subDays(new Date(), 28)
  const fourteenDaysAgo = subDays(new Date(), 14)

  // Get all topics mentioned in CEO notes
  const topicMentions = await prisma.topicMention.findMany({
    where: {
      createdAt: {
        gte: twentyEightDaysAgo,
      },
      note: {
        ceoMentioned: true,
      },
      OR: [{ isAsk: true }, { isNudge: true }],
    },
    include: {
      topic: true,
    },
  })

  // Group by topic and count asks
  const topicAskCounts = new Map<string, { topic: any; askCount: number; lastAsk: Date }>()

  for (const mention of topicMentions) {
    const existing = topicAskCounts.get(mention.topicId)
    if (existing) {
      existing.askCount++
      if (mention.createdAt > existing.lastAsk) {
        existing.lastAsk = mention.createdAt
      }
    } else {
      topicAskCounts.set(mention.topicId, {
        topic: mention.topic,
        askCount: 1,
        lastAsk: mention.createdAt,
      })
    }
  }

  // Create standing actions for topics asked >= 3 times with recent ask
  for (const [topicId, data] of topicAskCounts) {
    if (data.askCount >= 3 && data.lastAsk >= fourteenDaysAgo) {
      // Check if standing action already exists (including completed ones)
      const existingStanding = await prisma.action.findFirst({
        where: {
          isStanding: true,
          topics: {
            some: {
              topicId: topicId,
            },
          },
          // Don't recreate if one exists in any status (active, suggested, or done)
        },
      })

      if (!existingStanding) {
        // Create new standing action
        const action = await prisma.action.create({
          data: {
            activity: `Send CEO update on ${data.topic.name}`,
            priority: 'P0',
            isCeoRelated: true,
            isStanding: true,
            standingCadence: 'WEEKLY',
            dueDate: getNextMonday(),
            status: 'ACTIVE',
          },
        })

        // Link to topic
        await prisma.actionTopic.create({
          data: {
            actionId: action.id,
            topicId: topicId,
          },
        })
      }
    }
  }
}

function getNextMonday(): Date {
  const today = startOfDay(new Date())
  const dayOfWeek = today.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  return addDays(today, daysUntilMonday)
}

export async function handleStandingActionCompletion(actionId: string): Promise<void> {
  const action = await prisma.action.findUnique({
    where: { id: actionId },
  })

  if (!action || !action.isStanding) return

  // Add to completion history
  const completionHistory = [...(action.completionHistory || []), new Date().toISOString()]

  // Mark as DONE (don't roll forward - user wants it to disappear)
  await prisma.action.update({
    where: { id: actionId },
    data: {
      status: 'DONE',
      completedAt: new Date(),
      lastCompletedAt: new Date(),
      completionHistory,
    },
  })
}