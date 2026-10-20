"use client"

import * as React from "react"
import {
  Activity,
  CheckSquare,
  ChevronDown,
  Layers,
  LayoutDashboard,
  LogOut,
  MoreVertical,
  Settings,
  Users2,
  X,
  Briefcase,
  Check,
  LogIn,
} from "lucide-react"
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
import { useAuth } from "@/lib/auth-context"

export type NavItemKey =
  | "overview"
  | "my_work"
  | "all_work_items"
  | "teams"
  | "activity"

interface AppSidebarProps {
  isOpen: boolean
  onClose: () => void
  activeNav: NavItemKey
  onNavSelect: (key: NavItemKey) => void
  currentWorkspace?: string
  onWorkspaceChange?: (workspace: string) => void
  onTeamSelect?: (teamId: string | undefined) => void
}

interface WorkspaceItem {
  id: string
  name: string
  role: string
  teamId?: string
}

export function AppSidebar({
  isOpen,
  onClose,
  activeNav,
  onNavSelect,
  currentWorkspace = "Acme Studio",
  onWorkspaceChange,
  onTeamSelect,
}: AppSidebarProps) {
  const { user, logout, setShowLoginModal, isAuthenticated } = useAuth()
  const [internalWorkspace, setInternalWorkspace] = React.useState("Acme Studio")

  const availableWorkspaces: WorkspaceItem[] = React.useMemo(() => {
    if (!user) {
      return [
        { id: "acme-studio", name: "Acme Studio", role: "Primary Workspace", teamId: undefined },
      ]
    }
    if (user.systemRole === "ADMIN") {
      return [
        { id: "all", name: "All Workspaces", role: "Global Admin", teamId: undefined },
        { id: "acme-studio", name: "Acme Studio", role: "Primary Workspace", teamId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
        { id: "acme-platform", name: "Acme Platform", role: "Engineering Team", teamId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
        { id: "acme-infra", name: "Acme Cloud Infra", role: "Site Reliability", teamId: "cccccccc-cccc-cccc-cccc-cccccccccccc" },
      ]
    }
    if (user.teams && user.teams.length > 0) {
      return user.teams.map((t) => ({
        id: t.teamId,
        name: t.teamName,
        role: t.role,
        teamId: t.teamId,
      }))
    }
    return [
      { id: "acme-studio", name: "Acme Studio", role: "Primary Workspace", teamId: undefined },
    ]
  }, [user])

  const activeWorkspace = React.useMemo(() => {
    const raw = onWorkspaceChange ? currentWorkspace : internalWorkspace
    if (availableWorkspaces.some((w) => w.name === raw)) {
      return raw
    }
    return availableWorkspaces[0]?.name ?? "Acme Studio"
  }, [availableWorkspaces, onWorkspaceChange, currentWorkspace, internalWorkspace])

  const handleSelectWorkspace = (ws: WorkspaceItem) => {
    if (onWorkspaceChange) {
      onWorkspaceChange(ws.name)
    } else {
      setInternalWorkspace(ws.name)
    }
    if (onTeamSelect) {
      onTeamSelect(ws.teamId)
    }
  }

  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const navItems = [
    {
      key: "overview" as NavItemKey,
      label: "Overview",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      key: "my_work" as NavItemKey,
      label: "My Work",
      icon: CheckSquare,
      badge: null,
    },
    {
      key: "all_work_items" as NavItemKey,
      label: "All Work Items",
      icon: Layers,
      badge: null,
    },
    {
      key: "teams" as NavItemKey,
      label: "Teams",
      icon: Users2,
      badge: null,
    },
    {
      key: "activity" as NavItemKey,
      label: "Activity",
      icon: Activity,
      badge: null,
    },
  ]

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-sidebar"
        aria-label="Application Sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.07] bg-[#0b0b0e] transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Top Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-4">
          <div className="flex items-center gap-2.5">
            {/* Geometric Mark */}
            <div className="relative flex size-7 items-center justify-center rounded-lg border border-indigo-500/30 bg-gradient-to-b from-indigo-500/20 to-violet-600/10 shadow-xs">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-indigo-400"
                aria-hidden="true"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Wordmark */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-zinc-100">
                Newtonite
              </span>
              <span className="rounded bg-indigo-500/10 px-1.5 py-0.2 text-[10px] font-mono font-medium text-indigo-400 border border-indigo-500/20">
                OPS
              </span>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Workspace Switcher */}
        <div className="p-3 border-b border-white/[0.05]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] p-2 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.05] focus-visible:border-indigo-500/60 focus-visible:ring-2 focus-visible:ring-indigo-500/30 outline-none"
                aria-label={`Current workspace: ${activeWorkspace}. Click to switch workspace.`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-800/80 border border-white/[0.06] text-zinc-300">
                    <Briefcase className="size-3.5 text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-200 truncate">
                      {activeWorkspace}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      Enterprise Tier
                    </div>
                  </div>
                </div>
                <ChevronDown className="size-3.5 shrink-0 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-56 border-white/[0.08] bg-[#141418] text-zinc-200"
            >
              <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Workspaces
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              {availableWorkspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws)}
                  className="flex items-center justify-between text-xs cursor-pointer hover:bg-white/[0.05] focus:bg-white/[0.05]"
                >
                  <div>
                    <div className="font-medium text-zinc-200">{ws.name}</div>
                    <div className="text-[10px] text-zinc-400">{ws.role}</div>
                  </div>
                  {activeWorkspace === ws.name && (
                    <Check className="size-3.5 text-indigo-400" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main Navigation">
          <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Platform Navigation
          </div>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeNav === item.key

              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onNavSelect(item.key)
                      onClose()
                    }}
                    className={cn(
                      "group relative flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-all outline-none",
                      isActive
                        ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 shadow-xs"
                        : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200 border border-transparent"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          "size-4 transition-colors",
                          isActive
                            ? "text-indigo-400"
                            : "text-zinc-400 group-hover:text-zinc-300"
                        )}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-mono",
                          isActive
                            ? "bg-indigo-500/20 text-indigo-300"
                            : "bg-zinc-800/80 text-zinc-400"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}

                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-indigo-500"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom Section: Settings & User Profile */}
        <div className="mt-auto border-t border-white/[0.06] p-2 space-y-1 bg-black/20">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200 transition-colors"
            aria-label="Settings"
          >
            <Settings className="size-4 text-zinc-400" />
            <span>Settings</span>
          </button>

          {/* User Profile */}
          <div className="pt-1">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-white/[0.04] focus-visible:border-indigo-500/60 focus-visible:ring-2 focus-visible:ring-indigo-500/30 outline-none cursor-pointer"
                    aria-label={`${user.name}, profile settings`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <Avatar size="sm" className="size-8 border border-white/[0.1]">
                          <AvatarFallback className="bg-indigo-950/80 text-indigo-200 font-semibold text-xs border border-indigo-500/30">
                            {user.avatarInitials || user.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-[#0b0b0e]"
                          title="Active / Online"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-200 truncate">
                          {user.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          {user.systemRole === "ADMIN" ? "System Admin" : "Team Member"}
                        </div>
                      </div>
                    </div>
                    <MoreVertical className="size-3.5 shrink-0 text-zinc-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 border-white/[0.08] bg-[#141418] text-zinc-200"
                >
                  <DropdownMenuLabel>
                    <div className="text-xs font-medium text-zinc-200">{user.name}</div>
                    <div className="text-[10px] text-zinc-400">{user.email}</div>
                    <div className="mt-1 text-[9px] font-mono text-indigo-400 uppercase">
                      {user.systemRole}
                    </div>
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
                    className="text-xs cursor-pointer text-rose-400 hover:bg-rose-500/10"
                  >
                    <LogOut className="mr-2 size-3.5" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer"
              >
                <LogIn className="size-3.5" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
