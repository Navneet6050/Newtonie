"use client"

import * as React from "react"
import { X } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { AuthCard } from "@/components/auth/auth-card"

export function LoginDialog() {
  const { showLoginModal, setShowLoginModal, user } = useAuth()

  if (!showLoginModal) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-dialog-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] surface-overlay p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
        {/* Close Button (if user is authenticated, e.g. switching accounts) */}
        {user && (
          <button
            type="button"
            onClick={() => setShowLoginModal(false)}
            className="absolute top-4 right-4 rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 z-10 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        )}

        <AuthCard onSuccess={() => setShowLoginModal(false)} isModal={true} />
      </div>
    </div>
  )
}

