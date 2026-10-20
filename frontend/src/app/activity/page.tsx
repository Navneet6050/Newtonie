"use client"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ActivityView } from "@/components/activity/activity-view"

export default function ActivityPage() {
  return (
    <DashboardShell initialNav="activity">
      <ActivityView />
    </DashboardShell>
  )
}
