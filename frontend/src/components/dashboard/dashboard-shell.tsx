"use client"

import * as React from "react"
import { AppSidebar, type NavItemKey } from "./app-sidebar"
import { DashboardHeader } from "./dashboard-header"
import { CreateItemDialog } from "@/components/work-items/create-item-dialog"
import { WorkItemDrawer } from "@/components/work-items/work-item-drawer"
import { useAuth } from "@/lib/auth-context"

export interface DashboardContextValue {
  searchQuery: string
  setSearchQuery: (query: string) => void
  activeNav: NavItemKey
  setActiveNav: (key: NavItemKey) => void
  currentWorkspace: string
  setCurrentWorkspace: (workspace: string) => void
  selectedTeamId: string | undefined
  setSelectedTeamId: (teamId: string | undefined) => void
  openCreateItem: () => void
  openItemDetails: (id: string) => void
  refreshKey: number
  triggerRefresh: () => void
}

export const DashboardContext = React.createContext<DashboardContextValue | null>(null)

export const useDashboard = () => {
  const ctx = React.useContext(DashboardContext)
  if (!ctx) {
    throw new Error("useDashboard must be used within DashboardShell")
  }
  return ctx
}

// Backward-compatible search hook
export const useDashboardSearch = () => {
  const ctx = React.useContext(DashboardContext)
  return {
    searchQuery: ctx?.searchQuery || "",
    setSearchQuery: ctx?.setSearchQuery || (() => {}),
  }
}

interface DashboardShellProps {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { user, setShowLoginModal } = useAuth()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [activeNav, setActiveNav] = React.useState<NavItemKey>("overview")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null)
  const [userSelectedWorkspace, setUserSelectedWorkspace] = React.useState<string | null>(null)
  const [userSelectedTeamId, setUserSelectedTeamId] = React.useState<string | undefined | null>(null)
  const [prevUserId, setPrevUserId] = React.useState<string | undefined>(user?.id)

  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id)
    setUserSelectedWorkspace(null)
    setUserSelectedTeamId(null)
  }

  const currentWorkspace = userSelectedWorkspace ?? (
    user
      ? user.systemRole === "ADMIN"
        ? "All Workspaces"
        : user.teams?.[0]?.teamName ?? "Acme Studio"
      : "Acme Studio"
  )

  const selectedTeamId = userSelectedTeamId !== null
    ? userSelectedTeamId
    : (user && user.systemRole !== "ADMIN" ? user.teams?.[0]?.teamId : undefined)

  const setCurrentWorkspace = React.useCallback((ws: string) => {
    setUserSelectedWorkspace(ws)
  }, [])

  const setSelectedTeamId = React.useCallback((teamId: string | undefined) => {
    setUserSelectedTeamId(teamId)
  }, [])

  const triggerRefresh = React.useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const openCreateItem = React.useCallback(() => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    setIsCreateOpen(true)
  }, [user, setShowLoginModal])

  const openItemDetails = React.useCallback((id: string) => {
    setSelectedItemId(id)
  }, [])

  const navTitles: Record<NavItemKey, string> = {
    overview: "Overview",
    my_work: "My Work",
    all_work_items: "All Work Items",
    teams: "Teams",
    activity: "Activity",
  }

  const contextValue: DashboardContextValue = {
    searchQuery,
    setSearchQuery,
    activeNav,
    setActiveNav,
    currentWorkspace,
    setCurrentWorkspace,
    selectedTeamId,
    setSelectedTeamId,
    openCreateItem,
    openItemDetails,
    refreshKey,
    triggerRefresh,
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="relative flex min-h-screen bg-[#09090b] text-zinc-100 font-sans">
        {/* Accessibility Skip Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-indigo-600 focus:px-3 focus:py-1.5 focus:text-xs focus:font-medium focus:text-white"
        >
          Skip to main content
        </a>

        {/* Responsive Left Sidebar */}
        <AppSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeNav={activeNav}
          onNavSelect={(key) => setActiveNav(key)}
          currentWorkspace={currentWorkspace}
          onWorkspaceChange={setCurrentWorkspace}
          onTeamSelect={setSelectedTeamId}
        />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col min-w-0">
          <DashboardHeader
            sidebarOpen={sidebarOpen}
            onOpenSidebar={() => setSidebarOpen(true)}
            activeNavTitle={navTitles[activeNav]}
            workspaceName={currentWorkspace}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            onNewItemClick={openCreateItem}
          />

          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto outline-none"
          >
            {activeNav === "overview" || activeNav === "my_work" || activeNav === "all_work_items" ? (
              children
            ) : (
              <div className="rounded-xl border border-white/[0.08] bg-[#111114]/90 p-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-indigo-400">
                  <span className="font-mono text-sm font-semibold">OPS</span>
                </div>
                <h2 className="mt-4 text-base font-medium text-zinc-200">
                  {navTitles[activeNav]} View
                </h2>
                <p className="mt-1 text-xs text-zinc-400 max-w-md mx-auto">
                  This section is configured in the operations hierarchy. Click &quot;Overview&quot; in the left sidebar to return to the primary command center.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveNav("overview")}
                  className="mt-4 inline-flex items-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                >
                  Back to Overview
                </button>
              </div>
            )}
          </main>
        </div>

        {/* Work Item Creation Dialog */}
        <CreateItemDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={triggerRefresh}
        />

        {/* Work Item Detail & Audit Drawer */}
        <WorkItemDrawer
          itemId={selectedItemId}
          isOpen={!!selectedItemId}
          onClose={() => setSelectedItemId(null)}
          onItemUpdated={triggerRefresh}
        />
      </div>
    </DashboardContext.Provider>
  )
}
