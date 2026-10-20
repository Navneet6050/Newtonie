"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ShieldCheck,
  Cpu,
  Database,
  Layers,
  Terminal,
} from "lucide-react"
import { AuthCard } from "@/components/auth/auth-card"
import { useAuth } from "@/lib/auth-context"

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  // Redirect to dashboard if already authenticated
  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/")
    }
  }, [isAuthenticated, isLoading, router])

  return (
    <div className="relative min-h-screen w-full bg-[#09090b] text-zinc-100 flex flex-col lg:flex-row overflow-y-auto">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -left-40 -top-40 size-80 rounded-full bg-indigo-600/10 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-40 -bottom-40 size-80 rounded-full bg-violet-600/10 blur-[100px]"
        aria-hidden="true"
      />

      {/* Left Column: Enterprise Product Identity & Operational Context */}
      <div className="relative hidden lg:flex flex-col justify-between w-1/2 p-12 xl:p-16 border-r border-white/[0.06] bg-[#0c0c10]/70 backdrop-blur-md">
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
                OPERATIONS COMMAND
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Internal Engineering Work-Management Platform</p>
          </div>
        </div>

        {/* Center: Hero Statements & Technical Guarantees */}
        <div className="my-auto max-w-lg space-y-7 py-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Mission Critical Operations</span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-zinc-100 leading-tight">
              High-velocity queue triage and verified team-level authorization.
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Newtonite coordinates incident resolution and engineering tasks across isolated team workspaces with atomic claiming, strong concurrency preconditions, and append-only audit tracking.
            </p>
          </div>

          {/* Architectural Pillars */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-indigo-400 mt-0.5">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Server-Enforced Team Isolation</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Cross-team boundaries are enforced by backend security providers, preventing unauthorized reads and mutations across team workspaces.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-amber-400 mt-0.5">
                <Cpu className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Dual-Layer Optimistic Concurrency</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  RFC 7232 strong ETags and database-level atomic claiming prevent concurrent assignment conflicts and silent state overwrites.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-emerald-400 mt-0.5">
                <Database className="size-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">User-Scoped Idempotency & Collaboration</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  SHA-256 idempotency pipelines isolate replay caches per operator, paired with relational work-item comments and audit feeds.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Technical Specs Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-5 text-xs text-zinc-400">
          <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-400">
            <span>Spring Boot 3.5</span>
            <span className="text-zinc-700">•</span>
            <span>Java 25</span>
            <span className="text-zinc-700">•</span>
            <span>PostgreSQL 16</span>
            <span className="text-zinc-700">•</span>
            <span>Next.js 16</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <Terminal className="size-3 text-indigo-400" />
            <span>Node: local-01</span>
          </div>
        </div>
      </div>

      {/* Right Column: Centered Dedicated Authentication Card */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10 lg:p-12 min-h-screen">
        {/* Mobile Brand Header */}
        <div className="flex items-center gap-2.5 mb-6 lg:hidden justify-center">
          <div className="flex size-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
            <Layers className="size-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-zinc-100">Newtonite Operations</div>
            <div className="text-[10px] text-zinc-400">Internal Command Center</div>
          </div>
        </div>

        <AuthCard onSuccess={() => router.replace("/")} isModal={false} />
      </div>
    </div>
  )
}
