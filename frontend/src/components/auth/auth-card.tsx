"use client"

import * as React from "react"
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  UserCheck,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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
    role: "Admin",
    team: "All Workspaces",
  },
  {
    name: "Sarah Chen",
    email: "sarah.chen@acme.internal",
    role: "Studio",
    team: "Acme Studio",
  },
  {
    name: "Liam Vance",
    email: "liam.vance@acme.internal",
    role: "Platform",
    team: "Acme Platform",
  },
]

interface AuthCardProps {
  onSuccess?: () => void
  isModal?: boolean
}

export function AuthCard({ onSuccess, isModal = false }: AuthCardProps) {
  const { login } = useAuth()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [rememberDevice, setRememberDevice] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activeSeedEmail, setActiveSeedEmail] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError("Please enter both corporate email and password.")
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      await login(email.trim(), password, rememberDevice)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Invalid credentials. Please verify your email and password.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSelectSeed = (seed: SeedUser) => {
    setEmail(seed.email)
    setPassword("NewtoniteDev2026!")
    setActiveSeedEmail(seed.email)
    setError(null)
  }

  return (
    <div
      className={cn(
        "w-full max-w-[410px] transition-all",
        isModal
          ? "p-1"
          : "rounded-xl border border-white/[0.08] bg-[#0d0e12] p-6 shadow-2xl"
      )}
    >
      {/* Brand & Security Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex size-6 items-center justify-center rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Lock className="size-3" />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Operations Access
            </span>
          </div>
          <span className="flex items-center gap-1.5 rounded border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] text-zinc-400">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Local Node
          </span>
        </div>

        <h1 className="text-lg font-semibold tracking-tight text-zinc-100 pt-1">
          Sign In to Newtonite
        </h1>
        <p className="text-xs text-zinc-400 leading-normal">
          Authenticate to access authorized team queue and triage.
        </p>
      </div>

      {/* Developer Quick-Fill Profiles */}
      <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
            <ShieldAlert className="size-3 text-amber-400 shrink-0" />
            <span>Development Test Accounts</span>
          </span>
          <span className="text-[10px] text-zinc-500">Click to fill</span>
        </div>
        <div className="space-y-1.5">
          {SEED_USERS.map((seed) => {
            const isSelected = activeSeedEmail === seed.email && email === seed.email
            return (
              <button
                key={seed.email}
                type="button"
                onClick={() => handleSelectSeed(seed)}
                className={cn(
                  "w-full flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors cursor-pointer text-left",
                  isSelected
                    ? "border-indigo-500/60 bg-indigo-500/20 text-indigo-100"
                    : "border-white/[0.06] bg-black/40 text-zinc-300 hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className={cn("size-3.5 shrink-0", isSelected ? "text-indigo-400" : "text-zinc-500")} />
                  <span className="font-medium text-zinc-200">{seed.name}</span>
                  <span className="text-[11px] text-zinc-400">· {seed.role}</span>
                </div>
                <span className="text-[11px] text-zinc-500 shrink-0 ml-2">{seed.team}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300 animate-in fade-in duration-150"
        >
          <AlertCircle className="size-3.5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1 text-[11px]">
            <span className="font-semibold text-rose-200">Auth Error: </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Credentials Form */}
      <form onSubmit={handleSubmit} className="mt-3.5 space-y-3 text-xs">
        {/* Email Field */}
        <div className="space-y-1">
          <label htmlFor="auth-email" className="font-medium text-zinc-300 text-[11px] flex items-center justify-between">
            <span>Corporate Email</span>
            <span className="text-[10px] text-zinc-400 font-mono">acme.internal</span>
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
            <Input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              disabled={isSubmitting}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setActiveSeedEmail(null)
              }}
              placeholder="operator@acme.internal"
              className="h-8 pl-8 bg-white/[0.02] border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-500 rounded-md focus-visible:border-indigo-500/70 focus-visible:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1">
          <label htmlFor="auth-password" className="font-medium text-zinc-300 text-[11px]">
            Password
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
            <Input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              disabled={isSubmitting}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setActiveSeedEmail(null)
              }}
              placeholder="••••••••••••"
              className="h-8 pl-8 pr-8 bg-white/[0.02] border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-500 rounded-md focus-visible:border-indigo-500/70 focus-visible:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-0.5"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </button>
          </div>
        </div>

        {/* Remember Session Option */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-zinc-300 select-none text-[11px]">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="size-3 rounded border border-white/[0.15] bg-white/[0.03] text-indigo-600 focus:ring-0"
            />
            <span>Remember session</span>
          </label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-md cursor-pointer shadow-xs transition-all duration-150 disabled:opacity-50 mt-1"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              <span>Verifying…</span>
            </span>
          ) : (
            <span>Sign In to Console</span>
          )}
        </Button>
      </form>

      {/* Honest SSO Notice */}
      <div className="mt-4 pt-3 border-t border-white/[0.05] text-[11px] text-zinc-500 leading-normal">
        Enterprise SSO (SAML 2.0 / OIDC) is unconfigured in this local environment.
      </div>
    </div>
  )
}
