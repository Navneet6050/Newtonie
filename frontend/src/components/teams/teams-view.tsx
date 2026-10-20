"use client"

import * as React from "react"
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronRight,
  Layers,
  RotateCw,
  Search,
  Shield,
  UserCheck,
  Users2,
} from "lucide-react"
import { SpotlightCard } from "@/components/ui/spotlight-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useDashboard } from "@/components/dashboard/dashboard-shell"
import { useAuth } from "@/lib/auth-context"
import { type BackendTeam, fetchTeams } from "@/lib/api"
import { cn } from "cn"

export function TeamsView() {
  const { user } = useAuth()
  const { selectedTeamId, setSelectedTeamId, setCurrentWorkspace, setActiveNav, refreshKey } =
    useDashboard()

  const [teams, setTeams] = React.useState<BackendTeam[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  const handleRefresh = React.useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchTeams()
      .then((data) => {
        setTeams(data)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load teams directory.")
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  React.useEffect(() => {
    let isMounted = true
    fetchTeams()
      .then((data) => {
        if (isMounted) {
          setTeams(data)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load teams directory.")
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [refreshKey])

  const filteredTeams = React.useMemo(() => {
    if (!searchQuery.trim()) return teams
    const q = searchQuery.toLowerCase()
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(q) ||
        (team.description && team.description.toLowerCase().includes(q)) ||
        team.members.some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            m.role.toLowerCase().includes(q)
        )
    )
  }, [teams, searchQuery])

  const handleSelectTeam = (team: BackendTeam) => {
    setSelectedTeamId(team.id)
    setCurrentWorkspace(team.name)
    setActiveNav("overview")
  }

  const formatJoinedDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    } catch {
      return dateStr
    }
  }

  const getRoleBadge = (role: string) => {
    const normalized = role.toUpperCase()
    if (normalized === "TEAM_LEAD" || normalized === "LEAD") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/20 font-mono">
          <Shield className="size-2.5" />
          Lead
        </span>
      )
    }
    if (normalized === "ADMIN") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-300 border border-purple-500/20 font-mono">
          Admin
        </span>
      )
    }
    return (
      <span className="inline-flex items-center rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 border border-white/[0.06] font-mono">
        Member
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <section
        aria-labelledby="teams-directory-heading"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.05] pb-3"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1
              id="teams-directory-heading"
              className="text-base sm:text-lg font-semibold tracking-tight text-zinc-100"
            >
              Teams Directory
            </h1>
            <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/20 font-mono">
              {isLoading ? "…" : `${teams.length} ${teams.length === 1 ? "Team" : "Teams"}`}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Authorized engineering pods and operations units in your security scope.
          </p>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams or members…"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex size-7.5 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Refresh teams directory"
            title="Refresh teams"
          >
            <RotateCw className={cn("size-3.5", isLoading && "animate-spin")} />
          </button>
        </div>
      </section>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="underline hover:text-rose-200 inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <RotateCw className="size-3" /> Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton on Initial Load */}
      {isLoading && teams.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="rounded-xl border border-white/[0.08] bg-[#111114]/90 p-5 space-y-4 animate-pulse motion-reduce:animate-none"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-40 rounded bg-white/[0.06]" />
                  <div className="h-3 w-64 rounded bg-white/[0.03]" />
                </div>
                <div className="size-8 rounded-lg bg-white/[0.04]" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-24 rounded bg-white/[0.04]" />
                <div className="h-6 w-28 rounded bg-white/[0.04]" />
              </div>
              <div className="space-y-2 pt-2 border-t border-white/[0.04]">
                <div className="h-4 w-20 rounded bg-white/[0.04]" />
                <div className="space-y-1.5">
                  {[1, 2, 3].map((m) => (
                    <div key={m} className="h-8 rounded bg-white/[0.02]" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredTeams.length === 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111114]/90 p-8 text-center space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-zinc-400">
            <Users2 className="size-6 text-indigo-400" />
          </div>
          <h2 className="text-sm font-medium text-zinc-200">
            {searchQuery ? "No matching teams found" : "No Teams Available"}
          </h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {searchQuery
              ? `No teams or members match "${searchQuery}". Try modifying your search filter.`
              : "You do not have any authorized teams configured. Contact your workspace administrator for access."}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-2 inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>
      )}

      {/* Teams Grid */}
      {!isLoading && !error && filteredTeams.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTeams.map((team) => {
            const isCurrentScope = selectedTeamId === team.id
            const isUserMember = team.members.some((m) => m.userId === user?.id)

            return (
              <SpotlightCard
                key={team.id}
                className="rounded-xl border border-white/[0.08] bg-[#111114]/90 p-5 space-y-4 hover:border-white/[0.14] transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Team Top Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 mt-0.5">
                        <Users2 className="size-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-semibold tracking-tight text-zinc-100 truncate">
                            {team.name}
                          </h2>
                          {isCurrentScope && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/20 font-mono">
                              <Check className="size-2.5" /> Active Scope
                            </span>
                          )}
                          {isUserMember && !isCurrentScope && (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/20 font-mono">
                              <UserCheck className="size-2.5" /> Your Team
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                          {team.description || "Operational unit and service pod."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Operational Telemetry Tags */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-zinc-300 font-mono">
                      <Users2 className="size-3 text-zinc-400" />
                      <span>
                        <strong className="text-zinc-100">{team.memberCount}</strong> members
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-zinc-300 font-mono">
                      <Layers className="size-3 text-zinc-400" />
                      <span>
                        <strong className="text-zinc-100">{team.workItemCount}</strong> work items
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-zinc-400 font-mono hidden sm:inline-flex">
                      <Calendar className="size-3 text-zinc-500" />
                      <span>Created {formatJoinedDate(team.createdAt)}</span>
                    </div>
                  </div>

                  {/* Team Members Roster */}
                  <div className="space-y-2 pt-2 border-t border-white/[0.05]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-zinc-400 uppercase tracking-wider text-[10px]">
                        Roster ({team.members.length})
                      </span>
                    </div>

                    {team.members.length > 0 ? (
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {team.members.map((member) => {
                          const isSelf = member.userId === user?.id

                          return (
                            <div
                              key={member.userId}
                              className={cn(
                                "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs border border-white/[0.03] transition-colors",
                                isSelf ? "bg-indigo-500/[0.04] border-indigo-500/20" : "bg-white/[0.01]"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar size="sm" className="size-5.5 border border-white/[0.1]">
                                  <AvatarFallback className="bg-indigo-950/80 text-indigo-300 text-[9px] font-semibold">
                                    {member.avatarInitials || member.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-zinc-200 truncate block text-[11px]">
                                      {member.name}
                                    </span>
                                    {isSelf && (
                                      <span className="text-[9px] font-mono text-indigo-400">(You)</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-zinc-400 truncate block font-mono">
                                    {member.email}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 pl-2">{getRoleBadge(member.role)}</div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-white/[0.06] bg-white/[0.01] p-3 text-center space-y-0.5">
                        <p className="text-xs font-medium text-zinc-300">No members assigned</p>
                        <p className="text-[11px] text-zinc-500">This workspace hasn&apos;t been staffed yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400 truncate">
                    ID: {team.id.slice(0, 8)}…
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectTeam(team)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      isCurrentScope
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                        : "border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                    )}
                  >
                    <span>{isCurrentScope ? "View Active Queue" : "Switch Scope"}</span>
                    <ChevronRight className="size-3" />
                  </button>
                </div>
              </SpotlightCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
