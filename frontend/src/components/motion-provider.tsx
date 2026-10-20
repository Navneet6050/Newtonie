"use client"

import * as React from "react"
import { MotionConfig } from "motion/react"

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
