"use client"

import * as React from "react"
import { AlertCircle, Check, Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
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
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-item-title"
    >
      <div className="relative w-full max-w-lg rounded-xl surface-overlay p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </button>

        {/* Dialog Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
          <div className="flex size-9 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
            <Plus className="size-4" />
          </div>
          <div>
            <h2 id="create-item-title" className="text-base font-semibold text-zinc-100">
              Create Work Item
            </h2>
            <p className="text-xs text-zinc-400">
              Stage a new operational task or incident for your team
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="size-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="item-title" className="font-medium text-zinc-300">
              Title <span className="text-rose-400">*</span>
            </label>
            <Input
              id="item-title"
              required
              minLength={3}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Audit TLS certificate expiration on gateway"
              className="bg-white/[0.03] border-white/[0.08] text-xs text-zinc-200 focus-visible:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="item-description" className="font-medium text-zinc-300">
              Description (Optional)
            </label>
            <textarea
              id="item-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide background, incident symptoms, or reproduction steps..."
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] p-2.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Type & Priority Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="item-type" className="font-medium text-zinc-300">
                Work Item Type
              </label>
              <select
                id="item-type"
                value={type}
                onChange={(e) => setType(e.target.value as BackendWorkItemType)}
                className="w-full rounded-lg border border-white/[0.08] bg-[#17171c] p-2 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="INCIDENT">INCIDENT (Urgent triage)</option>
                <option value="TASK">TASK (Engineering)</option>
                <option value="BUG">BUG (Software defect)</option>
                <option value="OPS">OPS (Infrastructure & Maint)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="item-priority" className="font-medium text-zinc-300">
                Priority
              </label>
              <select
                id="item-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as BackendWorkItemPriority)}
                className="w-full rounded-lg border border-white/[0.08] bg-[#17171c] p-2 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="URGENT">URGENT (P0)</option>
                <option value="HIGH">HIGH (P1)</option>
                <option value="MEDIUM">MEDIUM (P2)</option>
                <option value="LOW">LOW (P3)</option>
              </select>
            </div>
          </div>

          {/* Team & System Area Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="item-team" className="font-medium text-zinc-300">
                Authorized Team <span className="text-rose-400">*</span>
              </label>
              <select
                id="item-team"
                required
                value={teamId}
                onChange={(e) => setUserChosenTeamId(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-[#17171c] p-2 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                {user?.teams && user.teams.length > 0 ? (
                  user.teams.map((t) => (
                    <option key={t.teamId} value={t.teamId}>
                      {t.teamName} ({t.role})
                    </option>
                  ))
                ) : (
                  <option value="">No team membership found</option>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="item-system-area" className="font-medium text-zinc-300">
                System Area
              </label>
              <input
                id="item-system-area"
                required
                value={systemArea}
                onChange={(e) => setSystemArea(e.target.value)}
                placeholder="e.g. Data Pipeline"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <label htmlFor="item-due-date" className="font-medium text-zinc-300">
              Due Date (Optional)
            </label>
            <input
              id="item-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-[#17171c] p-2 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Footer with Idempotency info & Actions */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[200px]">
              Key: {idempotencyKey.slice(0, 13)}...
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Check className="size-3.5" />
                    Create Item
                  </span>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
