import { differenceInDays } from 'date-fns';
import { prisma } from './prisma';

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
  });

  if (!action) return 0;

  let score = 0;

  // CEO boost (highest priority)
  if (action.isCeoRelated) {
    score += 1000;
  }

  // Standing action boost
  if (action.isStanding) {
    score += 500;
  }

  // Topic frequency scores
  const topicScore = action.topics.reduce((sum, at) => {
    return sum + at.topic.frequency;
  }, 0);
  score += topicScore;

  // Urgency boost (based on due date)
  if (action.dueDate) {
    const daysUntil = differenceInDays(action.dueDate, new Date());
    if (daysUntil <= 0) {
      score += 200; // Overdue
    } else if (daysUntil === 1) {
      score += 100; // Tomorrow
    } else if (daysUntil <= 3) {
      score += 50; // This week
    }
  }

  // Aging boost (encourages addressing old items)
  const daysOpen = differenceInDays(new Date(), action.createdAt);
  score += Math.min(daysOpen * 5, 100); // Cap at 100

  return score;
}

export async function calculateTopicFrequency(topicId: string): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 28);

  const mentions = await prisma.topicMention.findMany({
    where: {
      topicId,
      createdAt: { gte: cutoffDate },
    },
    include: {
      note: true,
    },
  });

  let frequency = 0;

  for (const mention of mentions) {
    let weight = mention.weight;

    // CEO boost
    if (mention.note.ceoMentioned) {
      weight *= 3;
    }

    // Ask/nudge boost
    if (mention.isAsk) {
      weight += 2;
    }
    if (mention.isNudge) {
      weight += 1;
    }

    // Recency decay (linear decay over 28 days)
    const daysAgo = differenceInDays(new Date(), mention.createdAt);
    const recencyMultiplier = 1 - (daysAgo / 28) * 0.5; // 50% decay

    frequency += weight * recencyMultiplier;
  }

  return frequency;
}

export async function recomputeAllScores(): Promise<void> {
  // Recompute topic frequencies
  const topics = await prisma.topic.findMany();
  
  for (const topic of topics) {
    const frequency = await calculateTopicFrequency(topic.id);
    await prisma.topic.update({
      where: { id: topic.id },
      data: { frequency },
    });
  }

  // Recompute action scores
  const actions = await prisma.action.findMany({
    where: {
      status: { in: ['ACTIVE', 'SUGGESTED'] },
    },
  });

  for (const action of actions) {
    const sortScore = await calculateActionScore(action.id);
    await prisma.action.update({
      where: { id: action.id },
      data: { sortScore },
    });
  }
}
