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
  const [notesListExpanded, setNotesListExpanded] = useState(false)
  const [activeActions, setActiveActions] = useState<any[]>([])

  // Auto-save timer
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchNotes()
    fetchActiveActions()
  }, [])

  useEffect(() => {
    fetchActiveActions()
  }, [actionPanelRefresh])

  // Update browser tab title with task count
  useEffect(() => {
    if (activeActions.length > 0) {
      document.title = `(${activeActions.length}) Signal Notes`
    } else {
      document.title = 'Signal Notes'
    }
  }, [activeActions])

  async function fetchActiveActions() {
    try {
      const res = await fetch('/api/actions')
      if (!res.ok) throw new Error('Failed to fetch actions')
      const data = await res.json()
      
      // Filter and sort active actions
      const active = data
        .filter((a: any) => a.status === 'ACTIVE')
        .sort((a: any, b: any) => (b.sortScore || 0) - (a.sortScore || 0))
      
      setActiveActions(active)
    } catch (error) {
      console.error('Error fetching actions:', error)
    }
  }

  async function handleTaskComplete(taskId: string) {
    try {
      const action = activeActions.find((a) => a.id === taskId)
      
      if (action?.isStanding) {
        await fetch(`/api/actions/${taskId}/complete-standing`, {
          method: 'POST',
        })
      } else {
        await fetch(`/api/actions/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DONE' }),
        })
      }
      
      fetchActiveActions()
    } catch (error) {
      console.error('Error completing task:', error)
    }
  }

  async function handleTaskDelete(taskId: string) {
    try {
      await fetch(`/api/actions/${taskId}`, {
        method: 'DELETE',
      })
      fetchActiveActions()
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  async function handleTaskReorder(reorderedTasks: any[]) {
    try {
      const updates = reorderedTasks.map((task, index) => ({
        id: task.id,
        sortScore: 10000 - index * 100,
      }))

      await Promise.all(
        updates.map((update) =>
          fetch(`/api/actions/${update.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortScore: update.sortScore }),
          })
        )
      )

      fetchActiveActions()
    } catch (error) {
      console.error('Error reordering tasks:', error)
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

  // Categorize actions
  const overdueActions = activeActions.filter((a) => {
    if (!a.dueDate) return false
    return new Date(a.dueDate) < new Date()
  })
  
  const ceoActions = activeActions.filter((a) => a.isCeoRelated && !overdueActions.includes(a))
  
  const otherActions = activeActions.filter(
    (a) => !overdueActions.includes(a) && !ceoActions.includes(a)
  )

  const getDaysOverdue = (dueDate: string) => {
    const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, days)
  }

  return (
    <div className="flex h-screen">
      {/* Left Sidebar - Tasks (Slack-style) */}
      <div className="w-60 border-r-2 border-gray-300 flex flex-col bg-white shadow-lg">
        <div className="p-4 border-b-2 border-gray-800 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-lg">📋 Tasks</h2>
            {activeActions.length > 0 && (
              <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
                {activeActions.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Overdue Section */}
          {overdueActions.length > 0 && (
            <div className="mb-4">
              <div className="px-4 py-2 bg-red-100 border-b-2 border-red-300">
                <h3 className="text-xs font-bold text-red-900 uppercase">
                  ⚠️ Overdue ({overdueActions.length})
                </h3>
              </div>
              <div className="space-y-1 px-2 py-2 bg-red-50">
                {overdueActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-2 bg-white border-l-4 border-red-600 rounded hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 leading-tight">
                          {action.activity}
                          {action.isCeoRelated && (
                            <span className="ml-1 text-purple-600">⚡</span>
                          )}
                        </div>
                        <div className="text-xs text-red-600 font-medium mt-1">
                          Overdue {getDaysOverdue(action.dueDate)} day{getDaysOverdue(action.dueDate) !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleTaskComplete(action.id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Complete"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handleTaskDelete(action.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CEO Priority Section */}
          {ceoActions.length > 0 && (
            <div className="mb-4">
              <div className="px-4 py-2 bg-purple-100 border-b-2 border-purple-300">
                <h3 className="text-xs font-bold text-purple-900 uppercase">
                  🔥 CEO Priorities ({ceoActions.length})
                </h3>
              </div>
              <div className="space-y-1 px-2 py-2 bg-purple-50">
                {ceoActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-2 bg-white border-l-4 border-purple-600 rounded hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 leading-tight">
                          {action.activity} ⚡
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {action.priority}
                          {action.dueDate && ` • Due ${format(new Date(action.dueDate), 'MMM d')}`}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleTaskComplete(action.id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Complete"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handleTaskDelete(action.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Tasks Section */}
          {otherActions.length > 0 && (
            <div className="mb-4">
              <div className="px-4 py-2 bg-gray-100 border-b border-gray-300">
                <h3 className="text-xs font-bold text-gray-700 uppercase">
                  📌 Other Tasks ({otherActions.length})
                </h3>
              </div>
              <div className="space-y-1 px-2 py-2">
                {otherActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-2 bg-white border-l-4 border-gray-300 rounded hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 leading-tight">
                          {action.activity}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {action.priority}
                          {action.dueDate && ` • ${format(new Date(action.dueDate), 'MMM d')}`}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleTaskComplete(action.id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Complete"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handleTaskDelete(action.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeActions.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">
              No active tasks.<br />Create a note to extract actions.
            </div>
          )}
        </div>

        {/* Add Task Button */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => alert('Add task manually - coming soon!')}
            className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded border-2 border-blue-300 font-medium"
          >
            + Add Task
          </button>
        </div>
      </div>

      {/* Main Content - Editor */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Top Bar */}
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

        {/* Editor Section */}
        {selectedNote ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-300 bg-white">
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

      {/* Right Sidebar - Notes List (Collapsible) */}
      {notesListExpanded ? (
        <div className="w-60 border-l-2 border-gray-300 flex flex-col bg-gray-50 shadow-lg">
          <div className="p-4 border-b border-gray-300 bg-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Notes</h3>
              <button
                onClick={() => setNotesListExpanded(false)}
                className="text-gray-600 hover:text-gray-900 text-lg"
              >
                ▶
              </button>
            </div>
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={createNote}
              className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 font-medium"
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
      ) : (
        <button
          onClick={() => setNotesListExpanded(true)}
          className="w-10 border-l-2 border-gray-300 bg-gray-100 hover:bg-gray-200 transition-colors flex flex-col items-center justify-center gap-2 shadow-lg"
          title="Expand notes list"
        >
          <span className="text-gray-600 font-bold text-sm transform -rotate-90 whitespace-nowrap">
            ◀ Notes
          </span>
          {notes.length > 0 && (
            <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
              {notes.length}
            </span>
          )}
        </button>
      )}
    </div>
  )
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
