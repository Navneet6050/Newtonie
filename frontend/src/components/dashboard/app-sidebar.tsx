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
  Users2,
  X,
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
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-sidebar"
        aria-label="Application Sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-white/[0.06] bg-[#090a0d] transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 select-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Top Brand & Workspace Header */}
        <div className="flex h-12 items-center justify-between border-b border-white/[0.05] px-3.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white/[0.05] focus-visible:ring-1 focus-visible:ring-indigo-500/50 outline-none cursor-pointer max-w-[200px]"
                aria-label={`Current workspace: ${activeWorkspace}. Switch workspace`}
              >
                <div className="flex size-5.5 shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-500/30 to-violet-600/30 border border-indigo-500/40 text-indigo-300">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                    <path d="M2 17L12 22L22 17" />
                    <path d="M2 12L12 17L22 12" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span className="text-[12px] font-semibold tracking-tight text-zinc-100 truncate block">
                    {activeWorkspace}
                  </span>
                </div>
                <ChevronDown className="size-3 shrink-0 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-56 border-white/[0.08] bg-[#121316] text-zinc-200 shadow-2xl p-1"
            >
              <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 px-2 py-1">
                Authorized Workspaces
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              {availableWorkspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws)}
                  className="flex items-center justify-between text-xs cursor-pointer rounded px-2 py-1.5 hover:bg-white/[0.06] focus:bg-white/[0.06]"
                >
                  <div>
                    <div className="font-medium text-zinc-200">{ws.name}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">{ws.role}</div>
                  </div>
                  {activeWorkspace === ws.name && (
                    <Check className="size-3.5 text-indigo-400 shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Close button for mobile */}
          <button
            type="button"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Navigation Body */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4" aria-label="Main Navigation">
          <div>
            <div className="px-2 mb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Operations
            </div>
            <ul className="space-y-0.5">
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
                        "group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[12px] font-medium transition-all outline-none cursor-pointer",
                        isActive
                          ? "bg-white/[0.08] text-zinc-100 shadow-xs"
                          : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon
                          className={cn(
                            "size-3.5 shrink-0 transition-colors",
                            isActive
                              ? "text-indigo-400"
                              : "text-zinc-400 group-hover:text-zinc-300"
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 text-[10px] font-mono",
                            isActive
                              ? "bg-indigo-500/20 text-indigo-300"
                              : "bg-zinc-800 text-zinc-400"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>

        {/* Bottom Section: Operator Profile & Status */}
        <div className="mt-auto border-t border-white/[0.06] p-2 bg-[#08080a]">
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md p-1.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-indigo-500/50 outline-none cursor-pointer"
                  aria-label={`${user.name}, operator profile`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative">
                      <Avatar size="sm" className="size-6 border border-white/[0.1]">
                        <AvatarFallback className="bg-zinc-800 text-indigo-300 font-semibold text-[10px]">
                          {user.avatarInitials || user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-400 ring-1 ring-[#08080a]"
                        title="Online"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-zinc-200 truncate leading-tight">
                        {user.name}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 truncate leading-tight">
                        {user.systemRole === "ADMIN" ? "ADMIN" : "OPERATOR"}
                      </div>
                    </div>
                  </div>
                  <MoreVertical className="size-3 shrink-0 text-zinc-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 border-white/[0.08] bg-[#121316] text-zinc-200 shadow-2xl p-1"
              >
                <DropdownMenuLabel className="px-2 py-1.5">
                  <div className="text-xs font-medium text-zinc-200">{user.name}</div>
                  <div className="text-[10px] text-zinc-400 font-mono">{user.email}</div>
                  <div className="mt-1 text-[9px] font-mono text-indigo-400 uppercase">
                    Role: {user.systemRole}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                <DropdownMenuItem
                  onClick={() => setShowLoginModal(true)}
                  className="text-xs cursor-pointer rounded px-2 py-1.5 hover:bg-white/[0.05]"
                >
                  Switch Operator
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.06]" />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-xs cursor-pointer rounded px-2 py-1.5 text-rose-400 hover:bg-rose-500/10"
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
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 p-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer"
            >
              <LogIn className="size-3.5" />
              Sign In
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
