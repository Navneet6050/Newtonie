"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  Plus,
  RotateCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardShell, useDashboard } from "@/components/dashboard/dashboard-shell"
import { MetricCard } from "@/components/dashboard/metric-card"
import { OpsDistributionGauge } from "@/components/dashboard/ops-distribution-gauge"
import { WorkQueue } from "@/components/dashboard/work-queue"
import { useAuth } from "@/lib/auth-context"
import { type BackendWorkItemMetrics, fetchWorkItemMetrics } from "@/lib/api"

function DashboardContent() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { refreshKey, selectedTeamId, currentWorkspace, openCreateItem } = useDashboard()
  const router = useRouter()

  const [metrics, setMetrics] = React.useState<BackendWorkItemMetrics | null>(null)
  const [isLoadingMetrics, setIsLoadingMetrics] = React.useState(false)
  const [metricsError, setMetricsError] = React.useState<string | null>(null)

  // Coherent unauthenticated entry: redirect unauthenticated sessions to /login
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [isLoading, isAuthenticated, router])

  const loadMetrics = React.useCallback(() => {
    if (!isAuthenticated) return

    setIsLoadingMetrics(true)
    setMetricsError(null)
    fetchWorkItemMetrics(selectedTeamId)
      .then((data) => {
        setMetrics(data)
      })
      .catch((err: unknown) => {
        setMetricsError(err instanceof Error ? err.message : "Failed to load workspace metrics.")
      })
      .finally(() => {
        setIsLoadingMetrics(false)
      })
  }, [isAuthenticated, selectedTeamId])

  React.useEffect(() => {
    if (!isAuthenticated) return

    let isMounted = true
    fetchWorkItemMetrics(selectedTeamId)
      .then((data) => {
        if (isMounted) setMetrics(data)
      })
      .catch((err: unknown) => {
        if (isMounted) setMetricsError(err instanceof Error ? err.message : "Failed to load workspace metrics.")
      })
      .finally(() => {
        if (isMounted) setIsLoadingMetrics(false)
      })

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, selectedTeamId, refreshKey])

  const formattedToday = React.useMemo(() => {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }, [])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-3">
        <div className="relative flex size-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <p className="text-xs text-zinc-400 font-mono">Connecting to operations console…</p>
      </div>
    )
  }

  const roleLabel = user?.systemRole === "ADMIN" ? "System Admin" : "Team Operator"

  return (
    <div className="space-y-3.5">
      {/* 1. Compact Operational Console Header Bar & Primary Action */}
      <section
        aria-labelledby="dashboard-overview-heading"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.05] pb-3 select-none"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              id="dashboard-overview-heading"
              className="text-base sm:text-lg font-semibold tracking-tight text-zinc-100"
            >
              Operations Command
            </h1>
            <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/20">
              {roleLabel}
            </span>
            <span className="text-zinc-600 text-xs hidden sm:inline">•</span>
            <span className="text-xs text-zinc-400 hidden sm:inline font-medium">
              {currentWorkspace}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Real-time operations queue and incident orchestration.
          </p>
        </div>

        {/* Live Cluster Status, Date, & Primary Action */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60 [animation-duration:2s] motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-medium tracking-wide">OPS CLUSTER ONLINE</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] text-zinc-400">
            <Calendar className="size-3 text-zinc-500" aria-hidden="true" />
            <span>{formattedToday}</span>
          </div>
          <Button
            size="sm"
            onClick={openCreateItem}
            className="h-7 sm:h-7.5 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-2.5 sm:px-3 rounded-md shadow-xs cursor-pointer shrink-0 transition-colors"
          >
            <Plus className="size-3.5" />
            <span>New Work Item</span>
          </Button>
        </div>
      </section>

      {/* Onboarding Notice for Incomplete Workspace Provisioning */}
      {user && user.systemRole !== "ADMIN" && (!user.teams || user.teams.length === 0) && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 sm:p-4 text-xs text-amber-200 animate-in fade-in duration-200"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/20 text-amber-300">
            <AlertCircle className="size-4" />
          </div>
          <div className="space-y-1 text-left">
            <div className="font-semibold text-white text-xs">
              Workspace Provisioning Incomplete
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              Your account is active, but your personal workspace has not finished provisioning. Refresh your browser to retry automatic setup, or contact support (<span className="font-mono text-white/90">admin@newtonite.com</span>) if this message persists.
            </p>
          </div>
        </div>
      )}

      {/* 2. Four Operational Metric Cards */}
      <section aria-labelledby="metrics-heading" className="space-y-2">
        <h2 id="metrics-heading" className="sr-only">
          Workspace Metrics
        </h2>

        {metricsError && (
          <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{metricsError}</span>
            </div>
            <button
              type="button"
              onClick={loadMetrics}
              className="underline hover:text-rose-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className="size-3" /> Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Open Work Items"
            value={isLoadingMetrics && !metrics ? "…" : metrics?.openCount ?? 0}
            contextLabel={
              metrics
                ? `${metrics.openCount} items awaiting intake`
                : "Active backlog"
            }
            icon={Layers}
            statusVariant="info"
            isLoading={isLoadingMetrics && !metrics}
          />
          <MetricCard
            title="In Progress"
            value={isLoadingMetrics && !metrics ? "…" : metrics?.inProgressCount ?? 0}
            contextLabel={
              metrics
                ? `${metrics.reviewNeededCount} awaiting review`
                : "Active sprint items"
            }
            icon={Clock}
            statusVariant="default"
            isLoading={isLoadingMetrics && !metrics}
          />
          <MetricCard
            title="Completed"
            value={isLoadingMetrics && !metrics ? "…" : metrics?.completedCount ?? 0}
            contextLabel={
              metrics
                ? `${Math.round((metrics.completedCount / Math.max(1, metrics.totalCount)) * 100)}% resolution rate`
                : "Completed backlog"
            }
            icon={CheckCircle2}
            statusVariant="success"
            isLoading={isLoadingMetrics && !metrics}
          />
          <MetricCard
            title="Blocked & Urgent"
            value={isLoadingMetrics && !metrics ? "…" : metrics?.blockedOrUrgentCount ?? 0}
            contextLabel={
              metrics
                ? `${metrics.blockedCount} blocked · ${metrics.urgentCount} urgent`
                : "Immediate attention queue"
            }
            icon={AlertTriangle}
            statusVariant="warning"
            isLoading={isLoadingMetrics && !metrics}
          />
        </div>
      </section>

      {/* 3. Operational Status Distribution Visualization */}
      {metrics && metrics.totalCount > 0 && (
        <OpsDistributionGauge metrics={metrics} isLoading={isLoadingMetrics} />
      )}

      {/* Primary Hero: Live Operations Queue */}
      <WorkQueue />
    </div>
  )
}

export default function Home() {
  return (
    <DashboardShell>
      <DashboardContent />
    </DashboardShell>
  )
}
