"use client"

import * as React from "react"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  History,
  Loader2,
  UserCheck,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  type BackendActivityLog,
  type BackendWorkItem,
  type BackendWorkItemStatus,
  claimWorkItem,
  fetchActivityHistory,
  getWorkItem,
  updateWorkItem,
} from "@/lib/api"

interface WorkItemDrawerProps {
  itemId: string | null
  isOpen: boolean
  onClose: () => void
  onItemUpdated: () => void
}

export function WorkItemDrawer({
  itemId,
  isOpen,
  onClose,
  onItemUpdated,
}: WorkItemDrawerProps) {
  const [item, setItem] = React.useState<BackendWorkItem | null>(null)
  const [activityLogs, setActivityLogs] = React.useState<BackendActivityLog[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isMutating, setIsMutating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const loadData = React.useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const [fetchedItem, fetchedLogs] = await Promise.all([
        getWorkItem(id),
        fetchActivityHistory(id, 0, 50).catch(() => ({ content: [] as BackendActivityLog[] })),
      ])
      setItem(fetchedItem)
      setActivityLogs(fetchedLogs.content || [])
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Failed to load work item.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!isOpen || !itemId) {
      return
    }

    let isMounted = true
    Promise.all([
      getWorkItem(itemId),
      fetchActivityHistory(itemId, 0, 50).catch(() => ({ content: [] as BackendActivityLog[] })),
    ])
      .then(([fetchedItem, fetchedLogs]) => {
        if (!isMounted) return
        setItem(fetchedItem)
        setActivityLogs(fetchedLogs.content || [])
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : "Failed to load work item.")
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, itemId])

  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCopyTrackingNumber = () => {
    if (item?.trackingNumber && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(item.trackingNumber).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClaim = async () => {
    if (!item) return
    setIsMutating(true)
    setError(null)
    try {
      const claimed = await claimWorkItem(item.id)
      setItem(claimed)
      onItemUpdated()
      await loadData(item.id)
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (
          err.message.includes("409") ||
          err.message.toLowerCase().includes("conflict") ||
          err.message.toLowerCase().includes("already assigned")
        ) {
          setError("Claim conflict: Item was claimed or updated concurrently. Reloading latest state...")
          await loadData(item.id)
        } else {
          setError(err.message)
        }
      } else {
        setError("Failed to claim work item.")
      }
    } finally {
      setIsMutating(false)
    }
  }

  const handleTransition = async (targetStatus: BackendWorkItemStatus) => {
    if (!item) return
    setIsMutating(true)
    setError(null)
    try {
      const updated = await updateWorkItem(
        item.id,
        { status: targetStatus, expectedVersion: item.version },
        item.version
      )
      setItem(updated)
      onItemUpdated()
      await loadData(item.id)
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("409") || err.message.toLowerCase().includes("conflict") || err.message.toLowerCase().includes("version")) {
          setError("Version conflict: Item was updated concurrently by another operator. Reloading latest state...")
          await loadData(item.id)
        } else {
          setError(err.message)
        }
      } else {
        setError("Status transition failed.")
      }
    } finally {
      setIsMutating(false)
    }
  }

  // Permitted target transitions per M2/M3 state machine
  const getPermittedTransitions = (status: BackendWorkItemStatus): { target: BackendWorkItemStatus; label: string; variant: "default" | "success" | "warning" | "destructive" }[] => {
    switch (status) {
      case "OPEN":
        return [
          { target: "IN_PROGRESS", label: "Start Work (In Progress)", variant: "default" },
          { target: "BLOCKED", label: "Mark Blocked", variant: "warning" },
        ]
      case "IN_PROGRESS":
        return [
          { target: "REVIEW_NEEDED", label: "Submit for Review", variant: "default" },
          { target: "COMPLETED", label: "Complete Work", variant: "success" },
          { target: "BLOCKED", label: "Mark Blocked", variant: "warning" },
        ]
      case "REVIEW_NEEDED":
        return [
          { target: "IN_PROGRESS", label: "Request Revisions (In Progress)", variant: "default" },
          { target: "COMPLETED", label: "Approve & Complete", variant: "success" },
          { target: "BLOCKED", label: "Mark Blocked", variant: "warning" },
        ]
      case "BLOCKED":
        return [
          { target: "OPEN", label: "Unblock to Open", variant: "default" },
          { target: "IN_PROGRESS", label: "Resume In Progress", variant: "default" },
          { target: "REVIEW_NEEDED", label: "Move to Review", variant: "default" },
        ]
      case "COMPLETED":
        return [] // Terminal state
    }
  }

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return "—"
    try {
      const d = new Date(iso)
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="drawer-item-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <aside
          aria-label="Work Item Details"
          className="w-screen max-w-lg border-l border-white/[0.08] bg-[#0f0f13] text-zinc-100 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] p-4 bg-zinc-950/40">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-indigo-400">
                {item?.trackingNumber || "Loading..."}
              </span>
              {item && (
                <>
                  <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 border border-white/[0.06]">
                    v{item.version}
                  </span>
                  <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-mono text-indigo-300 border border-indigo-500/20">
                    {item.type}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {item && (
                <button
                  type="button"
                  onClick={handleCopyTrackingNumber}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                  aria-label="Copy tracking number"
                  title="Copy tracking number"
                >
                  <Copy className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                aria-label="Close details"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {copied && (
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 text-center text-xs text-emerald-400 font-medium">
              Tracking number copied to clipboard
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-2">
                <Loader2 className="size-6 animate-spin text-indigo-400" />
                <span className="text-xs">Loading work item details...</span>
              </div>
            ) : error ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <div className="font-semibold">Error</div>
                  <div className="mt-0.5">{error}</div>
                </div>
              </div>
            ) : item ? (
              <>
                {/* Title & Description */}
                <div className="space-y-2">
                  <h2 id="drawer-item-title" className="text-base font-semibold text-zinc-100 leading-snug">
                    {item.title}
                  </h2>
                  <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">
                    {item.description || "No description provided for this work item."}
                  </p>
                </div>

                {/* State Transition Actions */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Status Workflow
                    </span>
                    <span className="text-xs font-mono text-zinc-300">
                      Current: <strong className="text-indigo-400">{item.status}</strong>
                    </span>
                  </div>

                  {item.status === "COMPLETED" ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                      <span>This work item is completed (terminal state).</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {getPermittedTransitions(item.status).map((t) => (
                        <Button
                          key={t.target}
                          size="sm"
                          disabled={isMutating}
                          onClick={() => handleTransition(t.target)}
                          className={`text-xs font-medium cursor-pointer ${
                            t.variant === "success"
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                              : t.variant === "warning"
                              ? "bg-amber-600 hover:bg-amber-500 text-white"
                              : "border border-indigo-500/40 bg-indigo-600/20 text-indigo-200 hover:bg-indigo-600/30"
                          }`}
                        >
                          {isMutating ? (
                            <Loader2 className="size-3 animate-spin mr-1.5" />
                          ) : (
                            <ArrowRight className="size-3 mr-1.5" />
                          )}
                          {t.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Key Attributes Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Assignee Card */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Assignee
                    </span>
                    {item.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar size="sm" className="size-6 border border-white/[0.1]">
                          <AvatarFallback className="bg-zinc-800 text-[10px] text-zinc-300 font-semibold">
                            {item.assignee.avatarInitials || item.assignee.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-zinc-200 truncate">
                          {item.assignee.name}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-zinc-500 italic">Unassigned</span>
                        <Button
                          size="icon-xs"
                          disabled={isMutating}
                          onClick={handleClaim}
                          className="h-6 px-2 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white gap-1"
                        >
                          <UserCheck className="size-3" />
                          Claim
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Priority Card */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Priority
                    </span>
                    <div className="flex items-center gap-1.5 font-medium text-zinc-200">
                      <span
                        className={`size-2 rounded-full ${
                          item.priority === "URGENT"
                            ? "bg-rose-500 animate-pulse"
                            : item.priority === "HIGH"
                            ? "bg-amber-500"
                            : "bg-zinc-500"
                        }`}
                      />
                      <span>{item.priority}</span>
                    </div>
                  </div>

                  {/* Team Card */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Team
                    </span>
                    <div className="font-medium text-zinc-200 truncate">
                      {item.team?.name || "Global / Unassigned"}
                    </div>
                  </div>

                  {/* System Area Card */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      System Area
                    </span>
                    <div className="font-medium text-zinc-200 truncate">{item.systemArea}</div>
                  </div>

                  {/* Reporter Card */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Reporter
                    </span>
                    <div className="font-medium text-zinc-200 truncate">
                      {item.reporter?.name || "System"}
                    </div>
                  </div>

                  {/* Due Date Card */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Due Date
                    </span>
                    <div className="font-medium text-zinc-200 truncate">
                      {formatTimestamp(item.dueDate)}
                    </div>
                  </div>
                </div>

                {/* Audit Trail & Activity Logs */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
                    <History className="size-3.5 text-indigo-400" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      Activity History & Audit Trail ({activityLogs.length})
                    </h2>
                  </div>

                  {activityLogs.length > 0 ? (
                    <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/[0.08]">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="relative text-xs space-y-1">
                          {/* Dot */}
                          <span className="absolute -left-4 top-1.5 size-2 rounded-full bg-indigo-500 ring-2 ring-[#0f0f13]" />

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-zinc-200">
                              {log.actor?.name || "System Process"}
                            </span>
                            <span className="text-zinc-500 font-mono text-[10px]">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <span className="rounded bg-zinc-800 px-1 py-0.2 font-mono text-[10px] text-indigo-300 border border-white/[0.06]">
                              {log.actionType}
                            </span>
                            {log.fieldName && (
                              <span className="text-zinc-500 text-[11px]">
                                field: <strong className="text-zinc-300">{log.fieldName}</strong>
                              </span>
                            )}
                          </div>

                          {(log.fromValue || log.toValue) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 font-mono bg-white/[0.02] px-2 py-1 rounded border border-white/[0.04]">
                              <span className="text-zinc-500">{log.fromValue || "none"}</span>
                              <ArrowRight className="size-3 text-zinc-600" />
                              <span className="text-indigo-300">{log.toValue || "none"}</span>
                            </div>
                          )}

                          {log.metadata && (
                            <p className="text-[11px] text-zinc-400 italic">
                              &ldquo;{log.metadata}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      No activity history recorded yet.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
