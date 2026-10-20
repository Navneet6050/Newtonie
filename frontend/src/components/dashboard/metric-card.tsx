import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CountUp } from "@/components/ui/count-up"
import { SpotlightCard } from "@/components/ui/spotlight-card"

export interface MetricCardProps {
  title: string
  value: string | number
  contextLabel: string
  icon: LucideIcon
  statusVariant?: "default" | "warning" | "success" | "info"
  isLoading?: boolean
}

export function MetricCard({
  title,
  value,
  contextLabel,
  icon: Icon,
  statusVariant = "default",
  isLoading = false,
}: MetricCardProps) {
  const variantStyles = {
    default: {
      iconColor: "text-zinc-400",
      indicator: "bg-zinc-500",
    },
    info: {
      iconColor: "text-blue-400",
      indicator: "bg-blue-500",
    },
    success: {
      iconColor: "text-emerald-400",
      indicator: "bg-emerald-500",
    },
    warning: {
      iconColor: "text-rose-400",
      indicator: "bg-rose-500",
    },
  }[statusVariant]

  const isPlaceholder = isLoading && (value === "…" || value === "" || value === undefined)

  return (
    <SpotlightCard
      role="region"
      aria-label={`${title}: ${isPlaceholder ? "Loading" : value}. ${contextLabel}`}
      className="group relative flex flex-col justify-between rounded-lg border border-white/[0.06] bg-[#0c0d10] p-3 transition-colors hover:border-white/[0.12] hover:bg-[#0f1013]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-zinc-400 truncate">
          {title}
        </span>
        <Icon className={cn("size-3.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity", variantStyles.iconColor)} aria-hidden="true" />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-xl font-bold tracking-tight text-zinc-100 tabular-nums">
          {isPlaceholder ? (
            <span className="inline-block h-6 w-10 rounded bg-white/[0.07] animate-pulse motion-reduce:animate-none align-middle" />
          ) : (
            <CountUp value={value} />
          )}
        </span>
        <span className="text-[11px] text-zinc-400 truncate">
          {contextLabel}
        </span>
      </div>
    </SpotlightCard>
  )
}

