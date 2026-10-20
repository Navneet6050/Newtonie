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
  const prevActiveElement = React.useRef<HTMLElement | null>(null)

  // Track and restore keyboard focus
  React.useEffect(() => {
    if (isOpen) {
      prevActiveElement.current = document.activeElement as HTMLElement | null
    } else if (prevActiveElement.current) {
      if (typeof prevActiveElement.current.focus === "function" && prevActiveElement.current.isConnected) {
        prevActiveElement.current.focus()
      }
      prevActiveElement.current = null
    }
  }, [isOpen])

  const resetForm = React.useCallback(() => {
    setTitle("")
    setDescription("")
    setUserChosenTeamId(null)
    setError(null)
    setIdempotencyKey(
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `item-${Date.now()}`
    )
  }, [])

  const handleDismiss = React.useCallback(() => {
    if (isSubmitting) return
    resetForm()
    onClose()
  }, [onClose, isSubmitting, resetForm])

  const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
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

      resetForm()
      onSuccess()
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to create work item.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [title, description, teamId, dueDate, type, priority, systemArea, idempotencyKey, onSuccess, onClose, resetForm, isSubmitting])

  // Add Cmd+Enter / Ctrl+Enter shortcut to create item and guard Escape during submission
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        if (isSubmitting) return
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent
        handleSubmit(fakeEvent)
      } else if (e.key === "Escape") {
        if (!isSubmitting) {
          handleDismiss()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, handleSubmit, handleDismiss, isSubmitting])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150 motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-item-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleDismiss()
        }
      }}
    >
      <div className="relative w-full max-w-xl rounded-xl border border-white/[0.08] bg-[#0f1014] p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3.5">
          <div className="flex items-center gap-2">
            <h2 id="create-item-title" className="text-base font-semibold text-zinc-100">
              Create Work Item
            </h2>
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/20">
              New Issue
            </span>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleDismiss}
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Validation / Error Alert */}
        {error && (
          <div className="mt-3.5 flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300 animate-in fade-in duration-150">
            <AlertCircle className="size-3.5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Group 1: Issue Details */}
          <div className="space-y-3">
            <div>
              <label htmlFor="item-title" className="block text-xs font-medium text-zinc-300 mb-1">
                Title <span className="text-rose-400">*</span>
              </label>
              <input
                id="item-title"
                required
                autoFocus
                disabled={isSubmitting}
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ingestion service timeout under sustained queue pressure"
                className="w-full h-9 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 text-xs text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-indigo-500/70 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="item-description" className="block text-xs font-medium text-zinc-300 mb-1">
                Description & Incident Context
              </label>
              <textarea
                id="item-description"
                rows={3}
                disabled={isSubmitting}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add reproduction steps, impacted nodes, telemetry signals, or triage context…"
                className="w-full resize-none rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5 text-xs text-zinc-200 placeholder:text-zinc-500 transition-colors focus:border-indigo-500/70 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 leading-relaxed"
              />
            </div>
          </div>

          {/* Group 2: Classification */}
          <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Classification
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Type */}
              <div className="space-y-1">
                <label htmlFor="item-type" className="block text-[11px] font-medium text-zinc-400">
                  Type
                </label>
                <select
                  id="item-type"
                  disabled={isSubmitting}
                  value={type}
                  onChange={(e) => setType(e.target.value as BackendWorkItemType)}
                  className="w-full h-[34px] rounded-md border border-white/[0.08] bg-[#14151b] px-2.5 text-xs text-zinc-200 focus:border-indigo-500/70 focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="TASK">Task</option>
                  <option value="INCIDENT">Incident</option>
                  <option value="BUG">Bug</option>
                  <option value="OPS">Ops</option>
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label htmlFor="item-priority" className="block text-[11px] font-medium text-zinc-400">
                  Priority
                </label>
                <select
                  id="item-priority"
                  disabled={isSubmitting}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as BackendWorkItemPriority)}
                  className="w-full h-[34px] rounded-md border border-white/[0.08] bg-[#14151b] px-2.5 text-xs text-zinc-200 focus:border-indigo-500/70 focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="URGENT">Urgent (P0)</option>
                  <option value="HIGH">High (P1)</option>
                  <option value="MEDIUM">Medium (P2)</option>
                  <option value="LOW">Low (P3)</option>
                </select>
              </div>

              {/* System Area */}
              <div className="space-y-1">
                <label htmlFor="item-system-area" className="block text-[11px] font-medium text-zinc-400">
                  System Area
                </label>
                <input
                  id="item-system-area"
                  required
                  disabled={isSubmitting}
                  value={systemArea}
                  onChange={(e) => setSystemArea(e.target.value)}
                  placeholder="Core Engine"
                  className="w-full h-[34px] rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/70 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Group 3: Scheduling & Team Workspace */}
          <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Workspace & Scheduling
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Assigned Team */}
              <div className="space-y-1">
                <label htmlFor="item-team" className="block text-[11px] font-medium text-zinc-400">
                  Assigned Team Workspace <span className="text-rose-400">*</span>
                </label>
                <select
                  id="item-team"
                  disabled={isSubmitting}
                  value={teamId}
                  onChange={(e) => setUserChosenTeamId(e.target.value)}
                  className="w-full h-[34px] rounded-md border border-white/[0.08] bg-[#14151b] px-2.5 text-xs text-zinc-200 focus:border-indigo-500/70 focus:outline-none cursor-pointer disabled:opacity-50"
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

              {/* Target Due Date */}
              <div className="space-y-1">
                <label htmlFor="item-due-date" className="block text-[11px] font-medium text-zinc-400">
                  Target Due Date
                </label>
                <input
                  id="item-due-date"
                  type="date"
                  disabled={isSubmitting}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-[34px] rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 text-xs text-zinc-200 focus:border-indigo-500/70 focus:outline-none cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[200px]" title={`Idempotency Key: ${idempotencyKey}`}>
              Idempotency: {idempotencyKey.slice(0, 8)}…
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={handleDismiss}
                className="text-xs text-zinc-400 hover:text-zinc-200 h-8 px-3 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3.5 h-8 gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
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
