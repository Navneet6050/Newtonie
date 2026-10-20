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
  Plus,
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
  type BackendWorkItemType,
  claimWorkItem,
  fetchWorkItems,
} from "@/lib/api"
import { CreateItemDialog } from "@/components/work-items/create-item-dialog"

type FilterType = "all" | "high_priority" | "in_progress" | "review_needed" | "blocked"

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
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)

  // Debounced search to avoid overwhelming backend on fast typing
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchQuery)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(0)
    }, 200)
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
    } else if (activeFilter === "blocked") {
      statusParam = "BLOCKED"
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
    } else if (activeFilter === "blocked") {
      statusParam = "BLOCKED"
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

  const handleClaim = async (e: React.MouseEvent, item: BackendWorkItem) => {
    e.stopPropagation()
    setClaimingId(item.id)
    try {
      const updated = await claimWorkItem(item.id)
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)))
      triggerRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Claim failed."
      setError(msg)
      loadQueue()
    } finally {
      setClaimingId(null)
    }
  }

  const handleCopyId = (e: React.MouseEvent, trackingNumber: string) => {
    e.stopPropagation()
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(trackingNumber).catch(() => {})
      setCopiedId(trackingNumber)
      setTimeout(() => setCopiedId(null), 1800)
    }
  }

  const getStatusBorderClass = (status: BackendWorkItemStatus) => {
    switch (status) {
      case "BLOCKED":
        return "border-l-rose-500 hover:border-l-rose-400"
      case "REVIEW_NEEDED":
        return "border-l-amber-500 hover:border-l-amber-400"
      case "IN_PROGRESS":
        return "border-l-blue-500 hover:border-l-blue-400"
      case "COMPLETED":
        return "border-l-emerald-500 hover:border-l-emerald-400"
      case "OPEN":
      default:
        return "border-l-zinc-600 hover:border-l-zinc-400"
    }
  }

  const getTypeBadge = (type: BackendWorkItemType) => {
    switch (type) {
      case "INCIDENT":
        return (
          <span className="rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase">
            INCIDENT
          </span>
        )
      case "BUG":
        return (
          <span className="rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase">
            BUG
          </span>
        )
      case "OPS":
        return (
          <span className="rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase">
            OPS
          </span>
        )
      case "TASK":
      default:
        return (
          <span className="rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase">
            TASK
          </span>
        )
    }
  }

  const getStatusBadge = (status: BackendWorkItemStatus) => {
    switch (status) {
      case "IN_PROGRESS":
        return (
          <Badge
            variant="outline"
            className="border-blue-500/30 bg-blue-500/10 text-blue-300 font-normal text-[11px] gap-1"
          >
            <Clock className="size-3 text-blue-400" />
            In Progress
          </Badge>
        )
      case "REVIEW_NEEDED":
        return (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-amber-300 font-normal text-[11px] gap-1"
          >
            <AlertCircle className="size-3 text-amber-400" />
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
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-normal text-[11px] gap-1"
          >
            <CheckCircle2 className="size-3 text-emerald-400" />
            Completed
          </Badge>
        )
      case "BLOCKED":
        return (
          <Badge
            variant="outline"
            className="border-rose-500/30 bg-rose-500/10 text-rose-300 font-normal text-[11px] gap-1"
          >
            <Lock className="size-3 text-rose-400" />
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
            <span>Urgent</span>
          </div>
        )
      case "HIGH":
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
            <span className="size-1.5 rounded-full bg-amber-500" />
            <span>High</span>
          </div>
        )
      case "MEDIUM":
        return (
          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
            <span className="size-1.5 rounded-full bg-zinc-500" />
            <span>Medium</span>
          </div>
        )
      case "LOW":
        return (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="size-1.5 rounded-full bg-zinc-700" />
            <span>Low</span>
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
    <>
      <section
        aria-labelledby="work-queue-heading"
        className="surface-elevated rounded-xl p-4 sm:p-5 border border-white/[0.08]"
      >
        {/* Section Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-white/[0.06] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="work-queue-heading"
                className="text-base font-semibold tracking-tight text-zinc-100"
              >
                {activeNav === "my_work" ? "My Assigned Items" : "Live Operations Queue"}
              </h2>
              <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[11px] font-mono text-zinc-400 border border-white/[0.06] tabular-nums">
                {totalElements} items
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              Operations stream scoped to authorized workspace and active permissions.
            </p>
          </div>

          {/* Filters, Search Bar & Quick Add */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracking, title…"
                className="h-8 w-40 rounded-lg border border-white/[0.08] bg-black/40 pl-8 pr-7 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/70 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 sm:w-48 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                  aria-label="Clear filter text"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-black/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("all")
                  setPage(0)
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                  activeFilter === "all"
                    ? "bg-zinc-800 text-zinc-100 shadow-xs"
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
                  "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                  activeFilter === "high_priority"
                    ? "bg-zinc-800 text-zinc-100 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Urgent & High
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("in_progress")
                  setPage(0)
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                  activeFilter === "in_progress"
                    ? "bg-zinc-800 text-zinc-100 shadow-xs"
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
                  "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                  activeFilter === "review_needed"
                    ? "bg-zinc-800 text-zinc-100 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Review Needed
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("blocked")
                  setPage(0)
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                  activeFilter === "blocked"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Blocked
              </button>
            </div>

            {/* Quick Add Button */}
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3 cursor-pointer shadow-xs ml-auto sm:ml-0"
            >
              <Plus className="size-3.5" />
              <span>Create Item</span>
            </Button>
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
          <div className="mt-3 space-y-2">
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
                  <div className="h-4 w-16 bg-zinc-800 rounded hidden sm:block" />
                  <div className="h-4 w-20 bg-zinc-800 rounded" />
                  <div className="h-6 w-6 rounded-full bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : !isAuthenticated ? (
          /* Unauthenticated State */
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Lock className="size-5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-zinc-100">
              Sign In to View Work Queue
            </h3>
            <p className="mt-1 text-xs text-zinc-400 max-w-sm">
              Work items are protected by server-enforced team authorization. Sign in to inspect live queue data.
            </p>
            <Button
              size="sm"
              onClick={() => setShowLoginModal(true)}
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 cursor-pointer"
            >
              Sign In
            </Button>
          </div>
        ) : items.length > 0 ? (
          /* Table Header & Rows */
          <div className="mt-3">
            {/* Desktop Column Header */}
            <div className="hidden sm:flex items-center justify-between border-b border-white/[0.05] pb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 select-none">
              <div className="flex items-center gap-3">
                <span className="w-20 pl-1">Tracking #</span>
                <span>Work Item Details</span>
              </div>
              <div className="flex items-center gap-4 pr-10">
                <span className="w-24">Priority</span>
                <span className="w-28">Status</span>
                <span className="w-32">Assignee</span>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/[0.03]">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openItemDetails(item.id)}
                  className={cn(
                    "group flex flex-col gap-2.5 py-2.5 px-2.5 sm:flex-row sm:items-center sm:justify-between rounded-lg border-l-3 transition-all duration-150 hover:bg-white/[0.03] cursor-pointer",
                    getStatusBorderClass(item.status)
                  )}
                >
                  {/* Left Column: Tracking, Title, Area, Due */}
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
                        <span className="text-sm font-medium text-zinc-100 group-hover:text-white transition-colors truncate">
                          {item.title}
                        </span>
                        {getTypeBadge(item.type)}
                        {item.team && (
                          <span className="rounded bg-indigo-950/40 text-indigo-300/80 px-1.5 py-0.2 text-[10px] font-medium border border-indigo-500/20">
                            {item.team.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-zinc-400 flex-wrap">
                        <span className="text-zinc-300">{item.systemArea}</span>
                        <span className="text-zinc-700">•</span>
                        <span>Due: {formatDueDate(item.dueDate)}</span>
                        <span className="text-zinc-700">•</span>
                        <span className="font-mono text-[10px] text-zinc-500">v{item.version}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Priority, Status, Assignee, Actions */}
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
                          <span className="text-xs text-zinc-300 truncate">
                            {item.assignee.name.split(" ")[0]}
                          </span>
                        </div>
                      ) : (
                        <Button
                          size="icon-xs"
                          disabled={claimingId === item.id}
                          onClick={(e) => handleClaim(e, item)}
                          className="h-6 px-2 text-[11px] bg-indigo-600/80 hover:bg-indigo-600 text-white gap-1 cursor-pointer font-medium"
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

                    {/* Action Dropdown */}
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
          </div>
        ) : (
          /* Empty State */
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
          <div className="mt-3.5 flex items-center justify-between border-t border-white/[0.04] pt-3 text-xs text-zinc-400">
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

      {/* Create Dialog */}
      <CreateItemDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          triggerRefresh()
          loadQueue()
        }}
      />
    </>
  )
}
