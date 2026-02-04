import OpenAI from 'openai'

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export interface ExtractedAction {
  activity: string
  suggestedPriority: 'P0' | 'P1' | 'P2'
  suggestedDueDate?: string
  evidence: string
  topics: string[]
  isAsk: boolean
  isNudge: boolean
}

export interface ExtractedTopic {
  name: string
  normKey: string
  category: 'PERSON' | 'ACCOUNT' | 'TOPIC'
  isAsk: boolean
  isNudge: boolean
  weight: number
}

export interface CEODetection {
  mentioned: boolean
  confidence: 'HIGH' | 'MED' | 'LOW'
  evidence?: string
}

export interface ExtractionResult {
  actions: ExtractedAction[]
  topics: ExtractedTopic[]
  ceoDetection: CEODetection
}

export async function extractFromNote(
  noteContent: {
    title: string
    date: string
    subtitle?: string
    content: string
  },
  settings: {
    ceoFirstName?: string | null
    ceoAliases?: string[]
    contextPrompt?: string | null
  }
): Promise<ExtractionResult> {
  const systemPrompt = `You are an AI assistant that extracts actionable tasks, topics, and CEO signals from meeting notes.

${settings.contextPrompt || ''}

CEO IDENTITY:
- Primary name: ${settings.ceoFirstName || 'unknown'}
- Aliases: ${settings.ceoAliases?.join(', ') || 'none'}

Your job is to:
1. Extract ACTION ITEMS as natural, context-rich sentences
2. Include WHO (person/contact) and WHERE (company/account) in the activity description
3. Identify TOPICS (people, accounts, concepts) and normalize them
4. Detect if the CEO is mentioned directly or indirectly
5. Determine if topics are ASKED about or NUDGED

RULES FOR ACTIVITY DESCRIPTIONS:
- Write as fluid, natural sentences (not short imperative phrases)
- ALWAYS include context: who to contact, which company/account, about what topic
- Examples of GOOD activities:
  * "Send weekly partnership updates to John at NVIDIA regarding AI Circle integration"
  * "Follow up with Sarah from Snowflake about Q4 revenue projections"
  * "Schedule sync with Eric to review Prioritization Framework progress"
- Examples of BAD activities:
  * "Send updates" (missing: to whom? about what?)
  * "Follow up" (missing: with whom? which company?)
  * "Review document" (missing: which document? with whom?)
  
OTHER RULES:
- Extract evidence excerpts (max 140 chars)
- Normalize topics (e.g., "NVIDIA", "Nvidia", "NVDA" → "nvidia")
- Categorize topics as PERSON, ACCOUNT, or TOPIC
- If CEO is mentioned, default priority is P0
- Detect both explicit asks ("Eric asked about X") and nudges ("we should revisit Y")

Return JSON only, no markdown formatting.`

  const userPrompt = `Extract from this note:

Title: ${noteContent.title}
Date: ${noteContent.date}
${noteContent.subtitle ? `Subtitle: ${noteContent.subtitle}` : ''}

Content:
${stripHtml(noteContent.content)}

Return a JSON object with this structure:
{
  "actions": [
    {
      "activity": "Natural sentence with WHO (person), WHERE (company), and WHAT (topic)",
      "suggestedPriority": "P0" | "P1" | "P2",
      "suggestedDueDate": "YYYY-MM-DD or null",
      "evidence": "excerpt from note (max 140 chars)",
      "topics": ["topic1", "topic2"],
      "isAsk": boolean,
      "isNudge": boolean
    }
  ],
  "topics": [
    {
      "name": "Display Name",
      "normKey": "normalized-key",
      "category": "PERSON" | "ACCOUNT" | "TOPIC",
      "isAsk": boolean,
      "isNudge": boolean,
      "weight": 1.0-3.0
    }
  ],
  "ceoDetection": {
    "mentioned": boolean,
    "confidence": "HIGH" | "MED" | "LOW",
    "evidence": "excerpt if mentioned"
  }
}`

  try {
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    const result = JSON.parse(content) as ExtractionResult

    return result
  } catch (error) {
    console.error('OpenAI extraction error:', error)
    throw error
  }
}

function stripHtml(html: string): string {
  // Basic HTML stripping - convert to plain text
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}
