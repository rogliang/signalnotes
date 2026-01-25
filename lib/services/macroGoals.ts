import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export interface InferredGoal {
  goal: string
  topicKeys: string[]
}

export async function inferMacroGoals(
  contextPrompt?: string | null
): Promise<InferredGoal[]> {
  const twentyEightDaysAgo = subDays(new Date(), 28)

  // Get topic statistics from last 28 days
  const topics = await prisma.topic.findMany({
    where: {
      mentions: {
        some: {
          createdAt: {
            gte: twentyEightDaysAgo,
          },
        },
      },
    },
    include: {
      mentions: {
        where: {
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
      },
      actions: true, // Remove nested where - will filter manually
    },
    orderBy: {
      frequency: 'desc',
    },
    take: 20, // Top 20 topics
  })

  // Get action patterns
  const actions = await prisma.action.findMany({
    where: {
      createdAt: {
        gte: twentyEightDaysAgo,
      },
      status: {
        in: ['ACTIVE', 'DONE', 'SUGGESTED'],
      },
    },
    include: {
      topics: {
        include: {
          topic: true,
        },
      },
    },
  })

  // Prepare summary for GPT
  const topicSummary = topics.map((topic) => ({
    name: topic.name,
    normKey: topic.normKey,
    frequency: topic.frequency,
    ceoMentions: topic.mentions.filter((m) => m.note.ceoMentioned).length,
    totalMentions: topic.mentions.length,
    asks: topic.mentions.filter((m) => m.isAsk).length,
    actionCount: topic.actions.length,
  }))

  const actionPatterns = actions.map((action) => ({
    activity: action.activity,
    priority: action.priority,
    isCeoRelated: action.isCeoRelated,
    topics: action.topics.map((t) => t.topic.name),
  }))

  const systemPrompt = `You are analyzing a professional's work patterns to infer strategic macro goals.

${contextPrompt || ''}

Your job is to identify 3-7 OUTCOME-CENTRIC strategic goals based on topic frequency and action patterns.

RULES:
- Goals must be OUTCOME-focused, not partner/entity-focused
- Good: "Accelerate strategic partner revenue"
- Bad: "Work with NVIDIA"
- Focus on CEO priorities (high frequency, asks, CEO mentions)
- Map each goal to relevant topic keys (normalized names)
- Be specific but strategic (not tactical)

Return JSON only, no markdown.`

  const userPrompt = `Based on these patterns from the last 28 days, infer macro goals:

TOPIC STATISTICS:
${JSON.stringify(topicSummary, null, 2)}

ACTION PATTERNS:
${JSON.stringify(actionPatterns.slice(0, 30), null, 2)}

Return a JSON object:
{
  "goals": [
    {
      "goal": "outcome-centric strategic goal",
      "topicKeys": ["normalized-topic-key1", "normalized-topic-key2"]
    }
  ]
}`

  try {
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    const result = JSON.parse(content) as { goals: InferredGoal[] }
    return result.goals || []
  } catch (error) {
    console.error('Macro goal inference error:', error)
    return []
  }
}

export async function updateMacroGoals(): Promise<void> {
  const settings = await prisma.settings.findFirst()

  const inferredGoals = await inferMacroGoals(settings?.contextPrompt)

  // Delete old auto-generated goals (keep user-edited ones)
  await prisma.macroGoal.deleteMany({
    where: {
      editedByUser: false,
    },
  })

  // Create new goals
  for (const goal of inferredGoals) {
    await prisma.macroGoal.create({
      data: {
        goal: goal.goal,
        topicKeys: goal.topicKeys,
        editedByUser: false,
      },
    })
  }

  // Auto-assign actions to goals based on topic overlap
  await autoAssignActionsToGoals()
}

async function autoAssignActionsToGoals(): Promise<void> {
  const goals = await prisma.macroGoal.findMany()
  const actions = await prisma.action.findMany({
    where: {
      status: {
        in: ['ACTIVE', 'SUGGESTED'],
      },
      macroGoalId: null, // Only assign unassigned actions
    },
    include: {
      topics: {
        include: {
          topic: true,
        },
      },
    },
  })

  for (const action of actions) {
    const actionTopicKeys = action.topics.map((t) => t.topic.normKey)

    // Find goal with most topic overlap
    let bestGoal: (typeof goals)[0] | null = null
    let maxOverlap = 0

    for (const goal of goals) {
      const overlap = goal.topicKeys.filter((key) => actionTopicKeys.includes(key)).length

      if (overlap > maxOverlap) {
        maxOverlap = overlap
        bestGoal = goal
      }
    }

    // Assign if we found a match
    if (bestGoal && maxOverlap > 0) {
      await prisma.action.update({
        where: { id: action.id },
        data: {
          macroGoalId: bestGoal.id,
        },
      })
    }
  }
}
