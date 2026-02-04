import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

// Initialize Sendgrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active tasks
    const actions = await prisma.action.findMany({
      where: {
        status: 'ACTIVE',
      },
      orderBy: {
        sortScore: 'desc',
      },
    })

    // Categorize tasks
    const overdueActions = actions.filter((a) => {
      if (!a.dueDate) return false
      return new Date(a.dueDate) < new Date()
    })

    const ceoActions = actions.filter(
      (a) => a.isCeoRelated && !overdueActions.includes(a)
    )

    const otherActions = actions.filter(
      (a) => !overdueActions.includes(a) && !ceoActions.includes(a)
    )

    // Generate email HTML
    const emailHtml = generateEmailHtml({
      totalCount: actions.length,
      overdueActions,
      ceoActions,
      otherActions,
    })

    // Send email
    const msg = {
      to: process.env.DIGEST_EMAIL_TO || 'rogerliang0489@gmail.com',
      from: process.env.DIGEST_EMAIL_FROM || 'rogerliang0489@gmail.com',
      subject:
        actions.length > 0
          ? `Signal App: You have ${actions.length} task${actions.length !== 1 ? 's' : ''}`
          : 'Signal App: No pending tasks',
      html: emailHtml,
    }

    await sgMail.send(msg)

    return NextResponse.json({
      success: true,
      taskCount: actions.length,
      message: 'Morning digest sent',
    })
  } catch (error) {
    console.error('Morning digest error:', error)
    return NextResponse.json(
      {
        error: 'Failed to send digest',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function generateEmailHtml(data: {
  totalCount: number
  overdueActions: any[]
  ceoActions: any[]
  otherActions: any[]
}) {
  const { totalCount, overdueActions, ceoActions, otherActions } = data

  const getDaysOverdue = (dueDate: string) => {
    const days = Math.floor(
      (Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    return Math.max(0, days)
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #2563eb;
      margin-top: 0;
      font-size: 24px;
    }
    h2 {
      font-size: 16px;
      margin-top: 24px;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .section {
      margin-bottom: 24px;
    }
    .task {
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 6px;
      border-left: 4px solid #e5e7eb;
      background-color: #f9fafb;
    }
    .task-overdue {
      border-left-color: #ef4444;
      background-color: #fef2f2;
    }
    .task-ceo {
      border-left-color: #9333ea;
      background-color: #faf5ff;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }
    .badge-overdue {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .badge-ceo {
      background-color: #ede9fe;
      color: #6b21a8;
    }
    .cta-button {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background-color: white;
      color: #2563eb !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      border: 2px solid #2563eb;
    }
    .cta-button:hover {
      background-color: #eff6ff;
      border-color: #2563eb;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
    }
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
    }
    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 Good Morning!</h1>
    
    ${
      totalCount === 0
        ? `
    <div class="empty-state">
      <div class="empty-state-icon">✅</div>
      <p style="font-size: 18px; font-weight: 600; margin: 0;">No pending tasks</p>
      <p style="margin: 8px 0 0 0;">You're all caught up! Enjoy your day.</p>
    </div>
    `
        : `
    <p style="font-size: 16px; margin-top: 0;">You have <strong>${totalCount}</strong> task${totalCount !== 1 ? 's' : ''} to complete today.</p>
    
    ${
      overdueActions.length > 0
        ? `
    <div class="section">
      <h2>⚠️ OVERDUE (${overdueActions.length})</h2>
      ${overdueActions
        .map(
          (action) => `
      <div class="task task-overdue">
        <strong>${action.activity}</strong>
        ${action.isCeoRelated ? '<span class="badge badge-ceo">⚡ CEO</span>' : ''}
        <span class="badge badge-overdue">Overdue ${getDaysOverdue(action.dueDate)} day${getDaysOverdue(action.dueDate) !== 1 ? 's' : ''}</span>
        ${action.dueDate ? `<div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Due: ${format(new Date(action.dueDate), 'MMM d')}</div>` : ''}
      </div>
      `
        )
        .join('')}
    </div>
    `
        : ''
    }
    
    ${
      ceoActions.length > 0
        ? `
    <div class="section">
      <h2>🔥 CEO PRIORITIES (${ceoActions.length})</h2>
      ${ceoActions
        .map(
          (action) => `
      <div class="task task-ceo">
        <strong>${action.activity}</strong> <span class="badge badge-ceo">⚡</span>
        ${action.priority ? `<div style="font-size: 13px; color: #6b7280; margin-top: 4px;">${action.priority}${action.dueDate ? ` • Due ${format(new Date(action.dueDate), 'MMM d')}` : ''}</div>` : ''}
      </div>
      `
        )
        .join('')}
    </div>
    `
        : ''
    }
    
    ${
      otherActions.length > 0
        ? `
    <div class="section">
      <h2>📌 OTHER TASKS (${otherActions.length})</h2>
      ${otherActions
        .map(
          (action) => `
      <div class="task">
        <strong>${action.activity}</strong>
        ${action.priority ? `<div style="font-size: 13px; color: #6b7280; margin-top: 4px;">${action.priority}${action.dueDate ? ` • Due ${format(new Date(action.dueDate), 'MMM d')}` : ''}</div>` : ''}
      </div>
      `
        )
        .join('')}
    </div>
    `
        : ''
    }
    
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://signalnotes-production.up.railway.app'}/notes" class="cta-button">
      👉 View All Tasks
    </a>
    `
    }
    
    <div class="footer">
      <p style="margin: 0;">Signal Notes Daily Digest</p>
      <p style="margin: 4px 0 0 0; font-size: 12px;">Sent ${format(new Date(), 'EEEE, MMMM d, yyyy')} at ${format(new Date(), 'h:mm a')}</p>
    </div>
  </div>
</body>
</html>
  `
}