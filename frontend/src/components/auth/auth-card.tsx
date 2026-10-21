"use client"

import * as React from "react"
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Mail,
  User as UserIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { useAuth } from "@/lib/auth-context"
import { checkBackendHealth, getApiConfigurationError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SeedUser {
  name: string
  firstName: string
  email: string
  role: string
}

const SEED_USERS: SeedUser[] = [
  {
    name: "Alex Morgan",
    firstName: "Alex",
    email: "alex.morgan@acme.internal",
    role: "Admin",
  },
  {
    name: "Sarah Chen",
    firstName: "Sarah",
    email: "sarah.chen@acme.internal",
    role: "Studio",
  },
  {
    name: "Liam Vance",
    firstName: "Liam",
    email: "liam.vance@acme.internal",
    role: "Platform",
  },
]

interface AuthCardProps {
  onSuccess?: () => void
  isModal?: boolean
  initialMode?: "signin" | "register"
}

type WarmupPhase = "idle" | "verifying" | "waking" | "extended"

export function AuthCard({ onSuccess, isModal = false, initialMode = "signin" }: AuthCardProps) {
  const { login, register } = useAuth()
  const [mode, setMode] = React.useState<"signin" | "register">(initialMode)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [rememberDevice, setRememberDevice] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [warmupPhase, setWarmupPhase] = React.useState<WarmupPhase>("idle")
  const [error, setError] = React.useState<string | null>(getApiConfigurationError() ?? null)
  const [activeSeedEmail, setActiveSeedEmail] = React.useState<string | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = React.useState(false)
  const [healthStatus, setHealthStatus] = React.useState<{
    isUp: boolean
    message: string
    durationMs?: number
  } | null>(null)

  const abortControllerRef = React.useRef<AbortController | null>(null)
  const healthAbortRef = React.useRef<AbortController | null>(null)
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = React.useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
  }, [])

  // Clean up timers and in-flight requests when component unmounts
  React.useEffect(() => {
    return () => {
      clearTimers()
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      if (healthAbortRef.current) {
        healthAbortRef.current.abort()
        healthAbortRef.current = null
      }
    }
  }, [clearTimers])

  const handleCheckHealth = async () => {
    if (isCheckingHealth) return

    const configErr = getApiConfigurationError()
    if (configErr) {
      setHealthStatus({
        isUp: false,
        message: `Configuration error: ${configErr}`,
      })
      return
    }

    if (healthAbortRef.current) {
      healthAbortRef.current.abort()
    }
    const controller = new AbortController()
    healthAbortRef.current = controller
    setIsCheckingHealth(true)
    setHealthStatus(null)

    try {
      const result = await checkBackendHealth({
        signal: controller.signal,
        timeoutMs: 8000,
      })
      if (healthAbortRef.current === controller) {
        setHealthStatus({
          isUp: result.isUp,
          message: result.message,
          durationMs: result.durationMs,
        })
      }
    } catch {
      if (healthAbortRef.current === controller) {
        setHealthStatus({
          isUp: false,
          message: "Failed to reach health endpoint. The server may still be booting.",
        })
      }
    } finally {
      if (healthAbortRef.current === controller) {
        setIsCheckingHealth(false)
        healthAbortRef.current = null
      }
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    // Prevent duplicate submissions
    if (isSubmitting) return

    const configErr = getApiConfigurationError()
    if (configErr) {
      setError(`Application configuration error: ${configErr}`)
      return
    }

    // Cancel any active health probe so it cannot conflict with authentication
    if (healthAbortRef.current) {
      healthAbortRef.current.abort()
      healthAbortRef.current = null
      setIsCheckingHealth(false)
    }

    setError(null)

    if (mode === "register") {
      if (!name.trim() || name.trim().length < 2) {
        setError("Please enter your full name (minimum 2 characters).")
        return
      }
      if (!email.trim()) {
        setError("Please enter your corporate email.")
        return
      }
      if (!password || password.length < 8) {
        setError("Password must be at least 8 characters long.")
        return
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify both fields.")
        return
      }
    } else {
      if (!email.trim() || !password) {
        setError("Please enter both corporate email and password.")
        return
      }
    }

    clearTimers()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsSubmitting(true)
    setWarmupPhase("verifying")

    // Stage 1: after 3.5s (warm request should have finished by now)
    const t1 = setTimeout(() => {
      setWarmupPhase("waking")
    }, 3500)
    timersRef.current.push(t1)

    // Stage 2: after 18s (Render instance container booting & JVM startup)
    const t2 = setTimeout(() => {
      setWarmupPhase("extended")
    }, 18000)
    timersRef.current.push(t2)

    try {
      if (mode === "register") {
        await register(name.trim(), email.trim(), password, rememberDevice, {
          signal: controller.signal,
        })
      } else {
        await login(email.trim(), password, rememberDevice, {
          signal: controller.signal,
        })
      }
      if (abortControllerRef.current === controller && onSuccess) {
        onSuccess()
      }
    } catch (err: unknown) {
      if (abortControllerRef.current === controller) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("Authentication failed. Please verify your credentials.")
        }
      }
    } finally {
      if (abortControllerRef.current === controller) {
        clearTimers()
        abortControllerRef.current = null
        setIsSubmitting(false)
        setWarmupPhase("idle")
      }
    }
  }

  const handleSelectSeed = (seed: SeedUser) => {
    if (isSubmitting) return
    setEmail(seed.email)
    setPassword("NewtoniteDev2026!")
    setActiveSeedEmail(seed.email)
    setError(null)
  }

  const toggleMode = (newMode: "signin" | "register") => {
    if (isSubmitting) return
    setMode(newMode)
    setError(null)
    setHealthStatus(null)
    setActiveSeedEmail(null)
  }

  const getButtonLabel = () => {
    if (!isSubmitting) {
      return mode === "register" ? "Create Account & Sign In" : "Sign In to Console"
    }
    if (warmupPhase === "extended") {
      return "Still starting up…"
    }
    if (warmupPhase === "waking") {
      return "Waking up server…"
    }
    return mode === "register" ? "Creating profile…" : "Verifying…"
  }

  return (
    <motion.div
      initial={isModal ? false : { opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative w-full max-w-[400px]",
        isModal
          ? "p-2"
          : "rounded-2xl border border-white/10 bg-[#07080d]/60 p-8 backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_120px_-30px_rgba(99,102,241,0.45)] before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-indigo-400/60 before:to-transparent"
      )}
    >
      {/* Header */}
      <div>
        <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/15">
          <Layers className="size-5 text-indigo-300" />
        </div>
        <h1
          id={isModal ? "login-dialog-title" : undefined}
          className="mt-4 text-center text-2xl font-semibold tracking-tight text-white"
        >
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-1.5 text-center text-sm text-white/50">
          {mode === "signin"
            ? "Use your corporate account to continue."
            : "Register your operator profile for Newtonite."}
        </p>
      </div>

      {/* Error Alert with Explicit Manual Retry and Health Probe */}
      {error && (
        <div
          role="alert"
          className="mt-4 flex flex-col gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 animate-in fade-in duration-150"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1 text-[11px] leading-relaxed">
              <span className="font-semibold text-rose-200">Sign-in Notice: </span>
              <span>{error}</span>
            </div>
          </div>
          {(error.toLowerCase().includes("waking up") ||
            error.toLowerCase().includes("timed out") ||
            error.toLowerCase().includes("unable to connect") ||
            error.toLowerCase().includes("try again") ||
            error.toLowerCase().includes("starting from sleep")) && (
            <div className="pt-2 flex flex-col gap-2 border-t border-rose-500/20">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-rose-300/80">
                  Render free tier instances take ~60–90s to cold-start.
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isCheckingHealth || isSubmitting}
                    onClick={handleCheckHealth}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-300 hover:text-indigo-200 underline cursor-pointer disabled:opacity-50"
                  >
                    {isCheckingHealth ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        <span>Checking…</span>
                      </>
                    ) : (
                      <>
                        <Activity className="size-3" />
                        <span>Check Status</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit()}
                    className="text-[11px] font-medium text-amber-300 hover:text-amber-200 underline cursor-pointer disabled:opacity-50"
                  >
                    Retry {mode === "register" ? "Registration" : "Sign In"}
                  </button>
                </div>
              </div>

              {/* Health Probe Diagnostic Feedback */}
              {healthStatus && (
                <div
                  className={cn(
                    "rounded border p-2 text-[10px] leading-relaxed transition-all",
                    healthStatus.isUp
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  )}
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    {healthStatus.isUp ? (
                      <>
                        <CheckCircle2 className="size-3 text-emerald-400" />
                        <span>Server is online ({healthStatus.durationMs}ms)</span>
                      </>
                    ) : (
                      <>
                        <Clock className="size-3 text-amber-400" />
                        <span>Server still warming up</span>
                      </>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] opacity-90">
                    {healthStatus.isUp
                      ? "The health endpoint responded. (Note: A responsive health endpoint indicates the JVM is running, though database authentication is verified separately during sign in.) You may now click 'Retry Sign In'."
                      : "The health endpoint did not respond yet. The container is likely completing initial cold boot. Please wait 15–30 seconds and check again."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Progressive Server Warmup Alert */}
      {isSubmitting && (warmupPhase === "waking" || warmupPhase === "extended") && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 animate-in fade-in duration-300"
        >
          <Loader2 className="size-4 shrink-0 text-amber-400 animate-spin mt-0.5" />
          <div className="flex-1 space-y-1 text-left">
            <div className="font-semibold text-amber-100 flex items-center justify-between">
              <span>{warmupPhase === "waking" ? "Waking up server…" : "Still starting up…"}</span>
              <span className="text-[10px] uppercase font-mono text-amber-400/80 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                Render Free Tier
              </span>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              {warmupPhase === "waking"
                ? "The Newtonite backend spins down after inactivity. Initial wake-up typically takes 30–50 seconds. Please hold on…"
                : "The application is establishing database connections and security tokens. Your request is active, please don't refresh."}
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {/* Full Name Field (Register Mode Only) */}
        {mode === "register" && (
          <div className="space-y-1.5 animate-in fade-in duration-150">
            <label htmlFor="auth-name" className="text-xs font-medium text-white/60 block">
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/35" />
              <Input
                id="auth-name"
                type="text"
                required
                autoComplete="name"
                disabled={isSubmitting}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="h-11 rounded-lg border border-white/10 bg-white/[0.04] pl-10 text-sm text-white placeholder:text-white/30 transition focus-visible:border-indigo-400/60 focus-visible:ring-2 focus-visible:ring-indigo-500/25"
              />
            </div>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1.5">
          <label htmlFor="auth-email" className="text-xs font-medium text-white/60 block">
            Corporate Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/35" />
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
              className="h-11 rounded-lg border border-white/10 bg-white/[0.04] pl-10 text-sm text-white placeholder:text-white/30 transition focus-visible:border-indigo-400/60 focus-visible:ring-2 focus-visible:ring-indigo-500/25"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="auth-password" className="text-xs font-medium text-white/60 block">
              Password
            </label>
            {mode === "register" && (
              <span className="text-[10px] text-white/40">Min. 8 characters</span>
            )}
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/35" />
            <Input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              disabled={isSubmitting}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setActiveSeedEmail(null)
              }}
              placeholder="••••••••••••"
              className="h-11 rounded-lg border border-white/10 bg-white/[0.04] pl-10 pr-10 text-sm text-white placeholder:text-white/30 transition focus-visible:border-indigo-400/60 focus-visible:ring-2 focus-visible:ring-indigo-500/25"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password Field (Register Mode Only) */}
        {mode === "register" && (
          <div className="space-y-1.5 animate-in fade-in duration-150">
            <label htmlFor="auth-confirm-password" className="text-xs font-medium text-white/60 block">
              Confirm Password
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/35" />
              <Input
                id="auth-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="h-11 rounded-lg border border-white/10 bg-white/[0.04] pl-10 pr-10 text-sm text-white placeholder:text-white/30 transition focus-visible:border-indigo-400/60 focus-visible:ring-2 focus-visible:ring-indigo-500/25"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition-colors p-1"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Remember Session Option */}
        <div className="flex items-center justify-between pt-0.5">
          <label className={cn("flex items-center gap-2 cursor-pointer text-xs text-white/50 select-none", isSubmitting && "opacity-60 cursor-not-allowed")}>
            <input
              type="checkbox"
              checked={rememberDevice}
              disabled={isSubmitting}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="size-3.5 rounded border border-white/15 bg-white/[0.04] text-indigo-600 focus:ring-0 disabled:opacity-50"
            />
            <span>Remember session</span>
          </label>
        </div>

        {/* Submit Button */}
        <motion.div whileHover={{ y: isSubmitting ? 0 : -1 }} whileTap={{ scale: isSubmitting ? 1 : 0.98 }}>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.7)] hover:from-indigo-400 hover:to-indigo-500 disabled:opacity-60 cursor-pointer transition-all duration-150"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>{getButtonLabel()}</span>
              </span>
            ) : (
              <span>{getButtonLabel()}</span>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Switch between Sign In and Register Mode */}
      <div className="mt-5 text-center text-xs text-white/50">
        {mode === "signin" ? (
          <span>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => toggleMode("register")}
              className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              Create account
            </button>
          </span>
        ) : (
          <span>
            Already have an account?{" "}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => toggleMode("signin")}
              className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              Sign in
            </button>
          </span>
        )}
      </div>

      {/* Demo Accounts (rendered only in non-production during sign-in) */}
      {mode === "signin" && process.env.NODE_ENV !== "production" && (
        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <div className="text-[11px] uppercase tracking-wider text-white/35">
            Demo accounts (Dev only)
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SEED_USERS.map((seed, i) => {
              const isSelected = activeSeedEmail === seed.email && email === seed.email
              return (
                <motion.button
                  key={seed.email}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSelectSeed(seed)}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.08, duration: 0.4 }}
                  whileHover={{ x: isSubmitting ? 0 : 3 }}
                  whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                  className={cn(
                    "rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-left transition hover:bg-white/[0.07] cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
                    isSelected && "border-indigo-400/50 bg-indigo-500/20"
                  )}
                >
                  <div className="text-xs font-medium text-white/80">{seed.firstName}</div>
                  <div className="text-[11px] text-white/40">{seed.role}</div>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}
