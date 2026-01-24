'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Settings {
  id: string
  ceoFirstName: string | null
  ceoAliases: string[]
  contextPrompt: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [ceoFirstName, setCeoFirstName] = useState('')
  const [ceoAliases, setCeoAliases] = useState('')
  const [contextPrompt, setContextPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to fetch settings')
      }
      const data = await res.json()
      setSettings(data)
      setCeoFirstName(data.ceoFirstName || '')
      setCeoAliases(data.ceoAliases?.join(', ') || '')
      setContextPrompt(data.contextPrompt || '')
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ceoFirstName: ceoFirstName.trim() || null,
          ceoAliases: ceoAliases
            .split(',')
            .map(a => a.trim())
            .filter(Boolean),
          contextPrompt: contextPrompt.trim() || null
        })
      })

      if (!res.ok) {
        throw new Error('Failed to save settings')
      }

      const data = await res.json()
      setSettings(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              ← Back to Notes
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-red-600 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8 space-y-8">
          {/* CEO Identity */}
          <div>
            <h2 className="text-xl font-semibold mb-4">CEO Identity</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CEO First Name
                </label>
                <input
                  type="text"
                  value={ceoFirstName}
                  onChange={(e) => setCeoFirstName(e.target.value)}
                  placeholder="e.g., Eric"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Primary name used to detect CEO mentions in your notes
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aliases (comma-separated)
                </label>
                <input
                  type="text"
                  value={ceoAliases}
                  onChange={(e) => setCeoAliases(e.target.value)}
                  placeholder="e.g., E, Boss, Chief"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Alternative names or nicknames for CEO detection
                </p>
              </div>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Context for AI */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Context & Instructions for AI</h2>
            <p className="text-sm text-gray-600 mb-4">
              Provide context to help the AI understand your role, priorities, and goals. 
              This will be used when extracting actions and inferring priorities.
            </p>
            <textarea
              value={contextPrompt}
              onChange={(e) => setContextPrompt(e.target.value)}
              rows={12}
              placeholder={`Company Vision:
We're building the future of enterprise AI partnerships.

My Role:
VP of Strategic Partnerships, reporting to CEO

Q1 2026 Goals:
- Close 3 Fortune 500 partnerships
- Launch NVIDIA co-innovation lab
- Scale partner revenue 40% QoQ

When prioritizing, focus on:
- Revenue impact over brand partnerships
- CEO asks are always P0
- Technical blockers should escalate quickly`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end items-center gap-4">
            {saved && (
              <span className="text-green-600 text-sm">✓ Saved successfully</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
