"use client"

import * as React from "react"
import { type BackendWorkItemMetrics } from "@/lib/api"
import { cn } from "@/lib/utils"

interface OpsDistributionGaugeProps {
  metrics: BackendWorkItemMetrics | null
  isLoading?: boolean
}

export function OpsDistributionGauge({ metrics, isLoading }: OpsDistributionGaugeProps) {
  if (isLoading) {
    return (
      <div className="surface-subtle rounded-xl p-3 border border-white/[0.06] animate-pulse space-y-2">
        <div className="h-3 w-48 bg-zinc-800/80 rounded" />
        <div className="h-2 w-full bg-zinc-800/60 rounded-full" />
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
      name: "Open",
      count: openCount,
      pct: openPct,
      color: "bg-zinc-500",
      dotColor: "bg-zinc-400",
      textColor: "text-zinc-300",
    },
    {
      name: "In Progress",
      count: inProgressCount,
      pct: inProgressPct,
      color: "bg-blue-500",
      dotColor: "bg-blue-400",
      textColor: "text-blue-300",
    },
    {
      name: "Review Needed",
      count: reviewNeededCount,
      pct: reviewPct,
      color: "bg-amber-500",
      dotColor: "bg-amber-400",
      textColor: "text-amber-300",
    },
    {
      name: "Blocked",
      count: blockedCount,
      pct: blockedPct,
      color: "bg-rose-500",
      dotColor: "bg-rose-400",
      textColor: "text-rose-300",
    },
    {
      name: "Completed",
      count: completedCount,
      pct: completedPct,
      color: "bg-emerald-500",
      dotColor: "bg-emerald-400",
      textColor: "text-emerald-300",
    },
  ]

  return (
    <div
      role="region"
      aria-label="Queue status distribution"
      className="surface-subtle rounded-xl p-3.5 border border-white/[0.06] space-y-2.5"
    >
      {/* Top Header Label */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
            Queue Status Distribution
          </span>
          <span className="text-[11px] text-zinc-500">
            ({totalCount} items across authorized workspace)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
          <span className="text-zinc-200 font-semibold tabular-nums">{completedPct}%</span>
          <span>resolved</span>
        </div>
      </div>

      {/* Segmented Distribution Bar */}
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-900 border border-white/[0.05]"
        role="meter"
        aria-label={`Status distribution: ${completedPct}% completed, ${inProgressPct}% in progress, ${openPct}% open, ${reviewPct}% review, ${blockedPct}% blocked`}
        aria-valuenow={completedPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {segments.map((seg) => {
          if (seg.pct <= 0) return null
          return (
            <div
              key={seg.name}
              style={{ width: `${seg.pct}%` }}
              className={cn("h-full transition-all duration-300", seg.color)}
              title={`${seg.name}: ${seg.count} (${seg.pct}%)`}
            />
          )
        })}
      </div>

      {/* Bottom Segment Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-[11px]">
        {segments.map((seg) => (
          <div key={seg.name} className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full shrink-0", seg.dotColor)} aria-hidden="true" />
            <span className="text-zinc-400">{seg.name}</span>
            <span className={cn("font-mono font-medium tabular-nums", seg.textColor)}>
              {seg.count}
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">({seg.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
