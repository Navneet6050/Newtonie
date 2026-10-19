"use client"

import * as React from "react"
import { AppSidebar, type NavItemKey } from "./app-sidebar"
import { DashboardHeader } from "./dashboard-header"

interface SearchContextValue {
  searchQuery: string
  setSearchQuery: (query: string) => void
}

export const DashboardSearchContext = React.createContext<SearchContextValue>({
  searchQuery: "",
  setSearchQuery: () => {},
})

export const useDashboardSearch = () => React.useContext(DashboardSearchContext)

interface DashboardShellProps {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [activeNav, setActiveNav] = React.useState<NavItemKey>("overview")
  const [currentWorkspace, setCurrentWorkspace] = React.useState("Acme Studio")
  const [searchQuery, setSearchQuery] = React.useState("")

  const navTitles: Record<NavItemKey, string> = {
    overview: "Overview",
    my_work: "My Work",
    all_work_items: "All Work Items",
    teams: "Teams",
    activity: "Activity",
  }

  return (
    <DashboardSearchContext.Provider value={{ searchQuery, setSearchQuery }}>
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
          />

          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto outline-none"
          >
            {activeNav === "overview" ? (
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
      </div>
    </DashboardSearchContext.Provider>
  )
}
