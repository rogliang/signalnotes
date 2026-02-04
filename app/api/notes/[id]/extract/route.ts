import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { extractFromNote } from '@/lib/services/extraction'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie || !verifySession(sessionCookie.value)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the note
    const note = await prisma.note.findUnique({
      where: { id: params.id },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Get settings for CEO context
    const settings = await prisma.settings.findFirst()

    // Extract using OpenAI
    const extraction = await extractFromNote(
      {
        title: note.title,
        date: note.date.toISOString(),
        subtitle: note.subtitle || undefined,
        content: note.content,
      },
      {
        ceoFirstName: settings?.ceoFirstName,
        ceoAliases: settings?.ceoAliases || [],
        contextPrompt: settings?.contextPrompt,
      }
    )

    // Update note with CEO detection
    await prisma.note.update({
      where: { id: note.id },
      data: {
        ceoMentioned: extraction.ceoDetection.mentioned,
        ceoConfidence: extraction.ceoDetection.confidence,
        ceoEvidence: extraction.ceoDetection.evidence,
      },
    })

    // Process topics
    const topicMap = new Map<string, string>() // normKey -> topicId

    for (const extractedTopic of extraction.topics) {
      // Find or create topic
      let topic = await prisma.topic.findUnique({
        where: { normKey: extractedTopic.normKey },
      })

      if (!topic) {
        topic = await prisma.topic.create({
          data: {
            name: extractedTopic.name,
            normKey: extractedTopic.normKey,
            category: extractedTopic.category,
            lastMentioned: new Date(),
          },
        })
      } else {
        // Update last mentioned
        await prisma.topic.update({
          where: { id: topic.id },
          data: { lastMentioned: new Date() },
        })
      }

      topicMap.set(extractedTopic.normKey, topic.id)

      // Create topic mention
      await prisma.topicMention.create({
        data: {
          topicId: topic.id,
          noteId: note.id,
          isAsk: extractedTopic.isAsk,
          isNudge: extractedTopic.isNudge,
          weight: extractedTopic.weight,
        },
      })
    }

    // Process actions
    const createdActions = []

    for (const extractedAction of extraction.actions) {
      // Check if similar action already exists (including completed ones)
      const existingAction = await prisma.action.findFirst({
        where: {
          noteId: note.id,
          activity: extractedAction.activity,
        },
      })

      // Skip if action already exists in any status
      if (existingAction) {
        console.log(`Skipping duplicate action: ${extractedAction.activity}`)
        continue
      }

      // Create action
      const action = await prisma.action.create({
        data: {
          activity: extractedAction.activity,
          priority: extractedAction.suggestedPriority,
          dueDate: extractedAction.suggestedDueDate
            ? new Date(extractedAction.suggestedDueDate)
            : null,
          isCeoRelated: extraction.ceoDetection.mentioned,
          status: 'SUGGESTED', // Start as suggested, user can accept
          noteId: note.id,
        },
      })

      // Create evidence
      await prisma.evidence.create({
        data: {
          actionId: action.id,
          noteId: note.id,
          excerpt: extractedAction.evidence,
        },
      })

      // Link topics to action
      for (const topicName of extractedAction.topics) {
        const normKey = topicName.toLowerCase().replace(/[^a-z0-9]/g, '')
        const topicId = topicMap.get(normKey)

        if (topicId) {
          await prisma.actionTopic.create({
            data: {
              actionId: action.id,
              topicId: topicId,
            },
          })
        }
      }

      createdActions.push(action)
    }

    return NextResponse.json({
      success: true,
      actionsCreated: createdActions.length,
      topicsCreated: extraction.topics.length,
      ceoMentioned: extraction.ceoDetection.mentioned,
    })
  } catch (error) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      { error: 'Extraction failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}