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
  Building2,
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
  shortLabel: string
}

const SEED_USERS: SeedUser[] = [
  {
    name: "Alex Morgan",
    email: "alex.morgan@acme.internal",
    role: "Admin",
    team: "All Workspaces",
    shortLabel: "Alex (Admin)",
  },
  {
    name: "Sarah Chen",
    email: "sarah.chen@acme.internal",
    role: "Studio",
    team: "Acme Studio",
    shortLabel: "Sarah (Studio)",
  },
  {
    name: "Liam Vance",
    email: "liam.vance@acme.internal",
    role: "Platform",
    team: "Acme Platform",
    shortLabel: "Liam (Platform)",
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
        "w-full max-w-[420px] transition-all",
        isModal
          ? "p-1"
          : "surface-overlay rounded-2xl p-7 border border-white/[0.08] shadow-2xl"
      )}
    >
      {/* Brand & Security Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Lock className="size-3.5" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
              Operations Access
            </span>
          </div>
          <span className="flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Local Node
          </span>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          Sign In to Newtonite
        </h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Access your team’s authorized operations queue and incident triage.
        </p>
      </div>

      {/* Quick Fill Dev Chips */}
      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
            <ShieldAlert className="size-3 text-amber-400" />
            <span>Dev-Only Test Accounts</span>
          </span>
          <span className="text-[10px] text-zinc-500">Quick Fill</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {SEED_USERS.map((seed) => {
            const isSelected = activeSeedEmail === seed.email && email === seed.email
            return (
              <button
                key={seed.email}
                type="button"
                onClick={() => handleSelectSeed(seed)}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all cursor-pointer",
                  isSelected
                    ? "border-amber-400/60 bg-amber-500/20 text-amber-200 shadow-xs"
                    : "border-white/[0.06] bg-black/40 text-zinc-400 hover:border-amber-500/30 hover:bg-black/60 hover:text-zinc-200"
                )}
                title={`${seed.name} (${seed.role}) · ${seed.team}`}
              >
                <UserCheck className="size-3 shrink-0" />
                <span className="truncate">{seed.shortLabel}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="mt-3.5 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-in fade-in duration-150"
        >
          <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-rose-200 text-xs">Authentication Failed</div>
            <div className="text-[11px] text-rose-300/90 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Credentials Form */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
        {/* Email Field */}
        <div className="space-y-1">
          <label htmlFor="auth-email" className="font-medium text-zinc-300 flex items-center justify-between">
            <span>Corporate Email</span>
            <span className="text-[10px] text-zinc-500 font-normal">e.g. operator@acme.internal</span>
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
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
              placeholder="name@company.com"
              className="h-9 pl-9 bg-white/[0.03] border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-indigo-500/70 focus-visible:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="auth-password" className="font-medium text-zinc-300">
              Password
            </label>
            <span className="text-[10px] text-zinc-500 font-normal">Required</span>
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
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
              className="h-9 pl-9 pr-9 bg-white/[0.03] border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-indigo-500/70 focus-visible:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
              aria-label={showPassword ? "Hide password text" : "Show password text"}
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* Remember Session Option */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-300 select-none text-[11px]">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="size-3.5 rounded border border-white/[0.15] bg-white/[0.03] text-indigo-600 focus:ring-indigo-500/30"
            />
            <span>Remember session on this device</span>
          </label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs cursor-pointer shadow-sm transition-all duration-150 disabled:opacity-50 mt-1"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Verifying Credentials…</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Lock className="size-3.5" />
              <span>Sign In to Operations Console</span>
            </span>
          )}
        </Button>
      </form>

      {/* Honest SSO Notice */}
      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-[11px]">
        <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
          <Building2 className="size-3.5 text-indigo-400 shrink-0" />
          <span>Enterprise SSO (SAML 2.0 / OIDC)</span>
        </div>
        <p className="mt-1 text-zinc-400 leading-normal text-[10px]">
          Identity federation is unconfigured in this local sandbox. Authenticate using the pre-seeded development accounts above.
        </p>
      </div>
    </div>
  )
}
