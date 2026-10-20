"use client"

import * as React from "react"
import {
  AlertCircle,
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
  const [error, setError] = React.useState<string | null>(null)
  const [activeSeedEmail, setActiveSeedEmail] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      setIsSubmitting(true)
      try {
        await register(name.trim(), email.trim(), password, rememberDevice)
        if (onSuccess) {
          onSuccess()
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("Registration failed. Please try again.")
        }
      } finally {
        setIsSubmitting(false)
      }
    } else {
      if (!email.trim() || !password) {
        setError("Please enter both corporate email and password.")
        return
      }

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
  }

  const handleSelectSeed = (seed: SeedUser) => {
    setEmail(seed.email)
    setPassword("NewtoniteDev2026!")
    setActiveSeedEmail(seed.email)
    setError(null)
  }

  const toggleMode = (newMode: "signin" | "register") => {
    setMode(newMode)
    setError(null)
    setActiveSeedEmail(null)
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

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300 animate-in fade-in duration-150"
        >
          <AlertCircle className="size-3.5 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1 text-[11px]">
            <span className="font-semibold text-rose-200">Auth Error: </span>
            <span>{error}</span>
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
          <label className="flex items-center gap-2 cursor-pointer text-xs text-white/50 select-none">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="size-3.5 rounded border border-white/15 bg-white/[0.04] text-indigo-600 focus:ring-0"
            />
            <span>Remember session</span>
          </label>
        </div>

        {/* Submit Button */}
        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.7)] hover:from-indigo-400 hover:to-indigo-500 disabled:opacity-60 cursor-pointer transition-all duration-150"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>{mode === "register" ? "Creating profile…" : "Verifying…"}</span>
              </span>
            ) : (
              <span>{mode === "register" ? "Create Account & Sign In" : "Sign In to Console"}</span>
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
              onClick={() => toggleMode("register")}
              className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer transition-colors"
            >
              Create account
            </button>
          </span>
        ) : (
          <span>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => toggleMode("signin")}
              className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer transition-colors"
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
                  onClick={() => handleSelectSeed(seed)}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.08, duration: 0.4 }}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-left transition hover:bg-white/[0.07] cursor-pointer",
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
