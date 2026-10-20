"use client"

import * as React from "react"
import { AlertCircle, Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import {
  type BackendWorkItemPriority,
  type BackendWorkItemType,
  createWorkItem,
} from "@/lib/api"

interface CreateItemDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateItemDialog({
  isOpen,
  onClose,
  onSuccess,
}: CreateItemDialogProps) {
  const { user } = useAuth()

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [type, setType] = React.useState<BackendWorkItemType>("TASK")
  const [priority, setPriority] = React.useState<BackendWorkItemPriority>("MEDIUM")
  const [systemArea, setSystemArea] = React.useState("Core Engine")
  const defaultTeamId = user?.teams && user.teams.length > 0 ? user.teams[0].teamId : ""
  const [userChosenTeamId, setUserChosenTeamId] = React.useState<string | null>(null)
  const teamId = (userChosenTeamId && user?.teams?.some((t) => t.teamId === userChosenTeamId))
    ? userChosenTeamId
    : defaultTeamId
  const [dueDate, setDueDate] = React.useState("")

  const [idempotencyKey, setIdempotencyKey] = React.useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `item-${Date.now()}`
  )
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleClose = React.useCallback(() => {
    setTitle("")
    setDescription("")
    setUserChosenTeamId(null)
    setError(null)
    setIdempotencyKey(
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `item-${Date.now()}`
    )
    onClose()
  }, [onClose])

  const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError("Title is required (minimum 3 characters).")
      return
    }
    if (!teamId) {
      setError("Please select an authorized team for this work item.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let isoDueDate: string | undefined = undefined
      if (dueDate) {
        isoDueDate = new Date(dueDate).toISOString()
      }

      await createWorkItem(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          priority,
          systemArea: systemArea.trim(),
          teamId,
          dueDate: isoDueDate,
        },
        idempotencyKey
      )

      onSuccess()
      handleClose()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to create work item.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [title, description, teamId, dueDate, type, priority, systemArea, idempotencyKey, onSuccess, handleClose])

  // Add Cmd+Enter / Ctrl+Enter shortcut to create item
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent
        handleSubmit(fakeEvent)
      } else if (e.key === "Escape") {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, handleSubmit, handleClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-item-title"
    >
      <div className="relative w-full max-w-xl rounded-xl border border-white/[0.08] bg-[#101115] p-5 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
        {/* Top Header: Team Context & Close */}
        <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase text-zinc-400">New Issue in</span>
            <select
              value={teamId}
              onChange={(e) => setUserChosenTeamId(e.target.value)}
              className="rounded-md border border-white/[0.08] bg-[#16171d] px-2 py-0.5 text-xs text-zinc-200 font-medium focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              {user?.teams && user.teams.length > 0 ? (
                user.teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.teamName} ({t.role})
                  </option>
                ))
              ) : (
                <option value="">No team found</option>
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200 transition-colors"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <AlertCircle className="size-3.5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          {/* Frameless Title Input */}
          <div>
            <label htmlFor="item-title" className="sr-only">
              Issue Title
            </label>
            <input
              id="item-title"
              required
              autoFocus
              minLength={3}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Issue title…"
              className="w-full bg-transparent border-none text-base font-semibold text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-0 p-0"
            />
          </div>

          {/* Frameless Description Textarea */}
          <div>
            <label htmlFor="item-description" className="sr-only">
              Issue Description
            </label>
            <textarea
              id="item-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description or incident details…"
              className="w-full resize-none bg-transparent border-none text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-0 p-0 leading-relaxed"
            />
          </div>

          {/* Linear-Style Attribute Selector Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.05]">
            {/* Type Chip */}
            <div className="flex items-center gap-1 rounded-md border border-white/[0.07] bg-[#16171d] px-2 py-1 text-[11px] text-zinc-300">
              <span className="text-zinc-400 font-mono text-[10px]">Type:</span>
              <select
                id="item-type"
                value={type}
                onChange={(e) => setType(e.target.value as BackendWorkItemType)}
                className="bg-transparent text-zinc-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="TASK" className="bg-[#16171d]">Task</option>
                <option value="INCIDENT" className="bg-[#16171d]">Incident</option>
                <option value="BUG" className="bg-[#16171d]">Bug</option>
                <option value="OPS" className="bg-[#16171d]">Ops</option>
              </select>
            </div>

            {/* Priority Chip */}
            <div className="flex items-center gap-1 rounded-md border border-white/[0.07] bg-[#16171d] px-2 py-1 text-[11px] text-zinc-300">
              <span className="text-zinc-400 font-mono text-[10px]">Priority:</span>
              <select
                id="item-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as BackendWorkItemPriority)}
                className="bg-transparent text-zinc-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="URGENT" className="bg-[#16171d] text-rose-400">Urgent (P0)</option>
                <option value="HIGH" className="bg-[#16171d] text-amber-400">High (P1)</option>
                <option value="MEDIUM" className="bg-[#16171d]">Medium (P2)</option>
                <option value="LOW" className="bg-[#16171d] text-zinc-400">Low (P3)</option>
              </select>
            </div>

            {/* System Area Chip */}
            <div className="flex items-center gap-1 rounded-md border border-white/[0.07] bg-[#16171d] px-2 py-1 text-[11px] text-zinc-300">
              <span className="text-zinc-400 font-mono text-[10px]">Area:</span>
              <input
                id="item-system-area"
                required
                value={systemArea}
                onChange={(e) => setSystemArea(e.target.value)}
                placeholder="Core Engine"
                className="bg-transparent text-zinc-200 w-24 text-[11px] focus:outline-none"
              />
            </div>

            {/* Due Date Chip */}
            <div className="flex items-center gap-1 rounded-md border border-white/[0.07] bg-[#16171d] px-2 py-1 text-[11px] text-zinc-300">
              <span className="text-zinc-400 font-mono text-[10px]">Due:</span>
              <input
                id="item-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-transparent text-zinc-200 text-[11px] focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Footer Bar */}
          <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[200px]" title={`Idempotency Key: ${idempotencyKey}`}>
              Idempotency: {idempotencyKey.slice(0, 8)}…
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-xs text-zinc-400 hover:text-zinc-200 h-7 px-2.5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3 h-7 gap-1.5 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    <span>Creating…</span>
                  </>
                ) : (
                  <>
                    <Check className="size-3" />
                    <span>Create Issue</span>
                    <kbd className="hidden sm:inline text-[9px] font-mono opacity-60 ml-0.5">⌘↵</kbd>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
