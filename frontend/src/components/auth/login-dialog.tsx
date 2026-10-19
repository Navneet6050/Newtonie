"use client"

import * as React from "react"
import { AlertCircle, KeyRound, Loader2, Lock, Shield, User, X } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SeedUser {
  name: string
  email: string
  role: string
  team: string
}

const SEED_USERS: SeedUser[] = [
  {
    name: "Alex Morgan",
    email: "alex.morgan@acme.internal",
    role: "System Admin",
    team: "Acme Studio",
  },
  {
    name: "Sarah Chen",
    email: "sarah.chen@acme.internal",
    role: "Member",
    team: "Acme Studio",
  },
  {
    name: "Liam Vance",
    email: "liam.vance@acme.internal",
    role: "Team Lead",
    team: "Acme Platform",
  },
]

export function LoginDialog() {
  const { showLoginModal, setShowLoginModal, login, user } = useAuth()
  const [email, setEmail] = React.useState("alex.morgan@acme.internal")
  const [password, setPassword] = React.useState("NewtoniteDev2026!")
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  if (!showLoginModal) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Invalid credentials")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSelectSeed = (seed: SeedUser) => {
    setEmail(seed.email)
    setPassword("NewtoniteDev2026!")
    setError(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-dialog-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-white/[0.08] bg-[#111114] p-6 shadow-2xl text-zinc-100">
        {/* Close Button */}
        {user && (
          <button
            type="button"
            onClick={() => setShowLoginModal(false)}
            className="absolute top-4 right-4 rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        )}

        {/* Dialog Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
          <div className="flex size-9 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
            <Lock className="size-4" />
          </div>
          <div>
            <h2 id="login-dialog-title" className="text-base font-semibold text-zinc-100">
              Operations Sign In
            </h2>
            <p className="text-xs text-zinc-400">
              Authenticate with your workspace credentials
            </p>
          </div>
        </div>

        {/* Quick Seed Profiles */}
        <div className="my-4">
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Shield className="size-3 text-indigo-400" />
            Quick Dev Accounts
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SEED_USERS.map((seed) => {
              const isSelected = email === seed.email
              return (
                <button
                  key={seed.email}
                  type="button"
                  onClick={() => handleSelectSeed(seed)}
                  className={`flex flex-col items-start rounded-lg border p-2 text-left transition-colors ${
                    isSelected
                      ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-200"
                      : "border-white/[0.06] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="text-xs font-medium truncate w-full">{seed.name}</span>
                  <span className="text-[10px] text-zinc-400 truncate w-full">{seed.team}</span>
                  <span className="mt-1 text-[9px] font-mono text-zinc-500 uppercase">{seed.role}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="size-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="auth-email-input"
              className="text-xs font-medium text-zinc-300"
            >
              Email Address
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 size-4 text-zinc-500" />
              <Input
                id="auth-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@acme.internal"
                className="pl-9 bg-white/[0.03] border-white/[0.08] text-xs text-zinc-200 focus-visible:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="auth-password-input"
              className="text-xs font-medium text-zinc-300"
            >
              Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 size-4 text-zinc-500" />
              <Input
                id="auth-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="pl-9 bg-white/[0.03] border-white/[0.08] text-xs text-zinc-200 focus-visible:border-indigo-500"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2 rounded-lg transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Authenticating...
              </span>
            ) : (
              "Sign In to Operations Console"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
