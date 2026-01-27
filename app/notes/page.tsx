'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import TipTapEditor from '@/components/TipTapEditor'
import DraggableTaskList from '@/components/DraggableTaskList'
import { format } from 'date-fns'

interface Note {
  id: string
  title: string
  date: string
  subtitle?: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export default function NotesPage() {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [search, setSearch] = useState('')
  const [actionPanelRefresh, setActionPanelRefresh] = useState(0)
  const [goalsExpanded, setGoalsExpanded] = useState(false)
  const [goalsPinned, setGoalsPinned] = useState(false)
  const [macroGoals, setMacroGoals] = useState<any[]>([])
  const [topActions, setTopActions] = useState<any[]>([])

  // Auto-save timer
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchNotes()
    fetchGoalsAndActions()
  }, [])

  useEffect(() => {
    fetchGoalsAndActions()
  }, [actionPanelRefresh])

  async function fetchGoalsAndActions() {
    try {
      // Fetch macro goals
      const goalsRes = await fetch('/api/macro-goals')
      if (goalsRes.ok) {
        const goalsData = await goalsRes.json()
        setMacroGoals(goalsData)
      }

      // Fetch top actions
      const actionsRes = await fetch('/api/actions')
      if (actionsRes.ok) {
        const actionsData = await actionsRes.json()
        // Sort by sortScore descending
        const sorted = actionsData
          .filter((a: any) => a.status === 'ACTIVE')
          .sort((a: any, b: any) => (b.sortScore || 0) - (a.sortScore || 0))
        setTopActions(sorted)
      }
    } catch (error) {
      console.error('Error fetching goals/actions:', error)
    }
  }

  async function handleTaskReorder(reorderedTasks: any[]) {
    try {
      // Update sortScores based on new order
      // Highest priority = highest score
      const updates = reorderedTasks.map((task, index) => ({
        id: task.id,
        sortScore: 10000 - index * 100, // Descending scores
      }))

      // Update each task's sortScore
      await Promise.all(
        updates.map((update) =>
          fetch(`/api/actions/${update.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortScore: update.sortScore }),
          })
        )
      )

      // Refresh to show new order
      fetchGoalsAndActions()
    } catch (error) {
      console.error('Error reordering tasks:', error)
    }
  }

  async function handleTaskComplete(taskId: string) {
    try {
      await fetch(`/api/actions/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE' }),
      })
      fetchGoalsAndActions()
    } catch (error) {
      console.error('Error completing task:', error)
    }
  }

  async function handleTaskDelete(taskId: string) {
    try {
      await fetch(`/api/actions/${taskId}`, {
        method: 'DELETE',
      })
      fetchGoalsAndActions()
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  async function fetchNotes(searchQuery?: string) {
    try {
      const url = searchQuery
        ? `/api/notes?search=${encodeURIComponent(searchQuery)}`
        : '/api/notes'
      const res = await fetch(url)

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to fetch notes')
      }

      const data = await res.json()
      setNotes(data)
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createNote() {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled',
          date: new Date().toISOString(),
          content: '',
        }),
      })

      if (!res.ok) throw new Error('Failed to create note')

      const note = await res.json()
      setNotes([note, ...notes])
      setSelectedNote(note)
    } catch (error) {
      console.error('Error creating note:', error)
      alert('Failed to create note')
    }
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return

    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete note')

      setNotes(notes.filter((n) => n.id !== id))
      if (selectedNote?.id === id) {
        setSelectedNote(null)
      }
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('Failed to delete note')
    }
  }

  const saveNote = useCallback(async (note: Note) => {
    try {
      setSaving(true)
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          date: note.date,
          subtitle: note.subtitle,
          content: note.content,
        }),
      })

      if (!res.ok) throw new Error('Failed to save note')

      const updated = await res.json()
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      setSelectedNote(updated)

      // Trigger extraction
      triggerExtraction(note.id)
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setSaving(false)
    }
  }, [])

  async function triggerExtraction(noteId: string) {
    try {
      setExtracting(true)
      const res = await fetch(`/api/notes/${noteId}/extract`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        console.error('Extraction failed:', error)
        return
      }

      const result = await res.json()
      console.log('Extraction result:', result)

      // Refresh action panel
      setActionPanelRefresh((prev) => prev + 1)
    } catch (error) {
      console.error('Error extracting:', error)
    } finally {
      setExtracting(false)
    }
  }

  function handleNoteChange(field: string, value: string) {
    if (!selectedNote) return

    const updated = { ...selectedNote, [field]: value }
    setSelectedNote(updated)

    // Auto-save after 2 seconds of inactivity
    if (saveTimer) clearTimeout(saveTimer)
    const timer = setTimeout(() => saveNote(updated), 2000)
    setSaveTimer(timer)
  }

  function handleSearch(query: string) {
    setSearch(query)
    if (query.trim()) {
      fetchNotes(query)
    } else {
      fetchNotes()
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b-2 border-gray-800 bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-blue-600">📝 Signal Notes</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/settings')}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Settings
          </button>
          <button
            onClick={async () => {
              const res = await fetch('/api/refresh', { method: 'POST' })
              if (res.ok) {
                setActionPanelRefresh((prev) => prev + 1)
              }
            }}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Notes List */}
        <div className="w-60 border-r-2 border-gray-300 flex flex-col bg-gray-50 shadow-md">
          <div className="p-4 border-b border-gray-300 bg-white">
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={createNote}
              className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 font-medium shadow"
            >
              + New Note
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-gray-500 text-sm">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="p-4 text-gray-500 text-sm">
                {search ? 'No notes found' : 'No notes yet'}
              </div>
            ) : (
              notes.map((note) => (
                <button
                  key={note.id}
                  data-note-id={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`w-full p-3 text-left border-b border-gray-200 hover:bg-white transition-colors ${
                    selectedNote?.id === note.id ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : ''
                  }`}
                >
                  <div className="text-xs text-gray-400 mb-1 font-medium">
                    {format(new Date(note.date), 'MMM d, yyyy')}
                  </div>
                  <div className="font-medium text-sm truncate text-gray-800">{note.title}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side - Editor + Goals Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Collapsible Goals Panel */}
          <div className="border-b-2 border-gray-300 bg-blue-50 shadow-sm">
            {!goalsExpanded && !goalsPinned ? (
              // Collapsed State
              <button
                onClick={() => setGoalsExpanded(true)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-800">
                    🎯 {macroGoals.length} Goal{macroGoals.length !== 1 ? 's' : ''} • {topActions.length} Task{topActions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-sm text-gray-600 font-medium">Expand ▼</span>
              </button>
            ) : (
              // Expanded State
              <div className="max-h-80 overflow-y-auto bg-white border border-gray-200">
                <div className="px-6 py-3 flex items-center justify-between border-b-2 border-gray-300 bg-blue-50">
                  <h3 className="font-semibold text-gray-900">🎯 Strategic Goals</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGoalsPinned(!goalsPinned)}
                      className={`px-2 py-1 text-xs rounded font-medium ${
                        goalsPinned ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {goalsPinned ? '📌 Pinned' : 'Pin'}
                    </button>
                    <button
                      onClick={() => {
                        setGoalsExpanded(false)
                        setGoalsPinned(false)
                      }}
                      className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded font-medium"
                    >
                      Hide ▲
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 space-y-4 bg-gray-50">
                  {macroGoals.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      No goals yet. Click Refresh to generate strategic goals.
                    </div>
                  ) : (
                    macroGoals.map((goal) => (
                      <div key={goal.id} className="space-y-2 p-3 bg-white rounded border border-gray-200 shadow-sm">
                        <div className="font-medium text-gray-900">{goal.goal}</div>
                        {goal.actions && goal.actions.length > 0 && (
                          <div className="ml-4 space-y-1">
                            {goal.actions.map((action: any) => (
                              <div key={action.id} className="flex items-start gap-2 text-sm">
                                <span className="text-blue-600 mt-0.5">→</span>
                                <div className="flex-1">
                                  <span className="text-gray-700">{action.activity}</span>
                                  {action.isCeoRelated && (
                                    <span className="ml-2 text-xs text-purple-600 font-semibold">⚡</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {topActions.length > 0 && (
                    <div className="pt-4 border-t-2 border-gray-300">
                      <div className="font-medium text-gray-900 mb-3 flex items-center justify-between">
                        <span>All Tasks ({topActions.length})</span>
                        <span className="text-xs text-gray-500 font-normal">Drag to reorder</span>
                      </div>
                      <DraggableTaskList
                        tasks={topActions}
                        onReorder={handleTaskReorder}
                        onComplete={handleTaskComplete}
                        onDelete={handleTaskDelete}
                      />
                    </div>
                  )}

                  <button
                    onClick={() => {
                      // TODO: Open add task modal
                      alert('Add task feature - coming soon!')
                    }}
                    className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded border-2 border-blue-300 font-medium"
                  >
                    + Add Task
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Editor Section */}
          {selectedNote ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b-2 border-gray-300 bg-white shadow-sm">
                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={(e) => handleNoteChange('title', e.target.value)}
                  className="text-2xl font-bold w-full border-none focus:outline-none mb-2 text-gray-900"
                  placeholder="Note title"
                />
                <div className="flex items-center gap-4">
                  <input
                    type="date"
                    value={selectedNote.date.split('T')[0]}
                    onChange={(e) => handleNoteChange('date', new Date(e.target.value).toISOString())}
                    className="text-sm text-gray-600 border border-gray-300 rounded px-2 py-1"
                  />
                  <input
                    type="text"
                    value={selectedNote.subtitle || ''}
                    onChange={(e) => handleNoteChange('subtitle', e.target.value)}
                    className="text-sm text-gray-600 flex-1 border-none focus:outline-none"
                    placeholder="Subtitle (e.g., Eric / NVIDIA)"
                  />
                  <button
                    onClick={() => deleteNote(selectedNote.id)}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                  {saving && <span className="text-sm text-gray-400">Saving...</span>}
                  {extracting && <span className="text-sm text-gray-400">Saving...</span>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
                <TipTapEditor
                  key={selectedNote.id}
                  content={selectedNote.content}
                  onChange={(content) => handleNoteChange('content', content)}
                  placeholder="Start writing your note..."
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50">
              Select a note or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
