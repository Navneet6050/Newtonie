"use client"

import * as React from "react"
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Building2,
  Terminal,
  ChevronDown,
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
  description: string
}

const SEED_USERS: SeedUser[] = [
  {
    name: "Alex Morgan",
    email: "alex.morgan@acme.internal",
    role: "System Admin",
    team: "All Workspaces",
    description: "Global administrator access across all engineering teams and systems.",
  },
  {
    name: "Sarah Chen",
    email: "sarah.chen@acme.internal",
    role: "Studio Operator",
    team: "Acme Studio",
    description: "Product and design operations lead. Scoped strictly to Acme Studio.",
  },
  {
    name: "Liam Vance",
    email: "liam.vance@acme.internal",
    role: "Platform Lead",
    team: "Acme Platform",
    description: "Core infrastructure and backend platform engineer. Scoped to Acme Platform.",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError("Please enter both email address and password.")
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
        setError("Invalid email address or password. Please verify your credentials.")
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
    <div className={cn("w-full max-w-md", isModal ? "p-0" : "surface-overlay rounded-2xl p-8 border border-white/[0.08] shadow-2xl")}>
      {/* Brand & Security Stamp */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Lock className="size-3.5" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Operations Access
            </span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
            <ShieldCheck className="size-3" />
            Server-Enforced RBAC
          </span>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">
          Sign In to Newtonite
        </h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Access your team’s live operational queue, triage workflows, and incident command dashboard.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-in fade-in duration-150"
        >
          <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-rose-200">Authentication Failed</div>
            <div className="mt-0.5 text-rose-300/90">{error}</div>
          </div>
        </div>
      )}

      {/* Credentials Form */}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label htmlFor="auth-email" className="font-medium text-zinc-300 flex items-center justify-between">
            <span>Corporate Email</span>
            <span className="text-[11px] text-zinc-500">e.g. operator@acme.internal</span>
          </label>
          <Input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            disabled={isSubmitting}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="h-9 bg-white/[0.03] border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-indigo-500/70 focus-visible:ring-indigo-500/20"
          />
        </div>

        {/* Password Field with Toggle */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="auth-password" className="font-medium text-zinc-300">
              Password
            </label>
            <span className="text-[11px] text-zinc-500">Required</span>
          </div>
          <div className="relative">
            <Input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="h-9 pr-10 bg-white/[0.03] border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-indigo-500/70 focus-visible:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
              aria-label={showPassword ? "Hide password text" : "Show password text"}
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* Remember Device */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-300 select-none">
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
          className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs cursor-pointer shadow-sm transition-all duration-150 disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Verifying Credentials…</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <KeyRound className="size-3.5" />
              <span>Sign In to Command Center</span>
            </span>
          )}
        </Button>
      </form>

      {/* Enterprise SSO Status Note */}
      <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs">
        <div className="flex items-center gap-2 text-zinc-300 font-medium">
          <Building2 className="size-3.5 text-indigo-400" />
          <span>Enterprise SSO (SAML 2.0 / OIDC)</span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">
          Identity federation via Google Workspace or Microsoft Entra ID is provisioned per corporate tenant policy. In this local operations environment, authenticate using assigned workspace credentials below.
        </p>
      </div>

      {/* Explicitly Development-Only Seed Operator Switcher */}
      <div className="mt-6 border-t border-white/[0.06] pt-4">
        <details className="group rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <summary className="flex items-center justify-between cursor-pointer select-none text-amber-300 hover:text-amber-200">
            <div className="flex items-center gap-2">
              <Terminal className="size-3.5 text-amber-400" />
              <span className="font-semibold tracking-wide text-[11px] uppercase">
                [DEV ONLY] Seeded Operators
              </span>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-amber-400/80">
              <span>Quick Fill</span>
              <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
            </span>
          </summary>

          <div className="mt-3 space-y-2 pt-2 border-t border-amber-500/20">
            <p className="text-[11px] text-amber-300/80">
              Click any seeded profile to populate credentials for local development testing:
            </p>
            <div className="space-y-1.5">
              {SEED_USERS.map((seed) => (
                <button
                  key={seed.email}
                  type="button"
                  onClick={() => handleSelectSeed(seed)}
                  className="w-full flex items-center justify-between rounded-lg border border-amber-500/20 bg-black/40 p-2 text-left hover:border-amber-400/50 hover:bg-black/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-200 text-xs flex items-center gap-1.5">
                      <span>{seed.name}</span>
                      <span className="rounded bg-amber-500/20 text-amber-300 text-[10px] px-1 py-0.2">
                        {seed.role}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                      {seed.email} · {seed.team}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 shrink-0 ml-2">Use</span>
                </button>
              ))}
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}
