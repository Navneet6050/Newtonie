/**
 * Newtonite Typed API Client for M3 Authentication and Team-Scoped Work Items
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

export interface BackendTeamMember {
  userId: string
  name: string
  email: string
  avatarInitials: string
  role: string
  joinedAt: string
}

export interface BackendTeam {
  id: string
  name: string
  description?: string | null
  memberCount: number
  workItemCount: number
  members: BackendTeamMember[]
  createdAt: string
  updatedAt: string
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
  trackingNumber?: string | null
  workItemTitle?: string | null
  actor?: BackendUserSummary | null
  actionType: string
  fieldName?: string | null
  fromValue?: string | null
  toValue?: string | null
  metadata?: string | null
  timestamp: string
}

export interface BackendComment {
  id: string
  workItemId: string
  authorId: string
  authorName: string
  authorEmail: string
  authorInitials: string | null
  content: string
  createdAt: string
  updatedAt: string
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

export interface AuthTeamMembership {
  teamId: string
  teamName: string
  role: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarInitials: string
  systemRole: string
  teams: AuthTeamMembership[]
}

export interface LoginResponse {
  token: string
  type: string
  user: AuthUser
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api"

let memoryToken: string | null = null

export function getAuthToken(): string | null {
  if (typeof window !== "undefined" && !memoryToken) {
    memoryToken =
      sessionStorage.getItem("newtonite_auth_token") ||
      localStorage.getItem("newtonite_auth_token")
  }
  return memoryToken
}

export function setAuthToken(token: string | null, remember = true): void {
  memoryToken = token
  if (typeof window !== "undefined") {
    if (token) {
      if (remember) {
        localStorage.setItem("newtonite_auth_token", token)
        sessionStorage.removeItem("newtonite_auth_token")
      } else {
        sessionStorage.setItem("newtonite_auth_token", token)
        localStorage.removeItem("newtonite_auth_token")
      }
    } else {
      sessionStorage.removeItem("newtonite_auth_token")
      localStorage.removeItem("newtonite_auth_token")
    }
  }
}

export interface BackendWorkItemMetrics {
  openCount: number
  inProgressCount: number
  reviewNeededCount: number
  completedCount: number
  blockedCount: number
  urgentCount: number
  blockedOrUrgentCount: number
  totalCount: number
}

function handleAuthError(res: Response) {
  if (res.status === 401) {
    setAuthToken(null)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("newtonite:unauthorized"))
    }
  }
}

function getAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders }
  const token = getAuthToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return headers
}

export async function login(
  email: string,
  password: string,
  rememberDevice = true
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Login failed: ${res.status}`)
  }

  const data: LoginResponse = await res.json()
  setAuthToken(data.token, rememberDevice)
  return data
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })

  if (!res.ok) {
    handleAuthError(res)
    throw new Error(`Failed to get current user: ${res.status}`)
  }

  return res.json()
}

export async function fetchWorkItemMetrics(teamId?: string): Promise<BackendWorkItemMetrics> {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""
  const res = await fetch(`${API_BASE}/work-items/metrics${query}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to fetch work item metrics: ${res.status}`)
  }
  return res.json()
}

export async function fetchWorkItems(params?: {
  search?: string
  status?: BackendWorkItemStatus
  priority?: BackendWorkItemPriority | string | string[]
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
  if (params?.priority) {
    if (Array.isArray(params.priority)) {
      query.set("priority", params.priority.join(","))
    } else {
      query.set("priority", params.priority)
    }
  }
  if (params?.type) query.set("type", params.type)
  if (params?.teamId) query.set("teamId", params.teamId)
  if (params?.assigneeId) query.set("assigneeId", params.assigneeId)
  if (params?.systemArea) query.set("systemArea", params.systemArea)
  if (params?.page !== undefined) query.set("page", String(params.page))
  if (params?.size !== undefined) query.set("size", String(params.size))
  if (params?.sort) query.set("sort", params.sort)

  const res = await fetch(`${API_BASE}/work-items?${query.toString()}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to fetch work items: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function getWorkItem(id: string): Promise<BackendWorkItem> {
  const res = await fetch(`${API_BASE}/work-items/${id}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to fetch work item ${id}: ${res.status} ${res.statusText}`)
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
    headers: getAuthHeaders(headers),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to create work item: ${res.status}`)
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
    headers: getAuthHeaders(headers),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to update work item ${id}: ${res.status}`)
  }
  return res.json()
}

export async function claimWorkItem(id: string): Promise<BackendWorkItem> {
  const res = await fetch(`${API_BASE}/work-items/${id}/claim`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to claim work item ${id}: ${res.status}`)
  }
  return res.json()
}

export async function fetchActivityHistory(
  id: string,
  page = 0,
  size = 20
): Promise<BackendPagedResponse<BackendActivityLog>> {
  const res = await fetch(`${API_BASE}/work-items/${id}/activity?page=${page}&size=${size}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to fetch activity logs for ${id}: ${res.status}`)
  }
  return res.json()
}

export async function fetchWorkItemComments(id: string): Promise<BackendComment[]> {
  const res = await fetch(`${API_BASE}/work-items/${id}/comments`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to fetch comments for ${id}: ${res.status}`)
  }
  return res.json()
}

export async function createWorkItemComment(id: string, content: string): Promise<BackendComment> {
  const res = await fetch(`${API_BASE}/work-items/${id}/comments`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to post comment for ${id}: ${res.status}`)
  }
  return res.json()
}


export async function fetchTeams(): Promise<BackendTeam[]> {
  const res = await fetch(`${API_BASE}/teams`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to fetch teams: ${res.status}`)
  }
  return res.json()
}

export async function fetchTeamDetails(id: string): Promise<BackendTeam> {
  const res = await fetch(`${API_BASE}/teams/${id}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to fetch team ${id}: ${res.status}`)
  }
  return res.json()
}

export async function fetchActivityFeed(
  teamId?: string,
  page = 0,
  size = 20
): Promise<BackendPagedResponse<BackendActivityLog>> {
  const params = new URLSearchParams()
  if (teamId) params.append("teamId", teamId)
  params.append("page", String(page))
  params.append("size", String(size))

  const res = await fetch(`${API_BASE}/activity?${params.toString()}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to fetch activity feed: ${res.status}`)
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
