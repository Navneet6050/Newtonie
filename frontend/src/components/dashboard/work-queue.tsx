"use client"

import * as React from "react"
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Inbox,
  Loader2,
  Lock,
  MoreHorizontal,
  RotateCw,
  Search,
  UserCheck,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useDashboard } from "./dashboard-shell"
import { useAuth } from "@/lib/auth-context"
import {
  type BackendWorkItem,
  type BackendWorkItemPriority,
  type BackendWorkItemStatus,
  claimWorkItem,
  fetchWorkItems,
} from "@/lib/api"

type FilterType = "all" | "high_priority" | "in_progress" | "review_needed"

export function WorkQueue() {
  const { user, isAuthenticated, setShowLoginModal } = useAuth()
  const {
    searchQuery,
    setSearchQuery,
    openItemDetails,
    triggerRefresh,
    refreshKey,
    selectedTeamId,
    activeNav,
  } = useDashboard()

  const [activeFilter, setActiveFilter] = React.useState<FilterType>("all")
  const [items, setItems] = React.useState<BackendWorkItem[]>([])
  const [page, setPage] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [totalElements, setTotalElements] = React.useState(0)

  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [claimingId, setClaimingId] = React.useState<string | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  // Debounced search to avoid overwhelming backend on fast typing
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchQuery)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(0)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reset pagination when switching teams or navigation tabs
  const [prevTeamId, setPrevTeamId] = React.useState(selectedTeamId)
  const [prevActiveNav, setPrevActiveNav] = React.useState(activeNav)

  if (selectedTeamId !== prevTeamId || activeNav !== prevActiveNav) {
    setPrevTeamId(selectedTeamId)
    setPrevActiveNav(activeNav)
    setPage(0)
  }

  const loadQueue = React.useCallback(() => {
    if (!isAuthenticated) {
      setItems([])
      setTotalElements(0)
      setTotalPages(1)
      return
    }

    setIsLoading(true)
    setError(null)

    let statusParam: BackendWorkItemStatus | undefined = undefined
    let priorityParam: string | undefined = undefined
    if (activeFilter === "in_progress") {
      statusParam = "IN_PROGRESS"
    } else if (activeFilter === "review_needed") {
      statusParam = "REVIEW_NEEDED"
    } else if (activeFilter === "high_priority") {
      priorityParam = "URGENT,HIGH"
    }
    const assigneeParam = activeNav === "my_work" && user ? user.id : undefined

    fetchWorkItems({
      search: debouncedSearch.trim() || undefined,
      status: statusParam,
      priority: priorityParam,
      teamId: selectedTeamId,
      assigneeId: assigneeParam,
      page,
      size: 10,
      sort: "updatedAt,desc",
    })
      .then((res) => {
        setItems(res.content || [])
        setTotalElements(res.totalElements)
        setTotalPages(Math.max(1, res.totalPages))
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to fetch work items queue.")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [isAuthenticated, activeFilter, debouncedSearch, selectedTeamId, activeNav, user, page])

  React.useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    let isMounted = true
    let statusParam: BackendWorkItemStatus | undefined = undefined
    let priorityParam: string | undefined = undefined
    if (activeFilter === "in_progress") {
      statusParam = "IN_PROGRESS"
    } else if (activeFilter === "review_needed") {
      statusParam = "REVIEW_NEEDED"
    } else if (activeFilter === "high_priority") {
      priorityParam = "URGENT,HIGH"
    }
    const assigneeParam = activeNav === "my_work" && user ? user.id : undefined

    fetchWorkItems({
      search: debouncedSearch.trim() || undefined,
      status: statusParam,
      priority: priorityParam,
      teamId: selectedTeamId,
      assigneeId: assigneeParam,
      page,
      size: 10,
      sort: "updatedAt,desc",
    })
      .then((res) => {
        if (!isMounted) return
        setItems(res.content || [])
        setTotalElements(res.totalElements)
        setTotalPages(Math.max(1, res.totalPages))
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : "Failed to fetch work items queue.")
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, activeFilter, debouncedSearch, selectedTeamId, activeNav, user, page, refreshKey])

  const handleCopyId = (e: React.MouseEvent, trackingNumber: string) => {
    e.stopPropagation()
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(trackingNumber).catch(() => {})
    }
    setCopiedId(trackingNumber)
    setTimeout(() => {
      setCopiedId((curr) => (curr === trackingNumber ? null : curr))
    }, 2000)
  }

  const handleClaim = async (e: React.MouseEvent, item: BackendWorkItem) => {
    e.stopPropagation()
    setClaimingId(item.id)
    try {
      await claimWorkItem(item.id)
      triggerRefresh()
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message)
      }
    } finally {
      setClaimingId(null)
    }
  }

  const getStatusBadge = (status: BackendWorkItemStatus) => {
    switch (status) {
      case "IN_PROGRESS":
        return (
          <Badge
            variant="outline"
            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-normal text-[11px]"
          >
            <Clock className="mr-1 size-3 text-indigo-400" />
            In Progress
          </Badge>
        )
      case "REVIEW_NEEDED":
        return (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-amber-300 font-normal text-[11px]"
          >
            <AlertCircle className="mr-1 size-3 text-amber-400" />
            Review Needed
          </Badge>
        )
      case "OPEN":
        return (
          <Badge
            variant="outline"
            className="border-zinc-700 bg-zinc-800/40 text-zinc-400 font-normal text-[11px]"
          >
            Open / To Do
          </Badge>
        )
      case "COMPLETED":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-normal text-[11px]"
          >
            <CheckCircle2 className="mr-1 size-3 text-emerald-400" />
            Completed
          </Badge>
        )
      case "BLOCKED":
        return (
          <Badge
            variant="outline"
            className="border-rose-500/30 bg-rose-500/10 text-rose-300 font-normal text-[11px]"
          >
            <Lock className="mr-1 size-3 text-rose-400" />
            Blocked
          </Badge>
        )
    }
  }

  const getPriorityIndicator = (priority: BackendWorkItemPriority) => {
    switch (priority) {
      case "URGENT":
        return (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
            Urgent
          </div>
        )
      case "HIGH":
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-500" />
            High
          </div>
        )
      case "MEDIUM":
        return (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="size-1.5 rounded-full bg-zinc-500" />
            Medium
          </div>
        )
      case "LOW":
        return (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="size-1.5 rounded-full bg-zinc-600" />
            Low
          </div>
        )
    }
  }

  const formatDueDate = (iso?: string | null) => {
    if (!iso) return "No due date"
    try {
      const d = new Date(iso)
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    } catch {
      return iso
    }
  }

  return (
    <section
      aria-labelledby="work-queue-heading"
      className="rounded-xl border border-white/[0.08] bg-[#111114]/90 p-5 backdrop-blur-sm"
    >
      {/* Section Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="work-queue-heading"
              className="text-base font-semibold tracking-tight text-zinc-100"
            >
              {activeNav === "my_work" ? "My Assigned Items" : "Live Operations Queue"}
            </h2>
            <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[11px] font-mono text-zinc-400 border border-white/[0.06]">
              {totalElements} total
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            {isAuthenticated
              ? "Live backend work items scoped to your authorized teams and role."
              : "Authentication required to stream operations work queue."}
          </p>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tracking, title…"
              className="h-7 w-36 rounded-lg border border-white/[0.08] bg-black/40 pl-7 pr-6 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 sm:w-48"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                aria-label="Clear filter text"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-black/40 p-1">
            <button
              type="button"
              onClick={() => {
                setActiveFilter("all")
                setPage(0)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                activeFilter === "all"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFilter("high_priority")
                setPage(0)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                activeFilter === "high_priority"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              High Priority
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFilter("in_progress")
                setPage(0)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                activeFilter === "in_progress"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              In Progress
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveFilter("review_needed")
                setPage(0)
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                activeFilter === "review_needed"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Review Needed
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadQueue}
            className="text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 gap-1 h-7 px-2"
          >
            <RotateCw className="size-3" /> Retry
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg border border-white/[0.04] bg-white/[0.01] animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="h-4 w-16 bg-zinc-800 rounded" />
                <div className="h-4 w-48 sm:w-72 bg-zinc-800 rounded" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-14 bg-zinc-800 rounded hidden sm:block" />
                <div className="h-4 w-20 bg-zinc-800 rounded" />
                <div className="h-6 w-6 rounded-full bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      ) : !isAuthenticated ? (
        /* Unauthenticated State */
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
            <Lock className="size-5" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-zinc-100">
            Sign In to View Work Queue
          </h3>
          <p className="mt-1 text-xs text-zinc-400 max-w-sm">
            Work items are protected by team boundaries and JWT authentication. Sign in with an operations account to inspect live items.
          </p>
          <Button
            size="sm"
            onClick={() => setShowLoginModal(true)}
            className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 cursor-pointer"
          >
            Open Sign In Dialog
          </Button>
        </div>
      ) : items.length > 0 ? (
        /* Queue Table / Rows */
        <div className="mt-3 divide-y divide-white/[0.04] overflow-x-auto">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => openItemDetails(item.id)}
              className="group flex flex-col gap-3 py-3 px-2 sm:flex-row sm:items-center sm:justify-between rounded-lg transition-colors hover:bg-white/[0.03] cursor-pointer"
            >
              {/* Left Details */}
              <div className="flex items-start gap-3 min-w-0">
                <button
                  type="button"
                  onClick={(e) => handleCopyId(e, item.trackingNumber)}
                  className="shrink-0 font-mono text-xs font-semibold text-indigo-400/90 pt-0.5 hover:text-indigo-300 transition-colors"
                  title="Click to copy tracking number"
                >
                  {copiedId === item.trackingNumber ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="size-3" /> Copied
                    </span>
                  ) : (
                    item.trackingNumber
                  )}
                </button>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                      {item.title}
                    </span>
                    <span className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider text-zinc-400 border border-white/[0.04]">
                      {item.type}
                    </span>
                    {item.team && (
                      <span className="rounded bg-indigo-950/40 text-indigo-300/80 px-1.5 py-0.2 text-[10px] font-medium border border-indigo-500/20">
                        {item.team.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                    <span>{item.systemArea}</span>
                    <span className="text-zinc-700">•</span>
                    <span>Due: {formatDueDate(item.dueDate)}</span>
                    <span className="text-zinc-700">•</span>
                    <span className="font-mono text-[10px] text-zinc-500">v{item.version}</span>
                  </div>
                </div>
              </div>

              {/* Right Attributes */}
              <div className="flex items-center gap-4 shrink-0 sm:self-center pl-7 sm:pl-0">
                <div className="w-24 shrink-0">{getPriorityIndicator(item.priority)}</div>

                <div className="w-28 shrink-0">{getStatusBadge(item.status)}</div>

                {/* Assignee / Claim Button */}
                <div className="w-32 shrink-0">
                  {item.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar size="sm" className="size-6 border border-white/[0.1]">
                        <AvatarFallback className="bg-zinc-800 text-[10px] text-zinc-300 font-medium">
                          {item.assignee.avatarInitials ||
                            item.assignee.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-zinc-400 truncate">
                        {item.assignee.name.split(" ")[0]}
                      </span>
                    </div>
                  ) : (
                    <Button
                      size="icon-xs"
                      disabled={claimingId === item.id}
                      onClick={(e) => handleClaim(e, item)}
                      className="h-6 px-2 text-[11px] bg-indigo-600/80 hover:bg-indigo-600 text-white gap-1 cursor-pointer"
                    >
                      {claimingId === item.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <UserCheck className="size-3" />
                      )}
                      Claim
                    </Button>
                  )}
                </div>

                {/* Actions Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => e.stopPropagation()}
                      className="text-zinc-500 hover:text-zinc-300 focus-visible:ring-1 focus-visible:ring-indigo-500/50"
                      aria-label={`Actions for ${item.trackingNumber}`}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 border-white/[0.08] bg-[#141418] text-zinc-200 shadow-xl"
                  >
                    <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      {item.trackingNumber} Actions
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem
                      onClick={(e) => handleCopyId(e, item.trackingNumber)}
                      className="text-xs cursor-pointer hover:bg-white/[0.05]"
                    >
                      <Copy className="mr-2 size-3.5 text-zinc-400" />
                      <span>Copy Tracking #</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openItemDetails(item.id)}
                      className="text-xs cursor-pointer hover:bg-white/[0.05]"
                    >
                      <ArrowRight className="mr-2 size-3.5 text-indigo-400" />
                      <span>View Details & Audit</span>
                    </DropdownMenuItem>
                    {!item.assignee && (
                      <DropdownMenuItem
                        onClick={(e) => handleClaim(e, item)}
                        className="text-xs cursor-pointer hover:bg-white/[0.05] text-indigo-300"
                      >
                        <UserCheck className="mr-2 size-3.5" />
                        <span>Claim to Myself</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State with Working Reset */
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-900/80 text-zinc-400">
            <Inbox className="size-5" />
          </div>
          <h3 className="mt-3 text-sm font-medium text-zinc-200">
            No work items found
          </h3>
          <p className="mt-1 text-xs text-zinc-400 max-w-sm">
            {searchQuery
              ? `No items match "${searchQuery}" under the active filter.`
              : `There are currently no work items under the active filter.`}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveFilter("all")
              setSearchQuery("")
              setPage(0)
            }}
            className="mt-4 border-white/[0.08] bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
          >
            Reset all filters
          </Button>
        </div>
      )}

      {/* Pagination Footer */}
      {isAuthenticated && totalElements > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-3 text-xs text-zinc-400">
          <span>
            Page {page + 1} of {totalPages} ({totalElements} items total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-xs"
              disabled={page <= 0 || isLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="size-7 border-white/[0.08] bg-white/[0.02] text-zinc-300 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={page >= totalPages - 1 || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="size-7 border-white/[0.08] bg-white/[0.02] text-zinc-300 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
