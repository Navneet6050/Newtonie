"use client";

import { useRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "cn";

/** Div with a soft cursor-following indigo glow. Mouse only; no re-renders. */
export function SpotlightCard({
  className,
  onPointerMove,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        onPointerMove?.(e);
        if (e.pointerType !== "mouse") return;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "relative before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0 before:transition-opacity before:duration-300 before:bg-[radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,50%),rgba(129,140,248,0.10),transparent_70%)] hover:before:opacity-100",
        className
      )}
      {...props}
    />
  );
}
