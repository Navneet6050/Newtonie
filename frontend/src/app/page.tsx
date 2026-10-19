"use client"

import * as React from "react"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { MetricCard } from "@/components/dashboard/metric-card"
import { WorkQueue } from "@/components/dashboard/work-queue"
import { useAuth } from "@/lib/auth-context"

export default function Home() {
  const { user } = useAuth()
  const greetingName = user?.name ? user.name.split(" ")[0] : "Alex"

  return (
    <DashboardShell>
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
              Here’s what’s happening across your workspace.
            </p>
          </div>

          {/* Compact Date Label & System Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300">
              <Calendar className="size-3.5 text-zinc-400" aria-hidden="true" />
              <time dateTime="2026-10-19">Monday, Oct 19, 2026</time>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <span className="font-medium text-[11px] tracking-wide uppercase">Ops Normal</span>
            </div>
          </div>
        </section>

        {/* Four Polished Metric Cards */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="sr-only">
            Workspace Metrics
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Open Work Items"
              value={128}
              contextLabel="42 urgent priority · 86 backlog"
              icon={Layers}
              statusVariant="info"
            />
            <MetricCard
              title="In Progress"
              value={36}
              contextLabel="14 active sprint · 8 in code review"
              icon={Clock}
              statusVariant="default"
            />
            <MetricCard
              title="Completed This Week"
              value={24}
              contextLabel="Target: 30 items · 6 remaining"
              icon={CheckCircle2}
              statusVariant="success"
            />
            <MetricCard
              title="Overdue"
              value={7}
              contextLabel="Requires triage · 3 blocked by infra"
              icon={AlertTriangle}
              statusVariant="warning"
            />
          </div>
        </section>

        {/* Work Queue Section */}
        <WorkQueue />
      </div>
    </DashboardShell>
  )
}
