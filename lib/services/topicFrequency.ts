import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'

export async function calculateTopicFrequency(topicId: string): Promise<number> {
  const twentyEightDaysAgo = subDays(new Date(), 28)

  // Get all mentions in the last 28 days
  const mentions = await prisma.topicMention.findMany({
    where: {
      topicId,
      createdAt: {
        gte: twentyEightDaysAgo,
      },
    },
    include: {
      note: {
        select: {
          ceoMentioned: true,
        },
      },
    },
  })

  let frequency = 0

  for (const mention of mentions) {
    let weight = mention.weight

    // CEO boost - 3x multiplier
    if (mention.note.ceoMentioned) {
      weight *= 3
    }

    // Ask boost
    if (mention.isAsk) {
      weight += 2
    }

    // Nudge boost
    if (mention.isNudge) {
      weight += 1
    }

    // Recency decay - linear 50% over 28 days
    const daysAgo = Math.floor(
      (Date.now() - mention.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    const recencyMultiplier = 1 - (daysAgo / 28) * 0.5

    frequency += weight * recencyMultiplier
  }

  return frequency
}

export async function updateAllTopicFrequencies(): Promise<void> {
  const topics = await prisma.topic.findMany()

  for (const topic of topics) {
    const frequency = await calculateTopicFrequency(topic.id)

    await prisma.topic.update({
      where: { id: topic.id },
      data: { frequency },
    })
  }
}
