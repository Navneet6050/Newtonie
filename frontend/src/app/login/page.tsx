"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Terminal, Shield } from "lucide-react"
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
    <div className="relative min-h-screen w-full bg-[#08090b] text-zinc-100 flex flex-col justify-between p-6 sm:p-8 overflow-y-auto select-none">
      {/* Subtle radial ambient spotlight */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(99,102,241,0.12),rgba(0,0,0,0))]"
        aria-hidden="true"
      />

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="flex size-6.5 shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-500/30 to-violet-600/30 border border-indigo-500/40 text-indigo-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" />
              <path d="M2 17L12 22L22 17" />
              <path d="M2 12L12 17L22 12" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-zinc-100">
            Newtonite
          </span>
          <span className="rounded bg-white/[0.06] px-1.5 py-0.2 text-[9px] font-mono font-medium text-zinc-400 border border-white/[0.06]">
            OPS
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-zinc-400">System Ready</span>
        </div>
      </div>

      {/* Center Auth Card Form */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center py-8">
        <AuthCard onSuccess={() => router.replace("/")} isModal={false} />
      </div>

      {/* Bottom Technical Specifications Footer */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-5xl w-full mx-auto border-t border-white/[0.05] pt-4 text-[11px] text-zinc-400 font-mono">
        <div className="flex items-center gap-2">
          <Shield className="size-3 text-indigo-400" />
          <span>Server-Enforced Team Isolation · RFC 7232 Optimistic Concurrency</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <Terminal className="size-3" />
          <span>Spring Boot 3.5 · PostgreSQL 16 · Next.js 16</span>
        </div>
      </div>
    </div>
  )
}

