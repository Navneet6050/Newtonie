/**
 * Newtonite Typed API Client for M2 Work-Item Workflow
 */

export interface BackendUserSummary {
  id: string
  name: string
  avatarInitials: string
  email: string
}

export interface BackendTeamSummary {
  id: string
  name: string
}

export type BackendWorkItemType = "INCIDENT" | "TASK" | "BUG" | "OPS"
export type BackendWorkItemStatus = "OPEN" | "IN_PROGRESS" | "REVIEW_NEEDED" | "COMPLETED" | "BLOCKED"
export type BackendWorkItemPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW"

export interface BackendWorkItem {
  id: string
  trackingNumber: string
  title: string
  description?: string | null
  type: BackendWorkItemType
  status: BackendWorkItemStatus
  priority: BackendWorkItemPriority
  systemArea: string
  team?: BackendTeamSummary | null
  assignee?: BackendUserSummary | null
  reporter?: BackendUserSummary | null
  dueDate?: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface BackendPagedResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export interface BackendActivityLog {
  id: string
  workItemId: string
  actor?: BackendUserSummary | null
  actionType: string
  fieldName?: string | null
  fromValue?: string | null
  toValue?: string | null
  metadata?: string | null
  timestamp: string
}

export interface CreateWorkItemPayload {
  title: string
  description?: string
  type: BackendWorkItemType
  priority: BackendWorkItemPriority
  systemArea: string
  teamId?: string
  assigneeId?: string
  dueDate?: string
}

export interface UpdateWorkItemPayload {
  expectedVersion?: number
  title?: string
  description?: string
  type?: BackendWorkItemType
  priority?: BackendWorkItemPriority
  status?: BackendWorkItemStatus
  assigneeId?: string | null
  dueDate?: string | null
  systemArea?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"

export async function fetchWorkItems(params?: {
  search?: string
  status?: BackendWorkItemStatus
  priority?: BackendWorkItemPriority
  type?: BackendWorkItemType
  teamId?: string
  assigneeId?: string
  systemArea?: string
  page?: number
  size?: number
  sort?: string
}): Promise<BackendPagedResponse<BackendWorkItem>> {
  const query = new URLSearchParams()
  if (params?.search) query.set("search", params.search)
  if (params?.status) query.set("status", params.status)
  if (params?.priority) query.set("priority", params.priority)
  if (params?.type) query.set("type", params.type)
  if (params?.teamId) query.set("teamId", params.teamId)
  if (params?.assigneeId) query.set("assigneeId", params.assigneeId)
  if (params?.systemArea) query.set("systemArea", params.systemArea)
  if (params?.page !== undefined) query.set("page", String(params.page))
  if (params?.size !== undefined) query.set("size", String(params.size))
  if (params?.sort) query.set("sort", params.sort)

  const res = await fetch(`${API_BASE}/work-items?${query.toString()}`, {
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch work items: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function getWorkItem(id: string): Promise<BackendWorkItem> {
  const res = await fetch(`${API_BASE}/work-items/${id}`, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Failed to fetch work item ${id}: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function createWorkItem(
  payload: CreateWorkItemPayload,
  idempotencyKey?: string
): Promise<BackendWorkItem> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey
  }

  const res = await fetch(`${API_BASE}/work-items`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Failed to create work item: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function updateWorkItem(
  id: string,
  payload: UpdateWorkItemPayload,
  ifMatchVersion?: number
): Promise<BackendWorkItem> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (ifMatchVersion !== undefined) {
    headers["If-Match"] = `"${ifMatchVersion}"`
  }

  const res = await fetch(`${API_BASE}/work-items/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Failed to update work item ${id}: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function claimWorkItem(id: string): Promise<BackendWorkItem> {
  const res = await fetch(`${API_BASE}/work-items/${id}/claim`, {
    method: "POST",
  })
  if (!res.ok) {
    throw new Error(`Failed to claim work item ${id}: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function fetchActivityHistory(
  id: string,
  page = 0,
  size = 20
): Promise<BackendPagedResponse<BackendActivityLog>> {
  const res = await fetch(`${API_BASE}/work-items/${id}/activity?page=${page}&size=${size}`, {
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch activity logs for ${id}: ${res.status}`)
  }
  return res.json()
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const healthUrl = API_BASE.replace(/\/api$/, "/actuator/health")
    const res = await fetch(healthUrl, { cache: "no-store" })
    if (!res.ok) return false
    const data = await res.json()
    return data.status === "UP"
  } catch {
    return false
  }
}
