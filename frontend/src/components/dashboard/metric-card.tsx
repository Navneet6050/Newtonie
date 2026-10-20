import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MetricCardProps {
  title: string
  value: string | number
  contextLabel: string
  icon: LucideIcon
  statusVariant?: "default" | "warning" | "success" | "info"
}

export function MetricCard({
  title,
  value,
  contextLabel,
  icon: Icon,
  statusVariant = "default",
}: MetricCardProps) {
  const variantStyles = {
    default: {
      iconBg: "bg-zinc-800/60 text-zinc-300 border-zinc-700/50",
      accentGlow: "group-hover:border-zinc-700/80",
      indicator: "bg-zinc-500",
    },
    info: {
      iconBg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      accentGlow: "group-hover:border-indigo-500/30",
      indicator: "bg-indigo-500",
    },
    success: {
      iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accentGlow: "group-hover:border-emerald-500/30",
      indicator: "bg-emerald-500",
    },
    warning: {
      iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      accentGlow: "group-hover:border-amber-500/30",
      indicator: "bg-amber-500",
    },
  }[statusVariant]

  return (
    <div
      role="region"
      aria-label={`${title}: ${value}. ${contextLabel}`}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl surface-elevated p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-lg",
        variantStyles.accentGlow
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            {title}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-zinc-100 font-mono tabular-nums">
              {value}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border shadow-xs transition-transform duration-200 group-hover:scale-105",
            variantStyles.iconBg
          )}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-white/[0.04] pt-3">
        <span
          className={cn("size-1.5 shrink-0 rounded-full", variantStyles.indicator)}
          aria-hidden="true"
        />
        <p className="text-xs text-zinc-400 truncate">{contextLabel}</p>
      </div>
    </div>
  )
}
