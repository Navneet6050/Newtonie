"use client"

import * as React from "react"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Inbox,
  Loader2,
  Lock,
  MoreHorizontal,
  Plus,
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
  type BackendWorkItemType,
  claimWorkItem,
  fetchWorkItems,
} from "@/lib/api"
import { motion } from "motion/react"

let queueIntroPlayed = false

export type StatusFilterType = "all" | "high_priority" | "in_progress" | "review_needed" | "blocked"
export type DateFilterType = "all" | "overdue" | "today" | "next_7_days" | "custom"

export interface CustomDateRange {
  startDate: string // "YYYY-MM-DD"
  endDate: string   // "YYYY-MM-DD"
}

/**
 * Calculates canonical ISO timestamp boundaries based on the user's local calendar dates.
 * Avoids off-by-one errors caused by naive UTC conversions.
 */
function calculateDueDateRange(
  filter: DateFilterType,
  customRange?: CustomDateRange
): { dueDateFrom?: string; dueDateTo?: string } {
  if (filter === "all") {
    return {}
  }

  const now = new Date()
  // Local calendar start of today 00:00:00.000 (inclusive lower bound)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  // Local calendar start of tomorrow 00:00:00.000 (exclusive upper bound for today)
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)

  if (filter === "overdue") {
    // Strictly before start of today: dueDate < startOfToday
    return { dueDateTo: startOfToday.toISOString() }
  }

  if (filter === "today") {
    // Due today: between start of today and start of tomorrow
    return {
      dueDateFrom: startOfToday.toISOString(),
      dueDateTo: startOfTomorrow.toISOString(),
    }
  }

  if (filter === "next_7_days") {
    // 7 calendar days starting today: from start of today to start of (today + 7 days)
    const endOfNext7DaysExclusive = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 0, 0, 0, 0)
    return {
      dueDateFrom: startOfToday.toISOString(),
      dueDateTo: endOfNext7DaysExclusive.toISOString(),
    }
  }

  if (filter === "custom" && customRange?.startDate && customRange?.endDate) {
    const [sYear, sMonth, sDay] = customRange.startDate.split("-").map(Number)
    const customStart = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0)

    // End date inclusive: up to start of the day after endDate (exclusive upper bound)
    const [eYear, eMonth, eDay] = customRange.endDate.split("-").map(Number)
    const customEndExclusive = new Date(eYear, eMonth - 1, eDay + 1, 0, 0, 0, 0)

    if (customStart.getTime() < customEndExclusive.getTime()) {
      return {
        dueDateFrom: customStart.toISOString(),
        dueDateTo: customEndExclusive.toISOString(),
      }
    }
  }

  return {}
}

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
    openCreateItem,
    queueFilter,
    setQueueFilter,
  } = useDashboard()

  const activeFilter = queueFilter ?? "all"
  const setActiveFilter = setQueueFilter
  const [dateFilter, setDateFilter] = React.useState<DateFilterType>("all")
  const [customRange, setCustomRange] = React.useState<CustomDateRange>({ startDate: "", endDate: "" })
  const [customRangeDraft, setCustomRangeDraft] = React.useState<CustomDateRange>({ startDate: "", endDate: "" })
  const [customRangeError, setCustomRangeError] = React.useState<string | null>(null)
  const [isCustomRangeOpen, setIsCustomRangeOpen] = React.useState(false)
  const [isDateMenuOpen, setIsDateMenuOpen] = React.useState(false)

  const [items, setItems] = React.useState<BackendWorkItem[]>([])
  const [page, setPage] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [totalElements, setTotalElements] = React.useState(0)

  React.useEffect(() => {
    if (items.length > 0) queueIntroPlayed = true
  }, [items.length])

  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [claimingId, setClaimingId] = React.useState<string | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  // Debounced search to avoid overwhelming backend on fast typing
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchQuery)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(0)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Track filter/search/page transitions and reset pagination/loading state
  const [prevTeamId, setPrevTeamId] = React.useState(selectedTeamId)
  const [prevActiveNav, setPrevActiveNav] = React.useState(activeNav)
  const [prevFilter, setPrevFilter] = React.useState(activeFilter)
  const [prevPage, setPrevPage] = React.useState(page)
  const [prevDateFilter, setPrevDateFilter] = React.useState(dateFilter)
  const [prevCustomRange, setPrevCustomRange] = React.useState(customRange)
  const [prevDebouncedSearch, setPrevDebouncedSearch] = React.useState(debouncedSearch)
  const [prevRefreshKey, setPrevRefreshKey] = React.useState(refreshKey)

  if (
    selectedTeamId !== prevTeamId ||
    activeNav !== prevActiveNav ||
    activeFilter !== prevFilter ||
    page !== prevPage ||
    dateFilter !== prevDateFilter ||
    customRange !== prevCustomRange ||
    debouncedSearch !== prevDebouncedSearch ||
    refreshKey !== prevRefreshKey
  ) {
    if (selectedTeamId !== prevTeamId || activeNav !== prevActiveNav || activeFilter !== prevFilter) {
      setPage(0)
    }
    setPrevTeamId(selectedTeamId)
    setPrevActiveNav(activeNav)
    setPrevFilter(activeFilter)
    setPrevPage(page)
    setPrevDateFilter(dateFilter)
    setPrevCustomRange(customRange)
    setPrevDebouncedSearch(debouncedSearch)
    setPrevRefreshKey(refreshKey)
    setIsLoading(true)
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
    const { dueDateFrom, dueDateTo } = calculateDueDateRange(dateFilter, customRange)

    fetchWorkItems({
      search: debouncedSearch.trim() || undefined,
      status: statusParam,
      priority: priorityParam,
      teamId: selectedTeamId,
      assigneeId: assigneeParam,
      dueDateFrom,
      dueDateTo,
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
  }, [isAuthenticated, activeFilter, dateFilter, customRange, debouncedSearch, selectedTeamId, activeNav, user, page])

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
    const { dueDateFrom, dueDateTo } = calculateDueDateRange(dateFilter, customRange)

    fetchWorkItems({
      search: debouncedSearch.trim() || undefined,
      status: statusParam,
      priority: priorityParam,
      teamId: selectedTeamId,
      assigneeId: assigneeParam,
      dueDateFrom,
      dueDateTo,
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
  }, [isAuthenticated, activeFilter, dateFilter, customRange, debouncedSearch, selectedTeamId, activeNav, user, page, refreshKey])

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
          <span className="rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            INCIDENT
          </span>
        )
      case "BUG":
        return (
          <span className="rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            BUG
          </span>
        )
      case "OPS":
        return (
          <span className="rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            OPS
          </span>
        )
      case "TASK":
      default:
        return (
          <span className="rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
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
            className="border-blue-500/30 bg-blue-500/10 text-blue-300 font-normal text-[11px] gap-1 px-2 py-0.5"
          >
            <Clock className="size-3 text-blue-400" />
            In Progress
          </Badge>
        )
      case "REVIEW_NEEDED":
        return (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-amber-300 font-normal text-[11px] gap-1 px-2 py-0.5"
          >
            <AlertCircle className="size-3 text-amber-400" />
            Review Needed
          </Badge>
        )
      case "OPEN":
        return (
          <Badge
            variant="outline"
            className="border-zinc-700 bg-zinc-800/40 text-zinc-400 font-normal text-[11px] px-2 py-0.5"
          >
            Open / To Do
          </Badge>
        )
      case "COMPLETED":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-normal text-[11px] gap-1 px-2 py-0.5"
          >
            <CheckCircle2 className="size-3 text-emerald-400" />
            Completed
          </Badge>
        )
      case "BLOCKED":
        return (
          <Badge
            variant="outline"
            className="border-rose-500/30 bg-rose-500/10 text-rose-300 font-normal text-[11px] gap-1 px-2 py-0.5"
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

  const renderDueDateBadge = (iso?: string | null) => {
    if (!iso) return null
    try {
      const dueDate = new Date(iso)
      if (isNaN(dueDate.getTime())) return null

      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
      const formattedDate = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })

      if (dueDate.getTime() < startOfToday.getTime()) {
        return (
          <span
            className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-400 border border-rose-500/20"
            title={`Overdue: was due on ${dueDate.toLocaleDateString()}`}
          >
            <AlertCircle className="size-2.5 text-rose-400 shrink-0" />
            <span>Due {formattedDate}</span>
          </span>
        )
      }

      if (dueDate.getTime() < startOfTomorrow.getTime()) {
        return (
          <span
            className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/20"
            title="Due today"
          >
            <Clock className="size-2.5 text-amber-400 shrink-0" />
            <span>Due Today</span>
          </span>
        )
      }

      return (
        <span
          className="inline-flex items-center gap-1 rounded bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-zinc-400 border border-white/[0.06]"
          title={`Due on ${dueDate.toLocaleDateString()}`}
        >
          <Calendar className="size-2.5 text-zinc-500 shrink-0" />
          <span>Due {formattedDate}</span>
        </span>
      )
    } catch {
      return null
    }
  }

  const getDateFilterButtonLabel = () => {
    switch (dateFilter) {
      case "overdue":
        return "Due: Overdue"
      case "today":
        return "Due: Today"
      case "next_7_days":
        return "Due: Next 7 Days"
      case "custom":
        if (customRange.startDate && customRange.endDate) {
          return `Due: ${customRange.startDate} → ${customRange.endDate}`
        }
        return "Due: Custom Range"
      case "all":
      default:
        return "All Dates"
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
            {/* Title, Status Filter Tabs, & Due Date Filter */}
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

              {/* Status / Priority Filter Tabs */}
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

              {/* Compact Due Date Filter Control */}
              <DropdownMenu open={isDateMenuOpen} onOpenChange={setIsDateMenuOpen}>
                <div className="inline-flex items-center rounded-md border border-white/[0.07] bg-black/40 text-[11px] overflow-hidden">
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 font-medium transition-colors cursor-pointer select-none",
                        dateFilter !== "all"
                          ? "bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                      )}
                      aria-label="Filter work items by due date"
                    >
                      <Calendar className={cn("size-3", dateFilter !== "all" ? "text-indigo-400" : "text-zinc-500")} />
                      <span>{getDateFilterButtonLabel()}</span>
                      <ChevronDown className="size-3 text-zinc-500 ml-0.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  {dateFilter !== "all" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDateFilter("all")
                        setCustomRange({ startDate: "", endDate: "" })
                        setPage(0)
                      }}
                      className="px-1.5 py-1 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors border-l border-white/[0.06] cursor-pointer"
                      title="Reset due date filter"
                      aria-label="Reset due date filter"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                <DropdownMenuContent
                  align="start"
                  className="w-56 border-white/[0.08] bg-[#111215] p-1.5 text-zinc-200 shadow-2xl"
                >
                  <DropdownMenuLabel className="text-[10px] font-mono uppercase text-zinc-400 px-2 py-1">
                    Filter by Due Date
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />

                  <DropdownMenuItem
                    onClick={() => {
                      setDateFilter("all")
                      setCustomRange({ startDate: "", endDate: "" })
                      setPage(0)
                    }}
                    className={cn(
                      "flex items-center justify-between text-xs cursor-pointer rounded px-2 py-1.5 hover:bg-white/[0.06]",
                      dateFilter === "all" && "text-indigo-300 font-medium bg-indigo-500/10"
                    )}
                  >
                    <span>All Dates</span>
                    {dateFilter === "all" && <Check className="size-3 text-indigo-400" />}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setDateFilter("overdue")
                      setPage(0)
                    }}
                    className={cn(
                      "flex items-center justify-between text-xs cursor-pointer rounded px-2 py-1.5 hover:bg-white/[0.06]",
                      dateFilter === "overdue" && "text-rose-300 font-medium bg-rose-500/10"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-rose-400" />
                      <span>Overdue</span>
                    </div>
                    {dateFilter === "overdue" && <Check className="size-3 text-rose-400" />}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setDateFilter("today")
                      setPage(0)
                    }}
                    className={cn(
                      "flex items-center justify-between text-xs cursor-pointer rounded px-2 py-1.5 hover:bg-white/[0.06]",
                      dateFilter === "today" && "text-amber-300 font-medium bg-amber-500/10"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-amber-400" />
                      <span>Due Today</span>
                    </div>
                    {dateFilter === "today" && <Check className="size-3 text-amber-400" />}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setDateFilter("next_7_days")
                      setPage(0)
                    }}
                    className={cn(
                      "flex items-center justify-between text-xs cursor-pointer rounded px-2 py-1.5 hover:bg-white/[0.06]",
                      dateFilter === "next_7_days" && "text-indigo-300 font-medium bg-indigo-500/10"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-indigo-400" />
                      <span>Next 7 Days</span>
                    </div>
                    {dateFilter === "next_7_days" && <Check className="size-3 text-indigo-400" />}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-white/[0.06]" />

                  <DropdownMenuItem
                    onClick={() => {
                      const todayStr = new Date().toISOString().split("T")[0]
                      const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
                      setCustomRangeDraft(
                        customRange.startDate && customRange.endDate
                          ? customRange
                          : { startDate: todayStr, endDate: nextWeekStr }
                      )
                      setCustomRangeError(null)
                      setIsCustomRangeOpen(true)
                    }}
                    className={cn(
                      "flex items-center justify-between text-xs cursor-pointer rounded px-2 py-1.5 hover:bg-white/[0.06]",
                      dateFilter === "custom" && "text-indigo-300 font-medium bg-indigo-500/10"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3 text-zinc-400" />
                      <span>Custom Range…</span>
                    </div>
                    {dateFilter === "custom" && <Check className="size-3 text-indigo-400" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 cursor-pointer"
                    aria-label="Clear filter text"
                  >
                    <X className="size-2.5" />
                  </button>
                )}
              </div>

              <Button
                size="sm"
                onClick={openCreateItem}
                className="h-7 gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] px-2.5 rounded-md cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="size-3" />
                <span>New</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div role="alert" className="m-3 flex items-center justify-between rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
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
        {isLoading && items.length === 0 ? (
          <div className="divide-y divide-white/[0.03]">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3.5 py-3 animate-pulse motion-reduce:animate-none"
              >
                <div className="flex items-center gap-3">
                  <div className="h-3.5 w-14 bg-zinc-800/80 rounded" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-48 sm:w-80 bg-zinc-800/80 rounded" />
                    <div className="h-2.5 w-32 bg-zinc-800/50 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-3.5 w-16 bg-zinc-800/80 rounded hidden sm:block" />
                  <div className="h-3.5 w-20 bg-zinc-800/80 rounded" />
                  <div className="h-5 w-5 rounded-full bg-zinc-800/80" />
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
          <div className={cn("relative transition-opacity duration-150", isLoading && "opacity-60 pointer-events-none")}>
            {isLoading && (
              <div className="absolute top-0 inset-x-0 h-0.5 bg-indigo-500/60 animate-pulse motion-reduce:animate-none z-10" />
            )}
            {/* Desktop Column Header */}
            <div className="hidden sm:grid grid-cols-[88px_1fr_135px_96px_110px_32px] items-center border-b border-white/[0.05] py-2 px-3.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 select-none">
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
                  className="group flex flex-col sm:grid sm:grid-cols-[88px_1fr_135px_96px_110px_32px] items-start sm:items-center py-2.5 px-3.5 hover:bg-white/[0.035] active:bg-white/[0.05] transition-colors duration-150 cursor-pointer select-none gap-2 sm:gap-0"
                >
                  {/* Issue Key / Tracking Number */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleCopyId(e, item.trackingNumber)}
                      className="font-mono text-[11px] font-semibold text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer"
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

                  {/* Refined Title & Secondary Metadata (2-line structure) */}
                  <div className="min-w-0 pr-3 my-0.5 sm:my-0 w-full sm:w-auto">
                    {/* Primary Line: Work-item Title */}
                    <span
                      title={item.title}
                      className="text-[13px] font-medium text-zinc-100 group-hover:text-white transition-colors truncate block leading-snug"
                    >
                      {item.title}
                    </span>

                    {/* Secondary Line: Quieter Metadata Group */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] leading-none">
                      {getTypeBadge(item.type)}
                      {item.team && (
                        <span className="text-zinc-400 font-medium">
                          {item.team.name}
                        </span>
                      )}
                      <span className="text-zinc-600 text-[10px]">•</span>
                      <span className="text-zinc-400">
                        {item.systemArea}
                      </span>
                      {renderDueDateBadge(item.dueDate)}
                    </div>
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
                        <span className="text-[11px] text-zinc-300 truncate font-medium">
                          {item.assignee.name.split(" ")[0]}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={claimingId === item.id}
                        onClick={(e) => handleClaim(e, item)}
                        className="inline-flex h-6.5 items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2 text-[11px] font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white cursor-pointer disabled:opacity-50"
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
                          className="flex size-7 items-center justify-center rounded-md text-white/45 transition hover:bg-white/[0.08] hover:text-white cursor-pointer"
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
                : dateFilter !== "all"
                ? `No items match the selected due date filter (${getDateFilterButtonLabel()}).`
                : `There are currently no items in this filter view.`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveFilter("all")
                setDateFilter("all")
                setCustomRange({ startDate: "", endDate: "" })
                setSearchQuery("")
                setPage(0)
              }}
              className="mt-3 border-white/[0.08] bg-zinc-900 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer h-7"
            >
              Reset all filters
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

      {/* Custom Date Range Modal */}
      {isCustomRangeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-lg border border-white/[0.1] bg-[#121316] p-4 text-zinc-200 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <h3 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-indigo-400" />
                <span>Custom Due Date Range</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCustomRangeOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Start Date (From)
                </label>
                <input
                  type="date"
                  value={customRangeDraft.startDate}
                  onChange={(e) => {
                    setCustomRangeDraft((prev) => ({ ...prev, startDate: e.target.value }))
                    setCustomRangeError(null)
                  }}
                  className="w-full h-8 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  End Date (To)
                </label>
                <input
                  type="date"
                  value={customRangeDraft.endDate}
                  onChange={(e) => {
                    setCustomRangeDraft((prev) => ({ ...prev, endDate: e.target.value }))
                    setCustomRangeError(null)
                  }}
                  className="w-full h-8 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {customRangeError && (
                <div className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{customRangeError}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCustomRangeOpen(false)}
                className="h-7 border-white/[0.08] text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!customRangeDraft.startDate || !customRangeDraft.endDate) {
                    setCustomRangeError("Please select both start and end dates.")
                    return
                  }
                  if (customRangeDraft.startDate > customRangeDraft.endDate) {
                    setCustomRangeError("Start date cannot be after end date.")
                    return
                  }
                  setCustomRange(customRangeDraft)
                  setDateFilter("custom")
                  setPage(0)
                  setIsCustomRangeOpen(false)
                  setIsDateMenuOpen(false)
                }}
                className="h-7 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 cursor-pointer shadow-xs"
              >
                Apply Range
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
