"use client"

import * as React from "react"
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Inbox,
  MoreHorizontal,
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
import { useDashboardSearch } from "./dashboard-shell"

export type WorkItemPriority = "urgent" | "high" | "medium" | "low"
export type WorkItemStatus = "in_progress" | "review_needed" | "todo" | "completed"

export interface WorkItem {
  id: string
  title: string
  type: "Incident" | "Task" | "Bug" | "Ops"
  status: WorkItemStatus
  priority: WorkItemPriority
  assignedTo: {
    name: string
    initials: string
  }
  dueDate: string
  systemArea: string
}

const SAMPLE_WORK_ITEMS: WorkItem[] = [
  {
    id: "NEW-1042",
    title: "Database connection pool exhaustion during peak ingest",
    type: "Incident",
    status: "in_progress",
    priority: "urgent",
    assignedTo: { name: "Alex Morgan", initials: "AM" },
    dueDate: "Today, 18:00",
    systemArea: "Data Pipeline",
  },
  {
    id: "NEW-1038",
    title: "Refactor Kafka consumer rebalance listener for partition loss",
    type: "Task",
    status: "review_needed",
    priority: "high",
    assignedTo: { name: "Alex Morgan", initials: "AM" },
    dueDate: "Tomorrow",
    systemArea: "Event Bus",
  },
  {
    id: "NEW-1035",
    title: "Provision multi-region Redis cluster for distributed session cache",
    type: "Task",
    status: "in_progress",
    priority: "high",
    assignedTo: { name: "Sarah Chen", initials: "SC" },
    dueDate: "Oct 22",
    systemArea: "Infrastructure",
  },
  {
    id: "NEW-1029",
    title: "Audit CORS wildcard policy on internal telemetry edge gateway",
    type: "Bug",
    status: "review_needed",
    priority: "high",
    assignedTo: { name: "Marcus Bell", initials: "MB" },
    dueDate: "Oct 23",
    systemArea: "Security Gateway",
  },
  {
    id: "NEW-1024",
    title: "Rotate expiring TLS root authority certificates on metrics proxy",
    type: "Ops",
    status: "todo",
    priority: "medium",
    assignedTo: { name: "Alex Morgan", initials: "AM" },
    dueDate: "Oct 25",
    systemArea: "Telemetry",
  },
  {
    id: "NEW-1017",
    title: "Benchmark gRPC serialization throughput under synthetic 50k RPS",
    type: "Task",
    status: "todo",
    priority: "low",
    assignedTo: { name: "Elena Rostova", initials: "ER" },
    dueDate: "Oct 28",
    systemArea: "Core Engine",
  },
]

type FilterType = "all" | "high_priority" | "in_progress" | "review_needed"

const FILTER_PREDICATES: Record<FilterType, (item: WorkItem) => boolean> = {
  all: () => true,
  high_priority: (item) => item.priority === "urgent" || item.priority === "high",
  in_progress: (item) => item.status === "in_progress",
  review_needed: (item) => item.status === "review_needed",
}

