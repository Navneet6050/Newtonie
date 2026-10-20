"use client";

import { useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/** Animates only when `value` is a number; strings like "…" render as-is. */
export function CountUp({
  value,
  duration = 0.9,
}: {
  value: number | string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  const isNumber = typeof value === "number";

  useLayoutEffect(() => {
    if (typeof value !== "number") return;
    const node = ref.current;
    if (!node) return;

    if (reduce) {
      node.textContent = String(value);
      prev.current = value;
      return;
    }

    node.textContent = String(Math.round(prev.current));
    const controls = animate(prev.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        node.textContent = String(Math.round(v));
      },
      onComplete: () => {
        prev.current = value;
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  if (!isNumber) return <>{value}</>;
  return <span ref={ref} className="tabular-nums" />;
}
