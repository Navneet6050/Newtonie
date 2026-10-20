"use client"

import * as React from "react"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  GitCommit,
  MessageSquare,
  PlusCircle,
  RotateCw,
  User,
  UserCheck,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useDashboard } from "@/components/dashboard/dashboard-shell"
import { useAuth } from "@/lib/auth-context"
import {
  type BackendActivityLog,
  type BackendPagedResponse,
  type BackendTeam,
  fetchActivityFeed,
  fetchTeams,
} from "@/lib/api"
import { cn } from "cn"

export function ActivityView() {
  const { user } = useAuth()
  const { selectedTeamId, openItemDetails, refreshKey } = useDashboard()

  const [feed, setFeed] = React.useState<BackendPagedResponse<BackendActivityLog> | null>(null)
  const [teams, setTeams] = React.useState<BackendTeam[]>([])
  const [userTeamFilter, setUserTeamFilter] = React.useState<string | undefined | null>(null)
  const [prevSelectedTeamId, setPrevSelectedTeamId] = React.useState(selectedTeamId)
  const [page, setPage] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  if (selectedTeamId !== prevSelectedTeamId) {
    setPrevSelectedTeamId(selectedTeamId)
    setUserTeamFilter(null)
    setPage(0)
  }

  const activeTeamFilter = userTeamFilter !== null ? userTeamFilter : selectedTeamId

  // Load available teams for the filter selector
  React.useEffect(() => {
    let isMounted = true
    fetchTeams()
      .then((data) => {
        if (isMounted) setTeams(data)
      })
      .catch(() => {
        // Fallback gracefully; teams might not be essential if user is scoped
      })
    return () => {
      isMounted = false
    }
  }, [refreshKey])

  const handleRefresh = React.useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchActivityFeed(activeTeamFilter, page, 20)
      .then((data) => {
        setFeed(data)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load operational activity feed.")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [activeTeamFilter, page])

  React.useEffect(() => {
    let isMounted = true
    fetchActivityFeed(activeTeamFilter, page, 20)
      .then((data) => {
        if (isMounted) {
          setFeed(data)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load operational activity feed.")
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [activeTeamFilter, page, refreshKey])

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMins < 1) return "just now"
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`

      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  const getActionBadge = (actionType: string) => {
    const act = actionType.toUpperCase()
    if (act === "CREATED") {
      return {
        label: "Created",
        icon: PlusCircle,
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      }
    }
    if (act === "STATUS_CHANGED") {
      return {
        label: "Status Changed",
        icon: GitCommit,
        className: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
      }
    }
    if (act === "CLAIMED") {
      return {
        label: "Claimed",
        icon: UserCheck,
        className: "bg-amber-500/10 text-amber-300 border-amber-500/20",
      }
    }
    if (act === "ASSIGNED") {
      return {
        label: "Assigned",
        icon: User,
        className: "bg-purple-500/10 text-purple-300 border-purple-500/20",
      }
    }
    if (act === "COMMENT_ADDED") {
      return {
        label: "Comment",
        icon: MessageSquare,
        className: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
      }
    }
    return {
      label: actionType,
      icon: Activity,
      className: "bg-white/[0.04] text-zinc-300 border-white/[0.08]",
    }
  }

  const formatActionDescription = (log: BackendActivityLog) => {
    const actorName = log.actor?.name || "System Process"
    const act = log.actionType.toUpperCase()

    if (act === "CREATED") {
      return (
        <span>
          <strong className="text-zinc-200 font-medium">{actorName}</strong> created this work item
        </span>
      )
    }
    if (act === "STATUS_CHANGED") {
      return (
        <span>
          <strong className="text-zinc-200 font-medium">{actorName}</strong> changed status
        </span>
      )
    }
    if (act === "CLAIMED") {
      return (
        <span>
          <strong className="text-zinc-200 font-medium">{actorName}</strong> claimed ownership
        </span>
      )
    }
    if (act === "ASSIGNED") {
      return (
        <span>
          <strong className="text-zinc-200 font-medium">{actorName}</strong> updated assignment
        </span>
      )
    }
    if (act === "COMMENT_ADDED") {
      return (
        <span>
          <strong className="text-zinc-200 font-medium">{actorName}</strong> added an operational update
        </span>
      )
    }
    return (
      <span>
        <strong className="text-zinc-200 font-medium">{actorName}</strong> performed {log.actionType}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <section
        aria-labelledby="activity-feed-heading"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.05] pb-3"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1
              id="activity-feed-heading"
              className="text-base sm:text-lg font-semibold tracking-tight text-zinc-100"
            >
              Operational Activity
            </h1>
            <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/20 font-mono">
              {isLoading ? "…" : `${feed?.totalElements ?? 0} Events`}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Real-time persisted audit trail of operational incidents, state shifts, and assignments.
          </p>
        </div>

        {/* Team Scope Filter & Refresh */}
        <div className="flex items-center gap-2">
          {teams.length > 1 && (
            <div className="relative">
              <select
                value={activeTeamFilter || ""}
                onChange={(e) => {
                  setUserTeamFilter(e.target.value ? e.target.value : undefined)
                  setPage(0)
                }}
                className="appearance-none rounded-lg border border-white/[0.08] bg-[#111114] pl-2.5 pr-8 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500/60 font-mono cursor-pointer"
                aria-label="Filter activity by team"
              >
                <option value="">All Scoped Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Filter className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-400" />
            </div>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex size-7.5 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Refresh activity feed"
            title="Refresh feed"
          >
            <RotateCw className={cn("size-3.5", isLoading && "animate-spin")} />
          </button>
        </div>
      </section>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="underline hover:text-rose-200 inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <RotateCw className="size-3" /> Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111114]/90 divide-y divide-white/[0.04]">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="p-4 space-y-2 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-full bg-white/[0.06]" />
                  <div className="h-4 w-32 rounded bg-white/[0.04]" />
                  <div className="h-4 w-20 rounded bg-white/[0.04]" />
                </div>
                <div className="h-3 w-16 rounded bg-white/[0.03]" />
              </div>
              <div className="h-4 w-48 rounded bg-white/[0.03] ml-8" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && (!feed || feed.content.length === 0) && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111114]/90 p-8 text-center space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-zinc-400">
            <Activity className="size-6 text-indigo-400" />
          </div>
          <h2 className="text-sm font-medium text-zinc-200">No Activity Recorded</h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {activeTeamFilter
              ? "No operational audit events have been logged for this team yet."
              : "No operational activity recorded across your authorized teams. Work-item updates, assignments, and claims will appear here in real time."}
          </p>
          {activeTeamFilter && (
            <button
              type="button"
              onClick={() => {
                setUserTeamFilter(undefined)
                setPage(0)
              }}
              className="mt-2 inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              View All Scoped Activity
            </button>
          )}
        </div>
      )}

      {/* Activity Timeline List */}
      {!isLoading && !error && feed && feed.content.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111114]/90 overflow-hidden divide-y divide-white/[0.04]">
          {feed.content.map((log) => {
            const badge = getActionBadge(log.actionType)
            const BadgeIcon = badge.icon
            const isSelf = log.actor?.id === user?.id

            return (
              <div
                key={log.id}
                className="p-3.5 sm:p-4 hover:bg-white/[0.01] transition-colors space-y-2 text-xs"
              >
                {/* Top Row: Actor, Action Pill, Work Item Badge, Timestamp */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Avatar size="sm" className="size-5.5 border border-white/[0.1]">
                      <AvatarFallback className="bg-indigo-950/80 text-indigo-300 text-[9px] font-semibold">
                        {log.actor?.avatarInitials ||
                          log.actor?.name?.slice(0, 2).toUpperCase() ||
                          "SYS"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-zinc-200">{log.actor?.name || "System"}</span>
                      {isSelf && (
                        <span className="text-[9px] font-mono text-indigo-400">(You)</span>
                      )}
                      <span className="text-zinc-500">•</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border font-mono",
                          badge.className
                        )}
                      >
                        <BadgeIcon className="size-2.5" />
                        {badge.label}
                      </span>
                    </div>

                    {/* Linked Work Item Button */}
                    <button
                      type="button"
                      onClick={() => openItemDetails(log.workItemId)}
                      className="group inline-flex items-center gap-1 rounded bg-white/[0.03] hover:bg-indigo-500/10 px-2 py-0.5 text-[11px] font-mono text-indigo-300 border border-white/[0.06] hover:border-indigo-500/30 transition-colors cursor-pointer"
                      title={log.workItemTitle ? `View ${log.workItemTitle}` : "Open work item details"}
                    >
                      <span>{log.trackingNumber || "NEW-ITEM"}</span>
                      <ExternalLink className="size-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>

                  <time
                    dateTime={log.timestamp}
                    title={new Date(log.timestamp).toLocaleString()}
                    className="text-[10px] font-mono text-zinc-400 shrink-0 select-none"
                  >
                    {formatTimestamp(log.timestamp)}
                  </time>
                </div>

                {/* Second Row: Detailed Description & Work Item Title */}
                <div className="pl-7 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap text-zinc-300">
                    {formatActionDescription(log)}
                    {log.workItemTitle && (
                      <span className="text-zinc-400 text-xs truncate max-w-md hidden sm:inline">
                        — {log.workItemTitle}
                      </span>
                    )}
                  </div>

                  {/* Transition indicator (fromValue -> toValue) */}
                  {(log.fromValue || log.toValue) && (
                    <div className="inline-flex items-center gap-1.5 rounded border border-white/[0.04] bg-white/[0.02] px-2 py-0.5 text-[11px] font-mono text-zinc-300">
                      {log.fieldName && (
                        <span className="text-zinc-400">{log.fieldName}:</span>
                      )}
                      <span className="text-zinc-400">{log.fromValue || "none"}</span>
                      <ArrowRight className="size-3 text-zinc-600" />
                      <span className="text-indigo-300 font-medium">{log.toValue || "none"}</span>
                    </div>
                  )}

                  {/* Metadata Note */}
                  {log.metadata && (
                    <p className="text-[11px] text-zinc-400 italic bg-white/[0.01] border-l-2 border-indigo-500/30 pl-2 py-0.5 rounded-r">
                      &ldquo;{log.metadata}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {/* Pagination Controls Footer */}
          {feed.totalPages > 1 && (
            <div className="p-3 border-t border-white/[0.05] flex items-center justify-between text-xs text-zinc-400">
              <span className="font-mono text-[11px]">
                Page {feed.page + 1} of {feed.totalPages} ({feed.totalElements} total)
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={feed.first || isLoading}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={feed.last || isLoading}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
