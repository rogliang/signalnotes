'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useEffect } from 'react'

interface TipTapEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

export default function TipTapEditor({ content, onChange, placeholder }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({
        openOnClick: false,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
    ],
    content,
    immediatelyRender: false, // Fix SSR hydration warning
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
      },
    },
  })

  // Update editor content when prop changes (for switching notes)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  const handleImageUpload = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        // Sanitize filename - remove special characters, replace spaces
        const sanitizedFileName = file.name
          .replace(/[^a-zA-Z0-9.-]/g, '-')  // Replace special chars with dash
          .replace(/\s+/g, '-')              // Replace spaces with dash
          .replace(/-+/g, '-')               // Replace multiple dashes with single
          .toLowerCase()                     // Lowercase for consistency
        
        // Get presigned URL
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: sanitizedFileName,
            fileType: file.type,
          }),
        })

        if (!res.ok) throw new Error('Failed to get upload URL')

        const { uploadUrl, publicUrl } = await res.json()

        // Upload to S3
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        })

        if (!uploadRes.ok) {
          throw new Error('Failed to upload to S3')
        }

        // Insert image into editor
        editor?.chain().focus().setImage({ src: publicUrl }).run()
      } catch (error) {
        console.error('Image upload failed:', error)
        alert('Failed to upload image')
      }
    }
    input.click()
  }, [editor])

  if (!editor) {
    return <div className="p-4 text-gray-400">Loading editor...</div>
  }

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2.5 py-1.5 rounded text-sm font-semibold ${
            editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
          }`}
          title="Bold"
        >
          B
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2.5 py-1.5 rounded text-sm italic ${
            editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
          }`}
          title="Italic"
        >
          I
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-2.5 py-1.5 rounded text-sm line-through ${
            editor.isActive('strike') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
          }`}
          title="Strikethrough"
        >
          S
        </button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2.5 py-1.5 rounded text-sm font-semibold ${
            editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
          }`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2.5 py-1.5 rounded text-sm font-semibold ${
            editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2.5 py-1.5 rounded text-sm font-semibold ${
            editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
          }`}
          title="Heading 3"
        >
          H3
        </button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2.5 py-1.5 rounded text-sm ${
            editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
          }`}
          title="Bullet List"
        >
          • List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2.5 py-1.5 rounded text-sm ${
            editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
          }`}
          title="Numbered List"
        >
          1. List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`px-2.5 py-1.5 rounded text-sm ${
            editor.isActive('taskList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
          }`}
          title="Task List"
        >
          ☐ Tasks
        </button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <button
          onClick={() => {
            const url = window.prompt('Enter URL:')
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            }
          }}
          className={`px-2.5 py-1.5 rounded text-sm ${
            editor.isActive('link') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
          }`}
          title="Insert Link"
        >
          🔗 Link
        </button>
        <button
          onClick={handleImageUpload}
          className="px-2.5 py-1.5 rounded text-sm hover:bg-gray-200"
          title="Insert Image"
        >
          🖼️ Image
        </button>
        <button
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          className="px-2.5 py-1.5 rounded text-sm hover:bg-gray-200"
          title="Insert Table"
        >
          ⊞ Table
        </button>
      </div>

      {/* Editor */}
      <div className="p-4 min-h-[400px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
