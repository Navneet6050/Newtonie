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
import { motion } from "motion/react"

let queueIntroPlayed = false

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

  React.useEffect(() => {
    if (items.length > 0) queueIntroPlayed = true
  }, [items.length])

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

  const getTypeBadge = (type: BackendWorkItemType) => {
    switch (type) {
      case "INCIDENT":
        return (
          <span className="rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase">
            INCIDENT
          </span>
        )
      case "BUG":
        return (
          <span className="rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase">
            BUG
          </span>
        )
      case "OPS":
        return (
          <span className="rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase">
            OPS
          </span>
        )
      case "TASK":
      default:
        return (
          <span className="rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase">
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
          <div className="flex items-center gap-1.5 text-[11px] text-rose-400 font-medium" title="Priority: Urgent (P0)">
            <span className="relative inline-flex">
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40 [animation-duration:2.4s] motion-reduce:animate-none" />
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-rose-500 shrink-0">
                <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 4.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 6.75a.875.875 0 100-1.75.875.875 0 000 1.75z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="font-medium text-rose-400">Urgent</span>
          </div>
        )
      case "HIGH":
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium" title="Priority: High (P1)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-amber-500 shrink-0">
              <rect x="2" y="9" width="3" height="5" rx="0.5" />
              <rect x="6.5" y="6" width="3" height="8" rx="0.5" />
              <rect x="11" y="3" width="3" height="11" rx="0.5" />
            </svg>
            <span className="font-medium text-amber-400">High</span>
          </div>
        )
      case "MEDIUM":
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-300" title="Priority: Medium (P2)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-zinc-400 shrink-0">
              <rect x="2" y="9" width="3" height="5" rx="0.5" />
              <rect x="6.5" y="6" width="3" height="8" rx="0.5" />
              <rect x="11" y="3" width="3" height="11" rx="0.5" fill="currentColor" opacity="0.2" />
            </svg>
            <span className="text-zinc-300">Medium</span>
          </div>
        )
      case "LOW":
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400" title="Priority: Low (P3)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-zinc-400 shrink-0">
              <rect x="2" y="9" width="3" height="5" rx="0.5" />
              <rect x="6.5" y="6" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.2" />
              <rect x="11" y="3" width="3" height="11" rx="0.5" fill="currentColor" opacity="0.2" />
            </svg>
            <span className="text-zinc-400">Low</span>
          </div>
        )
    }
  }

  const formatDueDate = (iso?: string | null) => {
    if (!iso) return "—"
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
        className="rounded-lg border border-white/[0.07] bg-[#090a0d] shadow-xs overflow-hidden"
      >
        {/* Section Header & View Controls */}
        <div className="flex flex-col gap-2.5 p-3 sm:px-3.5 sm:py-2.5 border-b border-white/[0.06] bg-[#0b0c0f]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Title & Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 mr-2">
                <h2
                  id="work-queue-heading"
                  className="text-[13px] font-semibold tracking-tight text-zinc-100"
                >
                  {activeNav === "my_work" ? "My Assigned Issues" : "Active Operations Queue"}
                </h2>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.2 text-[10px] font-mono text-zinc-400 tabular-nums">
                  {totalElements}
                </span>
              </div>

              {/* Linear-Style View Filter Tabs */}
              <div className="inline-flex items-center rounded-md border border-white/[0.06] bg-black/40 p-0.5 text-[11px] select-none">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("all")
                    setPage(0)
                  }}
                  className={cn(
                    "relative rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                    activeFilter === "all"
                      ? "text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {activeFilter === "all" && (
                    <motion.span
                      layoutId="queue-filter-pill"
                      className="absolute inset-0 rounded-md bg-white/[0.08]"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10">All</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("high_priority")
                    setPage(0)
                  }}
                  className={cn(
                    "relative rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                    activeFilter === "high_priority"
                      ? "text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {activeFilter === "high_priority" && (
                    <motion.span
                      layoutId="queue-filter-pill"
                      className="absolute inset-0 rounded-md bg-white/[0.08]"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10">Urgent & High</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("in_progress")
                    setPage(0)
                  }}
                  className={cn(
                    "relative rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                    activeFilter === "in_progress"
                      ? "text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {activeFilter === "in_progress" && (
                    <motion.span
                      layoutId="queue-filter-pill"
                      className="absolute inset-0 rounded-md bg-white/[0.08]"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10">In Progress</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("review_needed")
                    setPage(0)
                  }}
                  className={cn(
                    "relative rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                    activeFilter === "review_needed"
                      ? "text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {activeFilter === "review_needed" && (
                    <motion.span
                      layoutId="queue-filter-pill"
                      className="absolute inset-0 rounded-md bg-white/[0.08]"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10">Review Needed</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("blocked")
                    setPage(0)
                  }}
                  className={cn(
                    "relative rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                    activeFilter === "blocked"
                      ? "text-rose-300"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {activeFilter === "blocked" && (
                    <motion.span
                      layoutId="queue-filter-pill"
                      className="absolute inset-0 rounded-md bg-white/[0.08]"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10">Blocked</span>
                </button>
              </div>
            </div>

            {/* Right: Quick Search & Create */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter queue…"
                  className="h-7 w-36 sm:w-44 rounded-md border border-white/[0.07] bg-white/[0.02] pl-6.5 pr-6 text-[11px] text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                    aria-label="Clear filter"
                  >
                    <X className="size-2.5" />
                  </button>
                )}
              </div>

              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="h-7 gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] px-2.5 rounded-md cursor-pointer shadow-xs"
              >
                <Plus className="size-3" />
                <span>New</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="m-3 flex items-center justify-between rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-3.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadQueue}
              className="text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 gap-1 h-6 px-2"
            >
              <RotateCw className="size-3" /> Retry
            </Button>
          </div>
        )}

        {/* Table Content */}
        {isLoading ? (
          <div className="divide-y divide-white/[0.03]">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3.5 py-2.5 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="h-3.5 w-14 bg-zinc-800 rounded" />
                  <div className="h-3.5 w-48 sm:w-80 bg-zinc-800 rounded" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-3.5 w-16 bg-zinc-800 rounded hidden sm:block" />
                  <div className="h-3.5 w-20 bg-zinc-800 rounded" />
                  <div className="h-5 w-5 rounded-full bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Lock className="size-4" />
            </div>
            <h3 className="mt-3 text-xs font-semibold text-zinc-100">
              Authentication Required
            </h3>
            <p className="mt-1 text-[11px] text-zinc-400 max-w-sm">
              Work items are protected by server-enforced team authorization.
            </p>
            <Button
              size="sm"
              onClick={() => setShowLoginModal(true)}
              className="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 h-7 cursor-pointer"
            >
              Sign In
            </Button>
          </div>
        ) : items.length > 0 ? (
          <div>
            {/* Desktop Column Header */}
            <div className="hidden sm:grid grid-cols-[88px_1fr_135px_100px_110px_36px] items-center border-b border-white/[0.05] py-2 px-3.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 select-none">
              <span>Issue Key</span>
              <span>Title & Details</span>
              <span>Status</span>
              <span>Priority</span>
              <span>Assignee</span>
              <span className="text-right"><span className="sr-only">Actions</span></span>
            </div>

            {/* List Rows */}
            <div className="divide-y divide-white/[0.03]">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  onClick={() => openItemDetails(item.id)}
                  initial={queueIntroPlayed ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut", delay: Math.min(index, 10) * 0.035 }}
                  className="group flex flex-col sm:grid sm:grid-cols-[88px_1fr_135px_100px_110px_36px] items-start sm:items-center py-2.5 px-3.5 hover:bg-white/[0.025] transition-colors cursor-pointer select-none"
                >
                  {/* Issue Key / Tracking Number */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleCopyId(e, item.trackingNumber)}
                      className="font-mono text-[11px] font-semibold text-zinc-400 hover:text-indigo-400 transition-colors"
                      title="Click to copy tracking number"
                    >
                      {copiedId === item.trackingNumber ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Check className="size-3" />
                        </span>
                      ) : (
                        item.trackingNumber
                      )}
                    </button>
                  </div>

                  {/* Title & Metadata Badges */}
                  <div className="flex items-center gap-2 min-w-0 pr-2 my-1 sm:my-0">
                    <span className="text-[13px] font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                      {item.title}
                    </span>
                    {getTypeBadge(item.type)}
                    {item.team && (
                      <span className="hidden md:inline rounded bg-white/[0.03] text-zinc-400 px-1.5 py-0.5 text-[10px] border border-white/[0.05]">
                        {item.team.name}
                      </span>
                    )}
                    <span className="hidden lg:inline text-[11px] text-zinc-400">
                      · {item.systemArea} {item.dueDate ? `· Due ${formatDueDate(item.dueDate)}` : ""}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="shrink-0">{getStatusBadge(item.status)}</div>

                  {/* Priority */}
                  <div className="shrink-0">{getPriorityIndicator(item.priority)}</div>

                  {/* Assignee / Claim */}
                  <div className="shrink-0 min-w-0">
                    {item.assignee ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar size="sm" className="size-5 border border-white/[0.1] shrink-0">
                          <AvatarFallback className="bg-zinc-800 text-[9px] text-zinc-300 font-medium">
                            {item.assignee.avatarInitials ||
                              item.assignee.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] text-zinc-300 truncate">
                          {item.assignee.name.split(" ")[0]}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={claimingId === item.id}
                        onClick={(e) => handleClaim(e, item)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white cursor-pointer disabled:opacity-50"
                      >
                        {claimingId === item.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <UserCheck className="size-3" />
                        )}
                        <span>Claim</span>
                      </button>
                    )}
                  </div>

                  {/* Action Menu */}
                  <div className="flex justify-end shrink-0" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex size-7 items-center justify-center rounded-md text-white/45 transition hover:bg-white/[0.08] hover:text-white"
                          aria-label={`Actions for ${item.trackingNumber}`}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-44 border-white/[0.08] bg-[#121316] text-zinc-200 shadow-2xl p-1"
                      >
                        <DropdownMenuLabel className="text-[10px] font-mono uppercase text-zinc-400 px-2 py-1">
                          {item.trackingNumber}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/[0.06]" />
                        <DropdownMenuItem
                          onClick={(e) => handleCopyId(e, item.trackingNumber)}
                          className="text-xs cursor-pointer rounded px-2 py-1.5 hover:bg-white/[0.05]"
                        >
                          <Copy className="mr-2 size-3 text-zinc-400" />
                          <span>Copy Tracking #</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openItemDetails(item.id)}
                          className="text-xs cursor-pointer rounded px-2 py-1.5 hover:bg-white/[0.05]"
                        >
                          <ArrowRight className="mr-2 size-3 text-indigo-400" />
                          <span>Open Details</span>
                        </DropdownMenuItem>
                        {!item.assignee && (
                          <DropdownMenuItem
                            onClick={(e) => handleClaim(e, item)}
                            className="text-xs cursor-pointer rounded px-2 py-1.5 hover:bg-white/[0.05] text-indigo-300"
                          >
                            <UserCheck className="mr-2 size-3" />
                            <span>Claim to Me</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-zinc-400">
              <Inbox className="size-4" />
            </div>
            <h3 className="mt-3 text-xs font-medium text-zinc-200">
              No work items match filter
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-400 max-w-sm">
              {searchQuery
                ? `No items match "${searchQuery}".`
                : `There are currently no items in this filter view.`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveFilter("all")
                setSearchQuery("")
                setPage(0)
              }}
              className="mt-3 border-white/[0.08] bg-zinc-900 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer h-7"
            >
              Reset filter
            </Button>
          </div>
        )}

        {/* Pagination Footer */}
        {isAuthenticated && totalElements > 0 && (
          <div className="flex items-center justify-between border-t border-white/[0.05] px-3.5 py-2 text-[11px] text-zinc-400 bg-[#090a0d]">
            <span>
              Showing <span className="text-zinc-200 font-mono font-medium">{page * 10 + 1}–{Math.min((page + 1) * 10, totalElements)}</span> of <span className="text-zinc-200 font-mono font-medium">{totalElements}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 text-[10px] font-mono mr-1">
                Page {page + 1}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-xs"
                disabled={page <= 0 || isLoading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="size-6 border-white/[0.08] bg-white/[0.02] text-zinc-300 disabled:opacity-30 rounded cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3" />
              </Button>
              <Button
                variant="outline"
                size="icon-xs"
                disabled={page >= totalPages - 1 || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="size-6 border-white/[0.08] bg-white/[0.02] text-zinc-300 disabled:opacity-30 rounded cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="size-3" />
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
