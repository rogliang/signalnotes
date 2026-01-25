'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface Evidence {
  id: string
  excerpt: string
  note: {
    id: string
    title: string
    date: string
  }
}

interface Action {
  id: string
  activity: string
  priority: string
  dueDate: string | null
  status: string
  isCeoRelated: boolean
  isStanding: boolean
  sortScore?: number
  createdAt: string
  completionHistory?: string[]
  lastCompletedAt?: string | null
  evidences: Evidence[]
  topics: Array<{
    topic: {
      name: string
      category: string
    }
  }>
}

interface ActionPanelProps {
  onNoteClick: (noteId: string) => void
  triggerRefresh: number
}

interface MacroGoal {
  id: string
  goal: string
  actions: Action[]
}

export default function ActionPanel({ onNoteClick, triggerRefresh }: ActionPanelProps) {
  const router = useRouter()
  const [actions, setActions] = useState<Action[]>([])
  const [macroGoals, setMacroGoals] = useState<MacroGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editActivity, setEditActivity] = useState('')
  const [showAllActive, setShowAllActive] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAction, setNewAction] = useState({ activity: '', priority: 'P1', dueDate: '' })

  useEffect(() => {
    fetchActions()
    fetchMacroGoals()
  }, [triggerRefresh])

  async function fetchMacroGoals() {
    try {
      const res = await fetch('/api/macro-goals')
      if (!res.ok) throw new Error('Failed to fetch macro goals')
      const data = await res.json()
      setMacroGoals(data)
    } catch (error) {
      console.error('Error fetching macro goals:', error)
    }
  }

  async function handleRefresh() {
    try {
      setRefreshing(true)
      const res = await fetch('/api/refresh', {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.details || 'Refresh failed')
      }

      // Reload everything
      await Promise.all([fetchActions(), fetchMacroGoals()])
      
      // Silently completed - no alert
    } catch (error) {
      console.error('Refresh error:', error)
      // Only show alert on error
      alert(`Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setRefreshing(false)
    }
  }

  async function fetchActions() {
    try {
      const res = await fetch('/api/actions')
      if (!res.ok) throw new Error('Failed to fetch actions')
      const data = await res.json()
      setActions(data)
    } catch (error) {
      console.error('Error fetching actions:', error)
    } finally {
      setLoading(false)
    }
  }

  async function acceptAction(id: string) {
    try {
      const res = await fetch(`/api/actions/${id}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to accept action')
      fetchActions()
    } catch (error) {
      console.error('Error accepting action:', error)
    }
  }

  async function markDone(id: string) {
    try {
      const action = actions.find((a) => a.id === id)
      
      if (action?.isStanding) {
        // Handle standing action - roll forward
        const res = await fetch(`/api/actions/${id}/complete-standing`, {
          method: 'POST',
        })
        if (!res.ok) throw new Error('Failed to complete standing action')
        // Silently completed - no alert
      } else {
        // Regular action - mark done
        const res = await fetch(`/api/actions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DONE' }),
        })
        if (!res.ok) throw new Error('Failed to mark done')
      }
      
      fetchActions()
    } catch (error) {
      console.error('Error marking done:', error)
    }
  }

  async function deleteAction(id: string) {
    try {
      const res = await fetch(`/api/actions/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete action')
      fetchActions()
    } catch (error) {
      console.error('Error deleting action:', error)
    }
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity: editActivity }),
      })
      if (!res.ok) throw new Error('Failed to update action')
      setEditingId(null)
      fetchActions()
    } catch (error) {
      console.error('Error updating action:', error)
    }
  }

  async function createManualAction() {
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity: newAction.activity,
          priority: newAction.priority,
          dueDate: newAction.dueDate || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to create action')
      
      setShowAddForm(false)
      setNewAction({ activity: '', priority: 'P1', dueDate: '' })
      fetchActions()
    } catch (error) {
      console.error('Error creating action:', error)
    }
  }

  const activeActions = actions.filter((a) => a.status === 'ACTIVE')
  const suggestedActions = actions.filter((a) => a.status === 'SUGGESTED')
  
  // Sort active actions: overdue first, then by sortScore
  const sortedActiveActions = [...activeActions].sort((a, b) => {
    const aOverdue = a.dueDate && new Date(a.dueDate) < new Date()
    const bOverdue = b.dueDate && new Date(b.dueDate) < new Date()
    
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    
    return (b.sortScore || 0) - (a.sortScore || 0)
  })
  
  const displayedActiveActions = showAllActive ? sortedActiveActions : sortedActiveActions.slice(0, 5)
  const hiddenCount = sortedActiveActions.length - 5

  // Helper to check if overdue
  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  // Helper to get days overdue
  const getDaysOverdue = (dueDate: string | null) => {
    if (!dueDate) return 0
    const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, days)
  }

  // Helper for smart date labels
  const getSmartDateLabel = (dueDate: string | null) => {
    if (!dueDate) return null
    
    const date = new Date(dueDate)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const isToday = date.toDateString() === today.toDateString()
    const isTomorrow = date.toDateString() === tomorrow.toDateString()
    
    if (isOverdue(dueDate)) {
      const days = getDaysOverdue(dueDate)
      return `⚠️ Overdue ${days} day${days !== 1 ? 's' : ''}`
    } else if (isToday) {
      return '📅 Due today'
    } else if (isTomorrow) {
      return '📅 Due tomorrow'
    } else {
      return `Due ${format(date, 'MMM d')}`
    }
  }

  // Helper to check if action is stagnant (3+ days old, no progress)
  const isStagnant = (action: Action) => {
    const daysOpen = Math.floor((Date.now() - new Date(action.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    return daysOpen >= 3
  }

  const getDaysOpen = (createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return <div className="p-4 text-gray-500 text-sm">Loading actions...</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-lg">Actions</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              + Add Action
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded space-y-2">
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newAction.activity}
              onChange={(e) => setNewAction({ ...newAction, activity: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <div className="flex gap-2">
              <select
                value={newAction.priority}
                onChange={(e) => setNewAction({ ...newAction, priority: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="P0">P0 (Urgent)</option>
                <option value="P1">P1 (High)</option>
                <option value="P2">P2 (Normal)</option>
              </select>
              <input
                type="date"
                value={newAction.dueDate}
                onChange={(e) => setNewAction({ ...newAction, dueDate: e.target.value })}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createManualAction}
                disabled={!newAction.activity.trim()}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewAction({ activity: '', priority: 'P1', dueDate: '' })
                }}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Macro Goals Section */}
        {macroGoals.length > 0 && (
          <div className="mb-6 bg-blue-50 border-b-2 border-blue-200">
            <div className="px-4 py-2 bg-blue-100 text-xs font-semibold text-blue-900 uppercase">
              Strategic Goals
            </div>
            {macroGoals.map((goal) => (
              <div key={goal.id} className="p-4 border-b border-blue-100">
                <div className="text-sm font-semibold text-blue-900 mb-2">
                  🎯 {goal.goal}
                </div>
                {goal.actions.length > 0 && (
                  <div className="space-y-1 ml-4">
                    {goal.actions.map((action) => (
                      <div key={action.id} className="text-xs text-gray-700 flex items-start gap-2">
                        <span className="text-blue-600">→</span>
                        <span>{action.activity}</span>
                        {action.isCeoRelated && (
                          <span className="text-purple-600 font-semibold">⚡</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Active Actions */}
        {activeActions.length > 0 && (
          <div className="mb-6">
            <div className="px-4 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
              Active ({activeActions.length})
            </div>
            {displayedActiveActions.map((action) => (
              <div key={action.id} className="p-4 border-b border-gray-200 hover:bg-gray-50">
                {editingId === action.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editActivity}
                      onChange={(e) => setEditActivity(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(action.id)}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{action.activity}</div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            action.priority === 'P0'
                              ? 'bg-red-100 text-red-700'
                              : action.priority === 'P1'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {action.priority}
                        </span>
                        {action.isCeoRelated && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                            ⚡ CEO
                          </span>
                        )}
                        {action.isStanding && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
                            📌 Recurring
                          </span>
                        )}
                        {action.dueDate && isOverdue(action.dueDate) && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-600 text-white">
                            🔥 Overdue
                          </span>
                        )}
                      </div>
                    </div>

                    {action.dueDate && (
                      <div className={`text-xs mb-2 ${isOverdue(action.dueDate) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                        {getSmartDateLabel(action.dueDate)}
                      </div>
                    )}

                    {action.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {action.topics.map((t, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                          >
                            {t.topic.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {action.evidences.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {action.evidences.map((evidence) => (
                          <div
                            key={evidence.id}
                            className="text-xs bg-gray-50 p-2 rounded cursor-pointer hover:bg-gray-100"
                            onClick={() => onNoteClick(evidence.note.id)}
                          >
                            <div className="text-gray-600 italic mb-1">"{evidence.excerpt}"</div>
                            <div className="text-gray-400">
                              → {evidence.note.title} •{' '}
                              {format(new Date(evidence.note.date), 'MMM d')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isStagnant(action) && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <div className="text-yellow-800 font-medium mb-1">
                          ⏱️ Open for {getDaysOpen(action.createdAt)} days
                        </div>
                        <div className="text-yellow-700">Still strategically important?</div>
                      </div>
                    )}

                    {action.isStanding && action.completionHistory && action.completionHistory.length > 0 && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                        <div className="text-green-800 font-medium mb-1">
                          ✓ Completed {action.completionHistory.length} time{action.completionHistory.length !== 1 ? 's' : ''}
                        </div>
                        <div className="text-green-700 space-y-0.5">
                          {action.completionHistory.slice(-3).reverse().map((date, i) => (
                            <div key={i}>• {format(new Date(date), 'MMM d, yyyy')}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => markDone(action.id)}
                        className="text-xs text-green-600 hover:text-green-700 font-medium"
                      >
                        ✓ Done
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(action.id)
                          setEditActivity(action.activity)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteAction(action.id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllActive(!showAllActive)}
                className="w-full p-3 text-sm text-blue-600 hover:bg-gray-50 border-b border-gray-200"
              >
                {showAllActive ? '← Show Less' : `Show ${hiddenCount} More →`}
              </button>
            )}
          </div>
        )}

        {/* Suggested Actions */}
        {suggestedActions.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
              Suggested ({suggestedActions.length})
            </div>
            {suggestedActions.map((action) => (
              <div key={action.id} className="p-4 border-b border-gray-200 hover:bg-gray-50">
                <div className="text-sm font-medium mb-2">{action.activity}</div>
                
                {action.evidences.length > 0 && (
                  <div className="text-xs bg-gray-50 p-2 rounded mb-2">
                    <div className="text-gray-600 italic">
                      "{action.evidences[0].excerpt}"
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => acceptAction(action.id)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => deleteAction(action.id)}
                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeActions.length === 0 && suggestedActions.length === 0 && (
          <div className="p-4 text-sm text-gray-500">
            No actions yet. Save a note to extract actions!
          </div>
        )}
      </div>
    </div>
  )
}
