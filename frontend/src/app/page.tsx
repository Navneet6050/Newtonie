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
  RotateCw,
} from "lucide-react"
import { DashboardShell, useDashboard } from "@/components/dashboard/dashboard-shell"
import { MetricCard } from "@/components/dashboard/metric-card"
import { OpsDistributionGauge } from "@/components/dashboard/ops-distribution-gauge"
import { WorkQueue } from "@/components/dashboard/work-queue"
import { useAuth } from "@/lib/auth-context"
import { type BackendWorkItemMetrics, fetchWorkItemMetrics } from "@/lib/api"

function DashboardContent() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { refreshKey, selectedTeamId, currentWorkspace } = useDashboard()
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
    <div className="space-y-3">
      {/* Operational Console Header Bar */}
      <section
        aria-labelledby="dashboard-overview-heading"
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.05] pb-2.5 select-none"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h1
              id="dashboard-overview-heading"
              className="text-base sm:text-lg font-semibold tracking-tight text-zinc-100"
            >
              Operations Command
            </h1>
            <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/20">
              {roleLabel}
            </span>
            <span className="text-zinc-500 text-xs hidden sm:inline">•</span>
            <span className="text-xs text-zinc-400 hidden sm:inline">
              {currentWorkspace}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Real-time operations queue and incident orchestration.
          </p>
        </div>

        {/* Live Cluster Status & Telemetry Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60 [animation-duration:2s] motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span>OPS CLUSTER ONLINE</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] text-zinc-400">
            <Calendar className="size-3 text-zinc-500" aria-hidden="true" />
            <span>Oct 20, 2026</span>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section aria-labelledby="metrics-heading" className="space-y-2">
        <h2 id="metrics-heading" className="sr-only">
          Workspace Metrics
        </h2>

        {metricsError && (
          <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-3.5" />
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
            value={isLoadingMetrics ? "…" : metrics?.openCount ?? 0}
            contextLabel={
              metrics
                ? `${metrics.urgentCount} urgent · ${metrics.totalCount} total in queue`
                : "Active backlog"
            }
            icon={Layers}
            statusVariant="info"
          />
          <MetricCard
            title="In Progress"
            value={isLoadingMetrics ? "…" : metrics?.inProgressCount ?? 0}
            contextLabel={
              metrics
                ? `${metrics.reviewNeededCount} awaiting review`
                : "Active sprint items"
            }
            icon={Clock}
            statusVariant="default"
          />
          <MetricCard
            title="Completed"
            value={isLoadingMetrics ? "…" : metrics?.completedCount ?? 0}
            contextLabel={
              metrics
                ? `${metrics.completedCount} of ${metrics.totalCount} items completed`
                : "Completed backlog"
            }
            icon={CheckCircle2}
            statusVariant="success"
          />
          <MetricCard
            title="Blocked & Urgent"
            value={isLoadingMetrics ? "…" : metrics?.blockedOrUrgentCount ?? 0}
            contextLabel={
              metrics
                ? `${metrics.blockedCount} blocked · ${metrics.urgentCount} urgent`
                : "Immediate attention queue"
            }
            icon={AlertTriangle}
            statusVariant="warning"
          />
        </div>
      </section>

      {/* Operational Distribution Ribbon */}
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
