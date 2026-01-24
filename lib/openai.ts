import OpenAI from 'openai';
import { prisma } from './prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractionResult {
  ceoMentioned: boolean;
  ceoConfidence: 'HIGH' | 'MED' | 'LOW' | null;
  ceoEvidence: string | null;
  actions: {
    activity: string;
    suggestedPriority: 'P0' | 'P1' | 'P2';
    suggestedDueDate: string | null;
    evidence: string;
    topics: string[];
  }[];
  topics: {
    name: string;
    normKey: string;
    category: 'PERSON' | 'ACCOUNT' | 'TOPIC';
    isAsk: boolean;
    isNudge: boolean;
    weight: number;
  }[];
}

export async function extractFromNote(
  noteId: string,
  title: string,
  date: Date,
  content: string
): Promise<ExtractionResult> {
  // Get settings for context
  const settings = await prisma.settings.findFirst();
  
  const systemPrompt = `You are an AI assistant analyzing meeting notes and extracting actionable items.

${settings?.contextPrompt ? `CONTEXT:\n${settings.contextPrompt}\n\n` : ''}

CEO IDENTITY:
- Primary name: ${settings?.ceoFirstName || 'CEO'}
- Aliases: ${settings?.ceoAliases?.join(', ') || 'none'}
- Detect direct mentions ("${settings?.ceoFirstName} said...") and indirect references ("CEO wants...", "he asked...")

EXTRACTION RULES:
1. Actions must be SHORT imperative phrases only (e.g., "Send follow up to Cognizant")
2. Do NOT embed explanations in the activity string
3. Extract evidence excerpts (max 140 chars)
4. Detect topics and categorize as PERSON, ACCOUNT, or TOPIC
5. Identify if topics are asked (direct request) or nudged (implied importance)
6. If CEO is mentioned, default priority = P0
7. Infer realistic due dates from context:
   - "ASAP" → tomorrow
   - "this week" → end of week
   - Strategic but not urgent → 1-2 weeks
   - Ambiguous → null

Return JSON only, no markdown:
{
  "ceoMentioned": boolean,
  "ceoConfidence": "HIGH" | "MED" | "LOW" | null,
  "ceoEvidence": "short excerpt or null",
  "actions": [
    {
      "activity": "imperative phrase",
      "suggestedPriority": "P0" | "P1" | "P2",
      "suggestedDueDate": "YYYY-MM-DD" or null,
      "evidence": "excerpt max 140 chars",
      "topics": ["topic1", "topic2"]
    }
  ],
  "topics": [
    {
      "name": "NVIDIA",
      "normKey": "nvidia",
      "category": "ACCOUNT" | "PERSON" | "TOPIC",
      "isAsk": boolean,
      "isNudge": boolean,
      "weight": 1.0-3.0
    }
  ]
}`;

  const userPrompt = `Title: ${title}
Date: ${date.toISOString().split('T')[0]}
Content:
${content}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result as ExtractionResult;
  } catch (error) {
    console.error('OpenAI extraction error:', error);
    throw error;
  }
}

interface MacroGoalResult {
  macroGoals: {
    goal: string;
    topicMappings: string[];
  }[];
  standingActions: {
    activity: string;
    topicKey: string;
    cadence: 'WEEKLY' | 'BIWEEKLY';
    dueDate: string;
  }[];
}

export async function inferMacroGoals(): Promise<MacroGoalResult> {
  // Get aggregated stats from last 28 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 28);

  const notes = await prisma.note.findMany({
    where: {
      ceoMentioned: true,
      date: { gte: cutoffDate },
    },
    include: {
      topics: {
        include: {
          topic: true,
        },
      },
      actions: true,
    },
  });

  // Aggregate topic frequencies
  const topicStats: Record<string, { askCount: number; totalMentions: number; ceoMentions: number }> = {};
  
  for (const note of notes) {
    for (const mention of note.topics) {
      const key = mention.topic.normKey;
      if (!topicStats[key]) {
        topicStats[key] = { askCount: 0, totalMentions: 0, ceoMentions: 0 };
      }
      topicStats[key].totalMentions++;
      if (note.ceoMentioned) topicStats[key].ceoMentions++;
      if (mention.isAsk) topicStats[key].askCount++;
    }
  }

  const settings = await prisma.settings.findFirst();

  const systemPrompt = `You are analyzing a CEO's strategic focus areas across meeting notes from the last 28 days.

${settings?.contextPrompt ? `CONTEXT:\n${settings.contextPrompt}\n\n` : ''}

TASK:
1. Infer 3-7 macro goals that are OUTCOME-CENTRIC, not partner-centric
   - Good: "Accelerate strategic partner revenue"
   - Bad: "Work with NVIDIA"

2. Map each goal to relevant topic keys

3. Identify standing actions for topics asked 3+ times in 28 days with last ask within 14 days
   - These should be recurring updates to CEO
   - Default to WEEKLY cadence
   - Due date should be next Monday

Return JSON only:
{
  "macroGoals": [
    {
      "goal": "outcome-centric goal",
      "topicMappings": ["topic_key1", "topic_key2"]
    }
  ],
  "standingActions": [
    {
      "activity": "Send CEO update on [TOPIC]",
      "topicKey": "topic_key",
      "cadence": "WEEKLY",
      "dueDate": "YYYY-MM-DD"
    }
  ]
}`;

  const stats = {
    topicFrequencies: Object.entries(topicStats).map(([key, stats]) => ({
      topic: key,
      ...stats,
    })),
    noteCount: notes.length,
    ceoNoteCount: notes.filter(n => n.ceoMentioned).length,
    actionPatterns: notes.flatMap(n => n.actions.map(a => ({
      activity: a.activity,
      priority: a.priority,
      topics: [],
    }))),
  };

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(stats, null, 2) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result as MacroGoalResult;
  } catch (error) {
    console.error('OpenAI macro goal inference error:', error);
    throw error;
  }
}
