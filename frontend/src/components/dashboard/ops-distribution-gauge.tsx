"use client"

import * as React from "react"
import { CheckCircle2, Clock, AlertTriangle, Layers, ShieldCheck } from "lucide-react"
import { type BackendWorkItemMetrics } from "@/lib/api"
import { cn } from "@/lib/utils"

interface OpsDistributionGaugeProps {
  metrics: BackendWorkItemMetrics | null
  isLoading?: boolean
}

export function OpsDistributionGauge({ metrics, isLoading }: OpsDistributionGaugeProps) {
  if (isLoading) {
    return (
      <div className="surface-elevated rounded-xl p-5 border border-white/[0.08] animate-pulse space-y-3">
        <div className="h-4 w-56 bg-zinc-800/80 rounded" />
        <div className="h-2.5 w-full bg-zinc-800/60 rounded-full" />
      </div>
    )
  }

  if (!metrics || metrics.totalCount === 0) {
    return null
  }

  const {
    openCount,
    inProgressCount,
    reviewNeededCount,
    completedCount,
    blockedCount,
    totalCount,
  } = metrics

  const inProgressPct = Math.max(0, Math.round((inProgressCount / totalCount) * 100))
  const reviewPct = Math.max(0, Math.round((reviewNeededCount / totalCount) * 100))
  const blockedPct = Math.max(0, Math.round((blockedCount / totalCount) * 100))
  const completedPct = Math.max(0, Math.round((completedCount / totalCount) * 100))
  const openPct = Math.max(0, 100 - inProgressPct - reviewPct - blockedPct - completedPct)

  const segments = [
    {
      name: "In Progress",
      count: inProgressCount,
      pct: inProgressPct,
      color: "bg-amber-400",
      textColor: "text-amber-400",
      borderColor: "border-amber-400/30",
      icon: Clock,
    },
    {
      name: "Open",
      count: openCount,
      pct: openPct,
      color: "bg-zinc-400",
      textColor: "text-zinc-400",
      borderColor: "border-zinc-400/30",
      icon: Layers,
    },
    {
      name: "Review Needed",
      count: reviewNeededCount,
      pct: reviewPct,
      color: "bg-indigo-400",
      textColor: "text-indigo-400",
      borderColor: "border-indigo-400/30",
      icon: ShieldCheck,
    },
    {
      name: "Blocked",
      count: blockedCount,
      pct: blockedPct,
      color: "bg-rose-500",
      textColor: "text-rose-400",
      borderColor: "border-rose-500/30",
      icon: AlertTriangle,
    },
    {
      name: "Completed",
      count: completedCount,
      pct: completedPct,
      color: "bg-emerald-400",
      textColor: "text-emerald-400",
      borderColor: "border-emerald-400/30",
      icon: CheckCircle2,
    },
  ]

  return (
    <section
      aria-label="Operational Telemetry & Distribution"
      className="surface-elevated rounded-xl p-5 border border-white/[0.08] relative overflow-hidden"
    >
      {/* Subtle background glow */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-indigo-500/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.05] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Workspace Operational Health
            </h2>
          </div>
          <p className="text-xs text-zinc-400">
            Real-time status allocation across {totalCount} tracked operations
          </p>
        </div>

        {/* Lightweight CSS 3D Perspective Indicator */}
        <div className="flex items-center gap-3">
          <div
            className="group relative flex size-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 [perspective:600px]"
            title="Active 3D Telemetry Node"
            aria-hidden="true"
          >
            <div className="size-4 rounded-xs border border-indigo-400 bg-indigo-500/30 transition-transform duration-500 ease-out group-hover:[transform:rotateX(35deg)_rotateY(45deg)] [transform-style:preserve-3d] shadow-xs" />
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold font-mono text-zinc-200 tabular-nums">
              {completedPct}%
            </div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
              Resolution Rate
            </div>
          </div>
        </div>
      </div>

      {/* Multi-segment Distribution Bar */}
      <div className="mt-4 space-y-2">
        <div
          role="meter"
          aria-label={`Operations distribution: ${completedPct}% completed, ${inProgressPct}% in progress, ${openPct}% open, ${reviewPct}% review, ${blockedPct}% blocked`}
          aria-valuenow={completedPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-900 flex shadow-inner border border-white/[0.05]"
        >
          {segments.map((seg) => (
            <div
              key={seg.name}
              style={{ width: `${seg.pct}%` }}
              className={cn(
                "h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full hover:brightness-125 cursor-help",
                seg.color
              )}
              title={`${seg.name}: ${seg.count} (${seg.pct}%)`}
            />
          ))}
        </div>

        {/* Segment Breakdown Labels */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
          {segments.map((seg) => {
            const Icon = seg.icon
            return (
              <div
                key={seg.name}
                className="flex items-center gap-2 rounded-lg border border-white/[0.03] bg-white/[0.01] px-2.5 py-1.5 transition-colors hover:bg-white/[0.03]"
              >
                <div
                  className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", seg.borderColor)}
                  aria-hidden="true"
                >
                  <Icon className={cn("size-2.5", seg.textColor)} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-semibold text-zinc-200 font-mono tabular-nums">
                      {seg.count}
                    </span>
                    <span className="text-[10px] text-zinc-400">({seg.pct}%)</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">{seg.name}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
