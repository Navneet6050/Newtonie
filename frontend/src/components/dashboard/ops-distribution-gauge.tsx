"use client"

import * as React from "react"
import { motion } from "motion/react"
import { type BackendWorkItemMetrics } from "@/lib/api"
import { cn } from "@/lib/utils"
import { SpotlightCard } from "@/components/ui/spotlight-card"

let gaugeIntroPlayed = false

interface OpsDistributionGaugeProps {
  metrics: BackendWorkItemMetrics | null
  isLoading?: boolean
}

export function OpsDistributionGauge({ metrics, isLoading }: OpsDistributionGaugeProps) {
  const [animateIn] = React.useState(() => !gaugeIntroPlayed)
  React.useEffect(() => {
    gaugeIntroPlayed = true
  }, [])
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
    <SpotlightCard
      role="region"
      aria-label="Queue status distribution"
      className="rounded-lg border border-white/[0.06] bg-[#0c0d10] p-2.5 space-y-2"
    >
      {/* Top Header Label */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
          <span className="font-medium text-zinc-200">
            Queue Status Distribution
          </span>
          <span className="text-zinc-400 text-[11px] tabular-nums">
            ({totalCount} items)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="text-zinc-200 font-medium tabular-nums">{openCount + inProgressCount + reviewNeededCount + blockedCount}</span>
          <span>active</span>
          <span className="text-zinc-600">·</span>
          <span className="text-emerald-400 font-medium tabular-nums">{completedCount}</span>
          <span>completed</span>
        </div>
      </div>

      {/* Segmented Distribution Bar */}
      <motion.div
        initial={animateIn ? { clipPath: "inset(0 100% 0 0)" } : false}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-900 border border-white/[0.04]"
        role="meter"
        aria-label={`Status distribution: ${openCount} open, ${inProgressCount} in progress, ${reviewNeededCount} review, ${blockedCount} blocked, ${completedCount} completed`}
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={totalCount}
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
      </motion.div>

      {/* Bottom Segment Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {segments.map((seg) => (
          <div key={seg.name} className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full shrink-0", seg.dotColor)} aria-hidden="true" />
            <span className="text-zinc-400">{seg.name}:</span>
            <span className={cn("font-medium tabular-nums", seg.textColor)}>
              {seg.count}
            </span>
            <span className="text-[10px] text-zinc-400 tabular-nums">({seg.pct}%)</span>
          </div>
        ))}
      </div>
    </SpotlightCard>
  )
}
