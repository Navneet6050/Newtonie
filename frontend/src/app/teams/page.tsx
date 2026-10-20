"use client"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { TeamsView } from "@/components/teams/teams-view"

export default function TeamsPage() {
  return (
    <DashboardShell initialNav="teams">
      <TeamsView />
    </DashboardShell>
  )
}
