"use client"

import dynamic from "next/dynamic"
import { motion, useReducedMotion } from "motion/react"

const LoginScene = dynamic(() => import("./login-scene"), { ssr: false })

export function LoginBackground() {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="aurora-blob absolute -top-40 left-1/4 size-[520px] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="aurora-blob absolute -bottom-48 right-1/4 size-[480px] rounded-full bg-violet-600/15 blur-[120px] [animation-delay:-6s]" />
      {!reduce && (
        <motion.div
          className="absolute inset-0 [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,black_30%,transparent_80%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
        >
          <LoginScene />
        </motion.div>
      )}
    </div>
  )
}
