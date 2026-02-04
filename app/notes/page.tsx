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
  const [tasksExpanded, setTasksExpanded] = useState(false)
  const [topActions, setTopActions] = useState<any[]>([])

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
    if (topActions.length > 0) {
      document.title = `(${topActions.length}) Signal Notes`
    } else {
      document.title = 'Signal Notes'
    }
  }, [topActions])

  async function fetchActiveActions() {
    try {
      const res = await fetch('/api/actions')
      if (!res.ok) throw new Error('Failed to fetch actions')
      const data = await res.json()
      
      // Filter and sort active actions
      const active = data
        .filter((a: any) => a.status === 'ACTIVE')
        .sort((a: any, b: any) => (b.sortScore || 0) - (a.sortScore || 0))
      
      setTopActions(active)
    } catch (error) {
      console.error('Error fetching actions:', error)
    }
  }

  async function handleTaskComplete(taskId: string) {
    try {
      const action = topActions.find((a) => a.id === taskId)
      
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
      
      // Remove from UI immediately
      setTopActions(prev => prev.filter(a => a.id !== taskId))
      
      // Refresh in background
      setTimeout(() => fetchActiveActions(), 500)
    } catch (error) {
      console.error('Error completing task:', error)
    }
  }

  async function handleTaskDelete(taskId: string) {
    try {
      await fetch(`/api/actions/${taskId}`, {
        method: 'DELETE',
      })
      
      // Remove from UI immediately
      setTopActions(prev => prev.filter(a => a.id !== taskId))
      
      // Refresh in background
      setTimeout(() => fetchActiveActions(), 500)
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

  async function fetchNotes() {
    try {
      const res = await fetch('/api/notes')
      if (!res.ok) throw new Error('Failed to fetch notes')
      const data = await res.json()
      setNotes(data)
      if (data.length > 0 && !selectedNote) {
        setSelectedNote(data[0])
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = useCallback(
    async (query: string) => {
      setSearch(query)
      if (!query.trim()) {
        fetchNotes()
        return
      }

      try {
        const res = await fetch(`/api/notes?search=${encodeURIComponent(query)}`)
        if (!res.ok) throw new Error('Failed to search notes')
        const data = await res.json()
        setNotes(data)
      } catch (error) {
        console.error('Error searching notes:', error)
      }
    },
    []
  )

  async function createNote() {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Note',
          date: new Date().toISOString(),
          content: '',
        }),
      })

      if (!res.ok) throw new Error('Failed to create note')

      const newNote = await res.json()
      setNotes((prev) => [newNote, ...prev])
      setSelectedNote(newNote)
    } catch (error) {
      console.error('Error creating note:', error)
    }
  }

  async function deleteNote(id: string) {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete note')

      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (selectedNote?.id === id) {
        setSelectedNote(notes[0] || null)
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  const handleNoteChange = useCallback(
    (field: keyof Note, value: string) => {
      if (!selectedNote) return

      const updated = { ...selectedNote, [field]: value }
      setSelectedNote(updated)

      // Clear existing timer
      if (saveTimer) {
        clearTimeout(saveTimer)
      }

      // Set new timer for auto-save
      const timer = setTimeout(() => {
        saveNote(updated)
      }, 2000)

      setSaveTimer(timer)
    },
    [selectedNote, saveTimer]
  )

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

        {/* Right Side - Editor + Tasks */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Tasks Bar - Collapsible */}
          <div className="border-b-2 border-gray-300 bg-white shadow-sm">
            <div className="px-6 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                📋 Tasks ({topActions.length})
              </h3>
              <button
                onClick={() => setTasksExpanded(!tasksExpanded)}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              >
                {tasksExpanded ? 'Hide ▲' : 'Show ▼'}
              </button>
            </div>

            {/* Task List - Collapsible */}
            {tasksExpanded && (
              <div className="border-t border-gray-200 bg-gray-50">
                <div className="px-6 py-4 max-h-96 overflow-y-auto">
                  {topActions.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 font-medium">Drag to reorder</span>
                      </div>
                      <DraggableTaskList
                        tasks={topActions}
                        onReorder={handleTaskReorder}
                        onComplete={handleTaskComplete}
                        onDelete={handleTaskDelete}
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">
                      No active tasks. Create a note to extract actions.
                    </div>
                  )}

                 <button
                    onClick={async () => {
                      const activity = prompt('What task do you need to complete?')
                      if (!activity?.trim()) return
                      
                      try {
                        const res = await fetch('/api/actions', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            activity: activity.trim(),
                            priority: 'P1',  // Default to P1
                            dueDate: null,   // No due date
                            status: 'ACTIVE',
                          }),
                        })
                        
                        if (res.ok) {
                          fetchActiveActions()
                        }
                      } catch (error) {
                        console.error('Error creating task:', error)
                      }
                    }}
                    className="w-full mt-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded border-2 border-blue-300 font-medium"
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