interface WorkQueueProps {
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export function WorkQueue({
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
}: WorkQueueProps = {}) {
  const { searchQuery: contextSearchQuery, setSearchQuery: contextSetSearchQuery } =
    useDashboardSearch()
  const [internalSearchQuery, setInternalSearchQuery] = React.useState("")

  const isExplicitlyControlled = externalSearchQuery !== undefined
  const searchQuery = isExplicitlyControlled
    ? externalSearchQuery
    : (contextSearchQuery !== undefined ? contextSearchQuery : internalSearchQuery)

  const setSearchQuery = (query: string) => {
    if (externalOnSearchChange) {
      externalOnSearchChange(query)
    } else if (contextSetSearchQuery) {
      contextSetSearchQuery(query)
    } else {
      setInternalSearchQuery(query)
    }
  }

  const [activeFilter, setActiveFilter] = React.useState<FilterType>("all")
  const [items, setItems] = React.useState<WorkItem[]>(SAMPLE_WORK_ITEMS)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const handleCopyId = (id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id).catch(() => {})
    }
    setCopiedId(id)
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr))
    }, 2000)
  }

  const handleAssignToMe = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              assignedTo:
                item.assignedTo.name === "Alex Morgan"
                  ? { name: "Unassigned", initials: "UN" }
                  : { name: "Alex Morgan", initials: "AM" },
            }
          : item
      )
    )
  }

  const handleToggleStatus = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "completed" ? "in_progress" : "completed",
            }
          : item
      )
    )
  }

  // 1. First filter items based on search query across id, title, systemArea, assignee
  const itemsMatchingSearch = React.useMemo(() => {
    if (!searchQuery.trim()) return items
    const query = searchQuery.toLowerCase().trim()
    return items.filter((item) => {
      return (
        item.id.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.systemArea.toLowerCase().includes(query) ||
        item.assignedTo.name.toLowerCase().includes(query)
      )
    })
  }, [items, searchQuery])

  // 2. Derive filter counts strictly from the data matching search to prevent any count drift
  const counts = React.useMemo(() => {
    return {
      all: itemsMatchingSearch.filter(FILTER_PREDICATES.all).length,
      high_priority: itemsMatchingSearch.filter(FILTER_PREDICATES.high_priority).length,
      in_progress: itemsMatchingSearch.filter(FILTER_PREDICATES.in_progress).length,
      review_needed: itemsMatchingSearch.filter(FILTER_PREDICATES.review_needed).length,
    }
  }, [itemsMatchingSearch])

  // 3. Current displayed items always match the selected filter and its count exactly
  const filteredItems = React.useMemo(() => {
    return itemsMatchingSearch.filter(FILTER_PREDICATES[activeFilter])
  }, [itemsMatchingSearch, activeFilter])

  const getStatusBadge = (status: WorkItemStatus) => {
    switch (status) {
      case "in_progress":
        return (
          <Badge
            variant="outline"
            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-normal text-[11px]"
          >
            <Clock className="mr-1 size-3 text-indigo-400" />
            In Progress
          </Badge>
        )
      case "review_needed":
        return (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-amber-300 font-normal text-[11px]"
          >
            <AlertCircle className="mr-1 size-3 text-amber-400" />
            Review Needed
          </Badge>
        )
      case "todo":
        return (
          <Badge
            variant="outline"
            className="border-zinc-700 bg-zinc-800/40 text-zinc-400 font-normal text-[11px]"
          >
            To Do
          </Badge>
        )
      case "completed":
        return (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-normal text-[11px]"
          >
            <CheckCircle2 className="mr-1 size-3 text-emerald-400" />
            Completed
          </Badge>
        )
    }
  }

  const getPriorityIndicator = (priority: WorkItemPriority) => {
    switch (priority) {
      case "urgent":
        return (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
            Urgent
          </div>
        )
      case "high":
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-500" />
            High
          </div>
        )
      case "medium":
        return (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="size-1.5 rounded-full bg-zinc-500" />
            Medium
          </div>
        )
      case "low":
        return (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="size-1.5 rounded-full bg-zinc-600" />
            Low
          </div>
        )
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
              Your Work Queue
            </h2>
            <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[11px] font-mono text-zinc-400 border border-white/[0.06]">
              {filteredItems.length} items
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            Sample work items staged for demonstration and queue triage.
          </p>
        </div>

        {/* Small Filter Control */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter queue…"
              className="h-7 w-36 rounded-lg border border-white/[0.08] bg-black/40 pl-7 pr-6 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 sm:w-44"
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
              onClick={() => setActiveFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeFilter === "all"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("high_priority")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeFilter === "high_priority"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              High Priority ({counts.high_priority})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("in_progress")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeFilter === "in_progress"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              In Progress ({counts.in_progress})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("review_needed")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeFilter === "review_needed"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Review Needed ({counts.review_needed})
            </button>
          </div>
        </div>
      </div>

      {/* Queue Table / Rows */}
      {filteredItems.length > 0 ? (
        <div className="mt-3 divide-y divide-white/[0.04] overflow-x-auto">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col gap-3 py-3 px-2 sm:flex-row sm:items-center sm:justify-between rounded-lg transition-colors hover:bg-white/[0.02]"
            >
              {/* Left Details */}
              <div className="flex items-start gap-3 min-w-0">
                <span className="shrink-0 font-mono text-xs font-semibold text-indigo-400/90 pt-0.5">
                  {item.id}
                </span>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                      {item.title}
                    </span>
                    <span className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider text-zinc-400 border border-white/[0.04]">
                      {item.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                    <span>{item.systemArea}</span>
                    <span className="text-zinc-700">•</span>
                    <span>Due: {item.dueDate}</span>
                  </div>
                </div>
              </div>

              {/* Right Attributes */}
              <div className="flex items-center gap-4 shrink-0 sm:self-center pl-7 sm:pl-0">
                <div className="w-24 shrink-0">{getPriorityIndicator(item.priority)}</div>

                <div className="w-28 shrink-0">{getStatusBadge(item.status)}</div>

                <div className="flex items-center gap-2 w-28 shrink-0">
                  <Avatar size="sm" className="size-6 border border-white/[0.1]">
                    <AvatarFallback className="bg-zinc-800 text-[10px] text-zinc-300 font-medium">
                      {item.assignedTo.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-zinc-400 truncate">
                    {item.assignedTo.name.split(" ")[0]}
                  </span>
                </div>

                {/* Meaningful Row Action Dropdown Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-zinc-500 hover:text-zinc-300 focus-visible:ring-1 focus-visible:ring-indigo-500/50"
                      aria-label={`Actions for ${item.id}`}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 border-white/[0.08] bg-[#141418] text-zinc-200 shadow-xl"
                  >
                    <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      {item.id} Actions
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem
                      onClick={() => handleCopyId(item.id)}
                      className="text-xs cursor-pointer hover:bg-white/[0.05]"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="mr-2 size-3.5 text-emerald-400" />
                          <span>Copied ID</span>
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 size-3.5 text-zinc-400" />
                          <span>Copy Item ID</span>
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleAssignToMe(item.id)}
                      className="text-xs cursor-pointer hover:bg-white/[0.05]"
                    >
                      <UserCheck className="mr-2 size-3.5 text-zinc-400" />
                      <span>
                        {item.assignedTo.name === "Alex Morgan"
                          ? "Unassign from Me"
                          : "Assign to Me"}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleToggleStatus(item.id)}
                      className="text-xs cursor-pointer hover:bg-white/[0.05]"
                    >
                      <CheckCircle2 className="mr-2 size-3.5 text-zinc-400" />
                      <span>
                        {item.status === "completed"
                          ? "Reopen Item"
                          : "Mark as Completed"}
                      </span>
                    </DropdownMenuItem>
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
              ? `No items match "${searchQuery}" under ${activeFilter.replace("_", " ")} filter.`
              : `There are no work items matching the active filter (${activeFilter.replace("_", " ")}).`}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveFilter("all")
              setSearchQuery("")
            }}
            className="mt-4 border-white/[0.08] bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Reset all filters
          </Button>
        </div>
      )}

      {/* Footer queue note */}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-3 text-[11px] text-zinc-400">
        <span>Illustrative sample dataset · Interactive queue triage</span>
        <button
          type="button"
          onClick={() => {
            setActiveFilter("all")
            setSearchQuery("")
          }}
          className="text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
        >
          View all items
          <ArrowUpRight className="size-3" />
        </button>
      </div>
    </section>
  )
}
