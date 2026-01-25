'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import TipTapEditor from '@/components/TipTapEditor'
import ActionPanel from '@/components/ActionPanel'
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

  // Auto-save timer
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchNotes()
  }, [])

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
    <div className="flex h-screen">
      {/* Left Sidebar - Notes List */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Signal Notes</h1>
            <button
              onClick={() => router.push('/settings')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Settings
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
            className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
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
                className={`w-full p-4 text-left border-b border-gray-200 hover:bg-white transition-colors ${
                  selectedNote?.id === note.id ? 'bg-white' : ''
                }`}
              >
                <div className="font-medium text-sm truncate">{note.title}</div>
                {note.subtitle && (
                  <div className="text-xs text-gray-600 mt-1 truncate">{note.subtitle}</div>
                )}
                <div className="text-xs text-gray-400 mt-2">
                  {format(new Date(note.date), 'MMM d, yyyy')}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Center - Editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            <div className="p-6 border-b border-gray-200 bg-white">
              <input
                type="text"
                value={selectedNote.title}
                onChange={(e) => handleNoteChange('title', e.target.value)}
                className="text-2xl font-bold w-full border-none focus:outline-none mb-2"
                placeholder="Note title"
              />
              <div className="flex items-center gap-4 mb-2">
                <input
                  type="date"
                  value={selectedNote.date.split('T')[0]}
                  onChange={(e) => handleNoteChange('date', new Date(e.target.value).toISOString())}
                  className="text-sm text-gray-600 border border-gray-300 rounded px-2 py-1"
                />
                <button
                  onClick={() => deleteNote(selectedNote.id)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
                {saving && <span className="text-sm text-gray-400">Saving...</span>}
                {extracting && <span className="text-sm text-gray-400">Saving...</span>}
              </div>
              <input
                type="text"
                value={selectedNote.subtitle || ''}
                onChange={(e) => handleNoteChange('subtitle', e.target.value)}
                className="text-sm text-gray-600 w-full border-none focus:outline-none"
                placeholder="Subtitle (e.g., Eric / NVIDIA)"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <TipTapEditor
                key={selectedNote.id}
                content={selectedNote.content}
                onChange={(content) => handleNoteChange('content', content)}
                placeholder="Start writing your note..."
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a note or create a new one
          </div>
        )}
      </div>

      {/* Right Sidebar - Actions Panel */}
      <div className="w-96 border-l border-gray-200 bg-gray-50">
        <ActionPanel
          onNoteClick={(noteId) => {
            const note = notes.find((n) => n.id === noteId)
            if (note) {
              setSelectedNote(note)
              // Scroll note into view in the sidebar
              const noteElement = document.querySelector(`[data-note-id="${noteId}"]`)
              if (noteElement) {
                noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }
          }}
          triggerRefresh={actionPanelRefresh}
        />
      </div>
    </div>
  )
}
