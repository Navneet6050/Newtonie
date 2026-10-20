"use client"

import * as React from "react"
import {
  Bell,
  ChevronRight,
  Menu,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useDashboard } from "./dashboard-shell"

interface NotificationItem {
  id: string
  title: string
  description: string
  time: string
  type: "warning" | "success"
  read: boolean
}

interface DashboardHeaderProps {
  onOpenSidebar: () => void
  sidebarOpen: boolean
  activeNavTitle?: string
  workspaceName?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  onNewItemClick?: () => void
}

export function DashboardHeader({
  onOpenSidebar,
  sidebarOpen,
  activeNavTitle = "Overview",
  workspaceName = "Acme Studio",
  searchValue = "",
  onSearchChange,
  onNewItemClick,
}: DashboardHeaderProps) {
  const { user, logout, setShowLoginModal, isAuthenticated } = useAuth()
  const { openCommandPalette } = useDashboard()
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const [internalSearch, setInternalSearch] = React.useState("")
  const isMac = React.useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent),
    () => false
  )
  const isSearchControlled = onSearchChange !== undefined
  const currentSearch = isSearchControlled ? searchValue : internalSearch

  const handleSearchChange = React.useCallback(
    (val: string) => {
      if (onSearchChange) {
        onSearchChange(val)
      } else {
        setInternalSearch(val)
      }
    },
    [onSearchChange]
  )

  const [notifications, setNotifications] = React.useState<NotificationItem[]>([
    {
      id: "notif-1",
      title: "High latency on Telemetry Edge",
      description: "NEW-1029 was escalated to urgent priority.",
      time: "12m ago",
      type: "warning",
      read: false,
    },
    {
      id: "notif-2",
      title: "Kafka partition rebalance finished",
      description: "Health checks reported green across all 12 brokers.",
      time: "1h ago",
      type: "success",
      read: false,
    },
  ])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleToggleNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    )
  }

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        handleSearchChange("")
        searchInputRef.current?.blur()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSearchChange])

  return (
    <header className="sticky top-0 z-30 flex h-11 w-full items-center justify-between border-b border-white/[0.06] bg-[#08090c]/80 px-3.5 backdrop-blur-md select-none">
      {/* Left Area: Mobile Menu Trigger + Breadcrumb */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex size-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 lg:hidden focus-visible:ring-1 focus-visible:ring-indigo-500/50 outline-none"
          aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
        >
          <Menu className="size-3.5" />
        </button>

        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center text-[12px]">
          <ol className="flex items-center gap-1.5 text-zinc-400">
            <li>
              <span className="hover:text-zinc-300 transition-colors">
                {workspaceName}
              </span>
            </li>
            <li aria-hidden="true" className="text-zinc-600">
              <ChevronRight className="size-3" />
            </li>
            <li>
              <span className="font-medium text-zinc-100" aria-current="page">
                {activeNavTitle}
              </span>
            </li>
          </ol>
        </nav>
      </div>

      {/* Middle Area: Search Input */}
      <div className="flex flex-1 items-center justify-center px-4 max-w-sm mx-auto">
        <div className="relative w-full">
          <label htmlFor="search-work-items" className="sr-only">
            Search work items
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-400">
            <Search className="size-3" aria-hidden="true" />
          </div>
          <input
            ref={searchInputRef}
            id="search-work-items"
            type="search"
            value={currentSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search operations queue…"
            className="h-7 w-full rounded-md border border-white/[0.07] bg-white/[0.02] pl-7 pr-12 text-[12px] text-zinc-100 placeholder:text-zinc-400 transition-colors hover:border-white/[0.12] focus:border-indigo-500/60 focus:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5 gap-1">
            {currentSearch && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="text-zinc-400 hover:text-zinc-200 p-0.5"
                aria-label="Clear search text"
              >
                <X className="size-2.5" />
              </button>
            )}
            <button
              type="button"
              onClick={openCommandPalette}
              className="hidden sm:inline-flex items-center rounded border border-white/[0.08] bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.16] hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Open command palette"
              aria-label="Open command palette"
            >
              {isMac ? "⌘K" : "Ctrl+K"}
            </button>
          </div>
        </div>
      </div>

      {/* Right Area: Actions, Notifications, Profile */}
      <div className="flex items-center gap-1.5">
        {/* Quick Action Button */}
        <Button
          size="sm"
          onClick={onNewItemClick}
          className="hidden md:inline-flex h-7 gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-medium px-2.5 rounded-md cursor-pointer shadow-xs"
        >
          <Plus className="size-3" />
          <span>New Item</span>
        </Button>

        {/* Notifications Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative flex size-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200 transition-colors focus-visible:ring-1 focus-visible:ring-indigo-500/40 outline-none cursor-pointer"
              aria-label={`Notifications, ${unreadCount} unread operational alerts`}
            >
              <Bell className="size-3.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-indigo-500 ring-1 ring-[#08090c]" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 border-white/[0.08] bg-[#141418] p-0 text-zinc-200 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-100">
                  Workspace Notifications
                </span>
                {unreadCount > 0 ? (
                  <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-mono text-indigo-400">
                    {unreadCount} new
                  </span>
                ) : (
                  <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                    All caught up
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleNotification(item.id)}
                  className={cn(
                    "p-3 hover:bg-white/[0.02] transition-colors cursor-pointer",
                    item.read && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                        item.type === "warning"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      )}
                    >
                      {item.type === "warning" ? (
                        <AlertTriangle className="size-3" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-zinc-200 truncate">
                          {item.title}
                        </p>
                        {!item.read && (
                          <span className="size-1.5 rounded-full bg-indigo-500 shrink-0 ml-2" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400">{item.description}</p>
                      <span className="text-[10px] text-zinc-500">{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile Avatar Control */}
        {isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg p-0.5 focus-visible:ring-2 focus-visible:ring-indigo-500/40 outline-none cursor-pointer"
                aria-label={`User menu for ${user.name}`}
              >
                <Avatar size="sm" className="size-7 border border-white/[0.12] hover:border-indigo-400/50 transition-colors">
                  <AvatarFallback className="bg-zinc-800 text-indigo-300 font-semibold text-xs">
                    {user.avatarInitials || user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 border-white/[0.08] bg-[#141418] text-zinc-200"
            >
              <DropdownMenuLabel>
                <div className="text-xs font-medium text-zinc-100">{user.name}</div>
                <div className="text-[10px] text-zinc-400">{user.email}</div>
                <div className="mt-1 text-[9px] font-mono text-indigo-400 uppercase">{user.systemRole}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={() => setShowLoginModal(true)}
                className="text-xs cursor-pointer hover:bg-white/[0.05]"
              >
                Switch Operator
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              <DropdownMenuItem
                onClick={logout}
                className="text-xs text-rose-400 cursor-pointer hover:bg-rose-500/10"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            onClick={() => setShowLoginModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  )
}
