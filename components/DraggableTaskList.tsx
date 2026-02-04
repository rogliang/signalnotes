'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Task {
  id: string
  activity: string
  isCeoRelated: boolean
  sortScore?: number
}

interface DraggableTaskListProps {
  tasks: Task[]
  onReorder: (reorderedTasks: Task[]) => void
  onComplete: (taskId: string) => void
  onDelete: (taskId: string) => void
}

function SortableTask({
  task,
  onComplete,
  onDelete,
}: {
  task: Task
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center gap-2 flex-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          title="Drag to reorder"
        >
          ⋮⋮
        </button>
        <span className="text-gray-700 text-sm">{task.activity}</span>
        {task.isCeoRelated && <span className="text-xs text-purple-600 font-semibold">⚡</span>}
      </div>
      <div className="flex items-center gap-1 ml-2">
        <button
          onClick={() => onComplete(task.id)}
          className="p-1 text-xs text-green-600 hover:bg-green-50 rounded"
          title="Mark as done"
        >
          ✓
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="p-1 text-xs text-red-600 hover:bg-red-50 rounded"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default function DraggableTaskList({
  tasks,
  onReorder,
  onComplete,
  onDelete,
}: DraggableTaskListProps) {
  const [items, setItems] = useState(tasks)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      const reordered = arrayMove(items, oldIndex, newIndex)
      setItems(reordered)
      onReorder(reordered)
    }
  }

  // Update items when tasks prop changes
  if (items.length !== tasks.length || items[0]?.id !== tasks[0]?.id) {
    setItems(tasks)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {items.map((task) => (
            <SortableTask
              key={task.id}
              task={task}
              onComplete={onComplete}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}