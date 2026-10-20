"use client"

import * as React from "react"
import { X } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { AuthCard } from "@/components/auth/auth-card"

export function LoginDialog() {
  const { showLoginModal, setShowLoginModal, user } = useAuth()

  // Dismiss dialog on Escape key if user is authenticated (switching operator)
  React.useEffect(() => {
    if (!showLoginModal || !user) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowLoginModal(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showLoginModal, setShowLoginModal, user])

  if (!showLoginModal) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150 motion-reduce:animate-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && user) {
          setShowLoginModal(false)
        }
      }}
    >
      <div className="relative w-full max-w-sm rounded-xl border border-white/[0.08] bg-[#0f1013] p-5 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none">
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

