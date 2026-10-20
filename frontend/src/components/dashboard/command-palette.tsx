"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Dialog as DialogPrimitive } from "radix-ui"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  Clock,
  Command,
  Layers,
  LayoutDashboard,
  Lock,
  Plus,
  Search,
  Users2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboard } from "./dashboard-shell"
import { type NavItemKey } from "./app-sidebar"
import { type StatusFilterType } from "./work-queue"

export interface CommandItem {
  id: string
  label: string
  description: string
  group: "navigation" | "work_items" | "queue_filters"
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  keywords?: string[]
  onSelect: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const {
    setActiveNav,
    activeNav,
    openCreateItem,
    setQueueFilter,
  } = useDashboard()

  const [query, setQuery] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([])

  // Reset state during render when palette opens
  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setQuery("")
      setSelectedIndex(0)
    }
  }

  const handleNavigation = React.useCallback(
    (key: NavItemKey) => {
      setActiveNav(key)
      onClose()
      if (typeof window !== "undefined") {
        if (key === "overview" || key === "my_work" || key === "all_work_items") {
          if (window.location.pathname !== "/") {
            router.push("/")
          }
        } else if (key === "teams") {
          if (window.location.pathname !== "/teams") {
            router.push("/teams")
          }
        } else if (key === "activity") {
          if (window.location.pathname !== "/activity") {
            router.push("/activity")
          }
        }
      }
    },
    [setActiveNav, onClose, router]
  )

  const handleFilterSelect = React.useCallback(
    (filter: StatusFilterType) => {
      setQueueFilter(filter)
      onClose()
      if (activeNav === "teams" || activeNav === "activity") {
        setActiveNav("overview")
      }
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        router.push("/")
      }
    },
    [setQueueFilter, onClose, activeNav, setActiveNav, router]
  )

  const handleCreateWorkItem = React.useCallback(() => {
    onClose()
    openCreateItem()
  }, [onClose, openCreateItem])

  const allCommands: CommandItem[] = React.useMemo(() => {
    return [
      // 1. Navigation
      {
        id: "nav-overview",
        label: "Overview",
        description: "Operations console dashboard and workspace metrics",
        group: "navigation",
        icon: LayoutDashboard,
        badge: "Navigation",
        keywords: ["dashboard", "home", "metrics", "stats", "overview"],
        onSelect: () => handleNavigation("overview"),
      },
      {
        id: "nav-my-work",
        label: "My Work",
        description: "Work items assigned directly to your account",
        group: "navigation",
        icon: CheckSquare,
        badge: "Navigation",
        keywords: ["assigned", "tasks", "mine", "my issues", "me"],
        onSelect: () => handleNavigation("my_work"),
      },
      {
        id: "nav-all-work-items",
        label: "All Work Items",
        description: "Full operations backlog across all teams and assignees",
        group: "navigation",
        icon: Layers,
        badge: "Navigation",
        keywords: ["backlog", "queue", "everything", "all issues"],
        onSelect: () => handleNavigation("all_work_items"),
      },
      {
        id: "nav-teams",
        label: "Teams",
        description: "Workspace team directory, member rosters, and assignments",
        group: "navigation",
        icon: Users2,
        badge: "Navigation",
        keywords: ["directory", "members", "roster", "engineering", "sre", "people"],
        onSelect: () => handleNavigation("teams"),
      },
      {
        id: "nav-activity",
        label: "Activity",
        description: "Workspace audit log, state transitions, and timeline feed",
        group: "navigation",
        icon: Activity,
        badge: "Navigation",
        keywords: ["audit", "logs", "feed", "timeline", "history", "recent", "events"],
        onSelect: () => handleNavigation("activity"),
      },

      // 2. Work Items
      {
        id: "action-create-work-item",
        label: "Create Work Item",
        description: "Open dialog to create a new task, incident, or bug",
        group: "work_items",
        icon: Plus,
        badge: "Action",
        keywords: ["new", "create", "issue", "ticket", "bug", "task", "incident", "add"],
        onSelect: handleCreateWorkItem,
      },

      // 3. Queue Filters
      {
        id: "filter-all",
        label: "All",
        description: "Show all work items without status filtering",
        group: "queue_filters",
        icon: Layers,
        badge: "Filter",
        keywords: ["all", "clear filter", "reset filter", "everything"],
        onSelect: () => handleFilterSelect("all"),
      },
      {
        id: "filter-urgent-high",
        label: "Urgent & High",
        description: "Filter queue to P0 Urgent and P1 High priority items",
        group: "queue_filters",
        icon: AlertTriangle,
        badge: "Filter",
        keywords: ["urgent", "high", "p0", "p1", "critical", "priority"],
        onSelect: () => handleFilterSelect("high_priority"),
      },
      {
        id: "filter-in-progress",
        label: "In Progress",
        description: "Filter queue to actively running work items",
        group: "queue_filters",
        icon: Clock,
        badge: "Filter",
        keywords: ["in progress", "wip", "working", "active"],
        onSelect: () => handleFilterSelect("in_progress"),
      },
      {
        id: "filter-review-needed",
        label: "Review Needed",
        description: "Filter queue to items awaiting review or verification",
        group: "queue_filters",
        icon: CheckCircle2,
        badge: "Filter",
        keywords: ["review", "pr", "triage", "verify", "needed"],
        onSelect: () => handleFilterSelect("review_needed"),
      },
      {
        id: "filter-blocked",
        label: "Blocked",
        description: "Filter queue to blocked items with external dependencies",
        group: "queue_filters",
        icon: Lock,
        badge: "Filter",
        keywords: ["blocked", "dependency", "waiting", "stuck"],
        onSelect: () => handleFilterSelect("blocked"),
      },
    ]
  }, [handleNavigation, handleCreateWorkItem, handleFilterSelect])

  // Filter commands by search query
  const filteredCommands = React.useMemo(() => {
    const cleanQuery = query.toLowerCase().trim()
    if (!cleanQuery) return allCommands

    const tokens = cleanQuery.split(/\s+/).filter(Boolean)

    return allCommands.filter((cmd) => {
      const searchTargets = [
        cmd.label.toLowerCase(),
        cmd.description.toLowerCase(),
        cmd.group.toLowerCase(),
        ...(cmd.keywords || []).map((k) => k.toLowerCase()),
      ]

      return tokens.every((token) =>
        searchTargets.some((target) => target.includes(token))
      )
    })
  }, [allCommands, query])

  // Reset selected index during render when query changes
  const [prevQuery, setPrevQuery] = React.useState(query)
  if (query !== prevQuery) {
    setPrevQuery(query)
    setSelectedIndex(0)
  }

  // Scroll active item into view
  React.useEffect(() => {
    const el = itemRefs.current[selectedIndex]
    if (el) {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex])

  // Keyboard navigation within the palette
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredCommands.length === 0) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const selectedItem = filteredCommands[selectedIndex]
      if (selectedItem) {
        selectedItem.onSelect()
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    }
  }

  const groupLabels: Record<CommandItem["group"], string> = {
    navigation: "Navigation",
    work_items: "Work Items",
    queue_filters: "Queue Filters",
  }

  const groups: CommandItem["group"][] = ["navigation", "work_items", "queue_filters"]

  // Map each command in filteredCommands to its index in the flat list
  const itemIndexMap = React.useMemo(() => {
    const map = new Map<string, number>()
    filteredCommands.forEach((cmd, idx) => {
      map.set(cmd.id, idx)
    })
    return map
  }, [filteredCommands])

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs transition-opacity data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:transition-none motion-reduce:animate-none"
        />
        <DialogPrimitive.Content
          data-command-palette="true"
          className="fixed left-1/2 top-[16%] sm:top-[20%] z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-white/[0.09] bg-[#0c0d12] shadow-2xl transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:transition-none motion-reduce:animate-none overflow-hidden outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            Command Palette
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search commands, navigation, work items, and queue filters.
          </DialogPrimitive.Description>

          {/* Search Input Bar */}
          <div className="flex items-center border-b border-white/[0.07] px-3.5 py-2.5 bg-[#090a0d]">
            <Search className="size-4 shrink-0 text-zinc-400 mr-2.5" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-controls="command-palette-results"
              aria-activedescendant={
                filteredCommands[selectedIndex]
                  ? `command-item-${filteredCommands[selectedIndex].id}`
                  : undefined
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search…"
              className="h-7 w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors mr-1 cursor-pointer"
                aria-label="Clear search query"
              >
                <X className="size-3" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center rounded border border-white/[0.08] bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              Esc
            </kbd>
          </div>

          {/* Results List */}
          <div
            id="command-palette-results"
            role="listbox"
            aria-label="Commands"
            ref={listRef}
            className="max-h-[340px] overflow-y-auto p-2 space-y-3"
          >
            {filteredCommands.length === 0 ? (
              <div className="py-10 text-center text-zinc-400 select-none">
                <Search className="mx-auto size-5 text-zinc-400 mb-2" aria-hidden="true" />
                <p className="text-xs font-medium text-zinc-300">No commands found</p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  No matching results for &ldquo;{query}&rdquo;. Try searching for &ldquo;overview&rdquo;, &ldquo;create&rdquo;, or &ldquo;urgent&rdquo;.
                </p>
              </div>
            ) : (
              groups.map((groupKey) => {
                const groupCommands = filteredCommands.filter((c) => c.group === groupKey)
                if (groupCommands.length === 0) return null

                return (
                  <div key={groupKey} className="space-y-1">
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 select-none">
                      {groupLabels[groupKey]}
                    </div>
                    <div className="space-y-0.5">
                      {groupCommands.map((cmd) => {
                        const index = itemIndexMap.get(cmd.id) ?? 0
                        const isSelected = index === selectedIndex
                        const Icon = cmd.icon

                        return (
                          <div
                            key={cmd.id}
                            id={`command-item-${cmd.id}`}
                            ref={(el) => {
                              itemRefs.current[index] = el
                            }}
                            role="option"
                            aria-selected={isSelected}
                            tabIndex={-1}
                            onClick={() => cmd.onSelect()}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={cn(
                              "group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer select-none",
                              isSelected
                                ? "bg-indigo-600/15 border border-indigo-500/30 text-zinc-100 shadow-xs"
                                : "border border-transparent text-zinc-300 hover:bg-white/[0.03] hover:text-zinc-200"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-3">
                              <div
                                className={cn(
                                  "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                                  isSelected
                                    ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-300"
                                    : "border-white/[0.08] bg-white/[0.02] text-zinc-400 group-hover:text-zinc-300"
                                )}
                              >
                                <Icon className="size-3.5" aria-hidden="true" />
                              </div>
                              <div className="min-w-0 flex flex-col">
                                <span className={cn("font-medium truncate", isSelected ? "text-indigo-100" : "text-zinc-200")}>
                                  {cmd.label}
                                </span>
                                <span className="text-[11px] text-zinc-400 truncate">
                                  {cmd.description}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {cmd.badge && (
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors",
                                    isSelected
                                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                      : "bg-white/[0.04] text-zinc-400 border border-white/[0.06]"
                                  )}
                                >
                                  {cmd.badge}
                                </span>
                              )}
                              <ArrowRight
                                className={cn(
                                  "size-3 transition-opacity",
                                  isSelected ? "opacity-100 text-indigo-400" : "opacity-0"
                                )}
                                aria-hidden="true"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Concise Keyboard Hints Footer */}
          <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#08090b] px-3.5 py-2 text-[11px] text-zinc-400 select-none">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-white/[0.08] bg-zinc-900 px-1 py-0.2 font-mono text-[9px] text-zinc-400">↑</kbd>
                <kbd className="rounded border border-white/[0.08] bg-zinc-900 px-1 py-0.2 font-mono text-[9px] text-zinc-400">↓</kbd>
                <span className="text-zinc-400">Navigate</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-white/[0.08] bg-zinc-900 px-1 py-0.2 font-mono text-[9px] text-zinc-400">↵</kbd>
                <span className="text-zinc-400">Select</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-white/[0.08] bg-zinc-900 px-1 py-0.2 font-mono text-[9px] text-zinc-400">Esc</kbd>
                <span className="text-zinc-400">Close</span>
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
              <Command className="size-3 text-zinc-400" />
              <span>Palette</span>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
