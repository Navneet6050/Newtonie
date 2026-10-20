"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { AuthCard } from "@/components/auth/auth-card"
import { LoginBackground } from "@/components/auth/login-background"
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
      <LoginBackground />

      {/* Subtle radial ambient spotlight */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(99,102,241,0.12),rgba(0,0,0,0))]"
        aria-hidden="true"
      />

      {/* Top Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex items-center justify-between max-w-4xl w-full mx-auto"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/30 to-violet-600/30 border border-indigo-500/40 text-indigo-300">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" />
              <path d="M2 17L12 22L22 17" />
              <path d="M2 12L12 17L22 12" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            Newtonite
          </span>
        </div>
      </motion.div>

      {/* Center Auth Card Form */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center py-6">
        <AuthCard onSuccess={() => router.replace("/")} isModal={false} />
      </div>

      {/* Bottom Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="relative z-10 max-w-4xl w-full mx-auto text-center"
      >
        <p className="text-xs text-white/30">© 2026 Newtonite</p>
      </motion.div>
    </div>
  )
}
