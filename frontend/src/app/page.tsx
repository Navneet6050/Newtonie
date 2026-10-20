"use client"

import * as React from "react"
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  LogIn,
  RotateCw,
} from "lucide-react"
import Link from "next/link"
import { DashboardShell, useDashboard } from "@/components/dashboard/dashboard-shell"
import { MetricCard } from "@/components/dashboard/metric-card"
import { OpsDistributionGauge } from "@/components/dashboard/ops-distribution-gauge"
import { WorkQueue } from "@/components/dashboard/work-queue"
import { useAuth } from "@/lib/auth-context"
import { type BackendWorkItemMetrics, fetchWorkItemMetrics } from "@/lib/api"
import { Button } from "@/components/ui/button"

function DashboardContent() {
  const { user, setShowLoginModal, isAuthenticated } = useAuth()
  const { refreshKey, selectedTeamId } = useDashboard()

  const [metrics, setMetrics] = React.useState<BackendWorkItemMetrics | null>(null)
  const [isLoadingMetrics, setIsLoadingMetrics] = React.useState(false)
  const [metricsError, setMetricsError] = React.useState<string | null>(null)

  const loadMetrics = React.useCallback(() => {
    if (!isAuthenticated) {
      setMetrics(null)
      return
    }

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

  const greetingName = user?.name ? user.name.split(" ")[0] : "Operator"

  return (
    <div className="space-y-6">
      {/* Main Dashboard Header */}
      <section
        aria-labelledby="dashboard-overview-heading"
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-white/[0.06] pb-5"
      >
        <div className="space-y-1">
          <h1
            id="dashboard-overview-heading"
            className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl"
          >
            Good morning, {greetingName}
          </h1>
          <p className="text-sm text-zinc-400">
            {isAuthenticated
              ? "Here’s live operational telemetry across your authorized workspace."
              : "Sign in to access live operations, manage work items, and view queue metrics."}
          </p>
        </div>

        {/* Compact Date Label & System Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300">
            <Calendar className="size-3.5 text-zinc-400" aria-hidden="true" />
            <time dateTime="2026-10-20">Tuesday, Oct 20, 2026</time>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span className="font-medium text-[11px] tracking-wide uppercase">Ops Live</span>
          </div>
        </div>
      </section>

      {/* Unauthenticated Session Banner */}
      {!isAuthenticated && (
        <section
          aria-label="Authentication Required"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs text-indigo-200"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <LogIn className="size-4" />
            </div>
            <div>
              <div className="font-semibold text-zinc-100">
                Operator Authentication Required
              </div>
              <div className="text-zinc-400 mt-0.5">
                Sign in with enterprise credentials or dedicated operations access to execute live work-item workflows.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-indigo-500/40 bg-indigo-500/20 px-3.5 py-1.5 font-medium text-xs text-indigo-200 hover:bg-indigo-500/30 hover:text-white transition-colors"
            >
              Dedicated Sign In
            </Link>
            <Button
              size="sm"
              onClick={() => setShowLoginModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3.5 cursor-pointer"
            >
              Quick Modal
            </Button>
          </div>
        </section>
      )}

      {/* Metrics Section */}
      <section aria-labelledby="metrics-heading">
        <div className="flex items-center justify-between mb-2">
          <h2 id="metrics-heading" className="sr-only">
            Workspace Metrics
          </h2>
          {metricsError && (
            <div className="flex items-center gap-2 text-xs text-rose-400">
              <AlertCircle className="size-3.5" />
              <span>{metricsError}</span>
              <button
                type="button"
                onClick={loadMetrics}
                className="underline hover:text-rose-300 ml-1 inline-flex items-center gap-1"
              >
                <RotateCw className="size-3" /> Retry
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Open Work Items"
            value={isLoadingMetrics ? "..." : metrics?.openCount ?? 0}
            contextLabel={
              metrics
                ? `${metrics.urgentCount} urgent priority · ${metrics.totalCount} total`
                : "Awaiting operator session"
            }
            icon={Layers}
            statusVariant="info"
          />
          <MetricCard
            title="In Progress"
            value={isLoadingMetrics ? "..." : metrics?.inProgressCount ?? 0}
            contextLabel={
              metrics
                ? `${metrics.reviewNeededCount} awaiting peer review`
                : "Active sprint operations"
            }
            icon={Clock}
            statusVariant="default"
          />
          <MetricCard
            title="Completed"
            value={isLoadingMetrics ? "..." : metrics?.completedCount ?? 0}
            contextLabel={
              metrics && metrics.totalCount > 0
                ? `${Math.round((metrics.completedCount / metrics.totalCount) * 100)}% resolved rate`
                : "0 completed items"
            }
            icon={CheckCircle2}
            statusVariant="success"
          />
          <MetricCard
            title="Blocked & Urgent"
            value={
              isLoadingMetrics
                ? "..."
                : metrics?.blockedOrUrgentCount ?? 0
            }
            contextLabel={
              metrics
                ? `${metrics.blockedCount} blocked · ${metrics.urgentCount} urgent`
                : "Immediate triage queue"
            }
            icon={AlertTriangle}
            statusVariant="warning"
          />
        </div>
      </section>

      {/* Operational Distribution & Health Gauge */}
      {metrics && metrics.totalCount > 0 && (
        <OpsDistributionGauge metrics={metrics} isLoading={isLoadingMetrics} />
      )}

      {/* Work Queue Section */}
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
