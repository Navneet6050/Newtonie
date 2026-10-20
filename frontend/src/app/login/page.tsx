"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Lock,
  ShieldCheck,
  Cpu,
  ArrowRight,
  Database,
} from "lucide-react"
import { AuthCard } from "@/components/auth/auth-card"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  // Redirect to dashboard if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, router])

  return (
    <div className="relative min-h-screen w-full bg-[#09090b] text-zinc-100 flex flex-col lg:flex-row overflow-hidden">
      {/* Background radial ambient lights */}
      <div
        className="pointer-events-none absolute -left-48 -top-48 size-96 rounded-full bg-indigo-600/10 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-48 -bottom-48 size-96 rounded-full bg-violet-600/10 blur-[120px]"
        aria-hidden="true"
      />

      {/* Left Column: Enterprise Product Identity & Operational Telemetry */}
      <div className="relative hidden lg:flex flex-col justify-between w-1/2 p-12 xl:p-16 border-r border-white/[0.06] bg-[#0c0c10]/60 backdrop-blur-md">
        {/* Top Brand Mark */}
        <div className="flex items-center gap-3">
          <div className="relative flex size-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/25 to-violet-600/15 shadow-sm">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-indigo-400"
              aria-hidden="true"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-zinc-100">Newtonite</span>
              <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-indigo-400 border border-indigo-500/20">
                ENTERPRISE
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Operations Command Platform</p>
          </div>
        </div>

        {/* Center: Mission Control Value Proposition */}
        <div className="my-auto max-w-lg space-y-8 py-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Mission Critical Operations Infrastructure</span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-zinc-100 leading-tight">
              Coordinate high-velocity engineering operations with absolute precision.
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Newtonite provides server-enforced team isolation, atomic claiming, optimistic concurrency, and tamper-evident activity history for engineering teams.
            </p>
          </div>

          {/* Core Architectural Guarantees */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-indigo-400 mt-0.5">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Zero-Trust Team Scoping</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Server-side authorization authority guarantees operators never access or modify peer team assets.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-amber-400 mt-0.5">
                <Cpu className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Optimistic Concurrency Control</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  E-Tag and version precondition checks protect against concurrent overwrites and data race conditions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-emerald-400 mt-0.5">
                <Database className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Idempotent Mutation Pipeline</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  UUID idempotency keys guarantee safely repeatable requests across unreliable networks.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Architectural Guarantees Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-6 text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-zinc-400">ACID Transactions</span>
            <span className="text-zinc-700">•</span>
            <span className="font-mono text-[11px] text-zinc-400">E-Tag Preconditions</span>
            <span className="text-zinc-700">•</span>
            <span className="font-mono text-[11px] text-zinc-400">Append-Only Audit</span>
          </div>
          <Link
            href="/"
            className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
          >
            <span>Overview</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Right Column: Centered Dedicated Authentication Card */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-12 lg:p-16 min-h-screen">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden justify-center">
            <div className="flex size-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Lock className="size-4" />
            </div>
            <span className="text-base font-bold text-zinc-100">Newtonite Operations</span>
          </div>

          <AuthCard onSuccess={() => router.push("/")} isModal={false} />
        </div>
      </div>
    </div>
  )
}
