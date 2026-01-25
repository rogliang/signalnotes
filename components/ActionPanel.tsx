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
      
      alert('System refreshed! Goals and priorities updated.')
    } catch (error) {
      console.error('Refresh error:', error)
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
        alert('Standing action completed! Due date rolled to next Monday.')
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

  const activeActions = actions.filter((a) => a.status === 'ACTIVE')
  const suggestedActions = actions.filter((a) => a.status === 'SUGGESTED')
  
  const displayedActiveActions = showAllActive ? activeActions : activeActions.slice(0, 5)
  const hiddenCount = activeActions.length - 5

  if (loading) {
    return <div className="p-4 text-gray-500 text-sm">Loading actions...</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-lg">Actions</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
        </div>
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
                      </div>
                    </div>

                    {action.dueDate && (
                      <div className="text-xs text-gray-500 mb-2">
                        Due: {format(new Date(action.dueDate), 'MMM d, yyyy')}
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
