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

export function normalizeApiBase(rawUrl?: string): string {
  const trimmed = rawUrl?.trim()
  if (!trimmed) {
    return "/api"
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`Invalid API URL protocol: "${parsed.protocol}". Only http: and https: are supported.`)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Only http: and https: are supported")) {
        throw err
      }
      throw new Error("Invalid API URL: malformed URL provided in configuration. Expected a valid HTTP or HTTPS URL or relative path.")
    }
  }
  const clean = trimmed.replace(/\/+$/, "")
  return clean.endsWith("/api") ? clean : `${clean}/api`
}

let initialApiBase = "/api"
let apiConfigError: string | null = null

try {
  initialApiBase = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL)
} catch (err: unknown) {
  apiConfigError = err instanceof Error ? err.message : "Invalid API URL configuration."
}

export const API_BASE = initialApiBase

export function getApiConfigurationError(): string | null {
  return apiConfigError
}

export function _setApiConfigErrorForTesting(err: string | null): void {
  apiConfigError = err
}

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
  if (apiConfigError) {
    throw new Error(`Application configuration error: ${apiConfigError}`)
  }
  const headers: Record<string, string> = { ...extraHeaders }
  const token = getAuthToken()
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return headers
}

export interface RequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export const DEFAULT_AUTH_TIMEOUT_MS = 50000 // 50 seconds to accommodate Render free-tier cold starts

export async function login(
  email: string,
  password: string,
  rememberDevice = true,
  options?: RequestOptions
): Promise<LoginResponse> {
  if (apiConfigError) {
    throw new Error(`Application configuration error: ${apiConfigError}`)
  }
  const timeoutMs = options?.timeoutMs ?? DEFAULT_AUTH_TIMEOUT_MS
  const controller = new AbortController()

  let externalSignalCleanup: (() => void) | undefined
  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort(options.signal.reason)
    } else {
      const onAbort = () => controller.abort(options.signal?.reason)
      options.signal.addEventListener("abort", onAbort)
      externalSignalCleanup = () => options.signal?.removeEventListener("abort", onAbort)
    }
  }

  let timerId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  if (timeoutMs > 0) {
    timerId = setTimeout(() => {
      timedOut = true
      controller.abort(new Error("REQUEST_TIMEOUT"))
    }, timeoutMs)
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    })

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Invalid email or password. Please verify your credentials.")
      }
      if (res.status === 429) {
        throw new Error("Too many login attempts. Please wait a moment before trying again.")
      }
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error("Backend server is currently waking up or unavailable. Please try again in a few moments.")
      }
      const errorBody = await res.json().catch(() => null)
      throw new Error(errorBody?.message || `Login failed: ${res.status}`)
    }

    const data: LoginResponse = await res.json()
    setAuthToken(data.token, rememberDevice)
    return data
  } catch (err: unknown) {
    if (timedOut) {
      throw new Error("Login request timed out while waiting for the server to wake up. The backend service may still be starting from sleep; please retry shortly.")
    }
    if (options?.signal?.aborted) {
      throw new Error("Login request was cancelled.")
    }
    if (err instanceof Error) {
      if ((err.name === "AbortError" || err.name === "TimeoutError") && !timedOut) {
        throw new Error("Login request was cancelled.")
      }
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        throw new Error("Unable to connect to the backend server. It may still be spinning up from sleep. Please try again.")
      }
      throw err
    }
    throw new Error("An unexpected error occurred during login. Please try again.")
  } finally {
    if (timerId) clearTimeout(timerId)
    if (externalSignalCleanup) externalSignalCleanup()
  }
}

export async function register(
  name: string,
  email: string,
  password: string,
  rememberDevice = true,
  options?: RequestOptions
): Promise<LoginResponse> {
  if (apiConfigError) {
    throw new Error(`Application configuration error: ${apiConfigError}`)
  }
  const timeoutMs = options?.timeoutMs ?? DEFAULT_AUTH_TIMEOUT_MS
  const controller = new AbortController()

  let externalSignalCleanup: (() => void) | undefined
  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort(options.signal.reason)
    } else {
      const onAbort = () => controller.abort(options.signal?.reason)
      options.signal.addEventListener("abort", onAbort)
      externalSignalCleanup = () => options.signal?.removeEventListener("abort", onAbort)
    }
  }

  let timerId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  if (timeoutMs > 0) {
    timerId = setTimeout(() => {
      timedOut = true
      controller.abort(new Error("REQUEST_TIMEOUT"))
    }, timeoutMs)
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
      signal: controller.signal,
    })

    if (!res.ok) {
      if (res.status === 409) {
        throw new Error("An account with this email already exists.")
      }
      if (res.status === 429) {
        throw new Error("Too many registration attempts. Please wait a moment before trying again.")
      }
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error("Backend server is currently waking up or unavailable. Please try again in a few moments.")
      }
      const errorBody = await res.json().catch(() => null)
      throw new Error(errorBody?.message || `Registration failed: ${res.status}`)
    }

    const data: LoginResponse = await res.json()
    setAuthToken(data.token, rememberDevice)
    return data
  } catch (err: unknown) {
    if (timedOut) {
      throw new Error("Registration request timed out while waiting for the server to wake up. The backend service may still be starting from sleep; please retry shortly.")
    }
    if (options?.signal?.aborted) {
      throw new Error("Registration request was cancelled.")
    }
    if (err instanceof Error) {
      if ((err.name === "AbortError" || err.name === "TimeoutError") && !timedOut) {
        throw new Error("Registration request was cancelled.")
      }
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        throw new Error("Unable to connect to the backend server. It may still be spinning up from sleep. Please try again.")
      }
      throw err
    }
    throw new Error("An unexpected error occurred during registration. Please try again.")
  } finally {
    if (timerId) clearTimeout(timerId)
    if (externalSignalCleanup) externalSignalCleanup()
  }
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
  dueDateFrom?: string
  dueDateTo?: string
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
  if (params?.dueDateFrom) query.set("dueDateFrom", params.dueDateFrom)
  if (params?.dueDateTo) query.set("dueDateTo", params.dueDateTo)
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

export async function provisionPersonalWorkspace(): Promise<BackendTeam> {
  const res = await fetch(`${API_BASE}/teams/provision-personal`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    handleAuthError(res)
    const errorBody = await res.json().catch(() => null)
    throw new Error(errorBody?.message || `Failed to provision personal workspace: ${res.status}`)
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

export interface HealthStatusResult {
  isUp: boolean
  durationMs: number
  status: number
  message: string
}

export async function checkBackendHealth(options?: RequestOptions): Promise<HealthStatusResult> {
  if (apiConfigError) {
    return {
      isUp: false,
      durationMs: 0,
      status: 0,
      message: `Configuration error: ${apiConfigError}`,
    }
  }
  const timeoutMs = options?.timeoutMs ?? 10000
  const controller = new AbortController()

  if (options?.signal?.aborted) {
    return {
      isUp: false,
      durationMs: 0,
      status: 0,
      message: "Health check was cancelled.",
    }
  }

  let externalSignalCleanup: (() => void) | undefined
  if (options?.signal) {
    const onAbort = () => controller.abort(options.signal?.reason)
    options.signal.addEventListener("abort", onAbort)
    externalSignalCleanup = () => options.signal?.removeEventListener("abort", onAbort)
  }

  let timerId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  if (timeoutMs > 0) {
    timerId = setTimeout(() => {
      timedOut = true
      controller.abort(new Error("HEALTH_CHECK_TIMEOUT"))
    }, timeoutMs)
  }

  const startTime = Date.now()
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
    const durationMs = Date.now() - startTime
    if (!res.ok) {
      return {
        isUp: false,
        durationMs,
        status: res.status,
        message: `Health endpoint returned HTTP ${res.status}.`,
      }
    }
    const data = await res.json().catch(() => null)
    const isUp = data?.status === "UP"
    return {
      isUp,
      durationMs,
      status: res.status,
      message: isUp
        ? `Backend server is responsive (status UP in ${durationMs}ms).`
        : `Backend responded but reported status: ${data?.status || "UNKNOWN"}.`,
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime
    if (timedOut) {
      return {
        isUp: false,
        durationMs,
        status: 0,
        message: "Health probe timed out. The backend container may still be spinning up.",
      }
    }
    if (err instanceof Error && err.name === "AbortError") {
      return {
        isUp: false,
        durationMs,
        status: 0,
        message: "Health check was cancelled.",
      }
    }
    return {
      isUp: false,
      durationMs,
      status: 0,
      message: "Unable to reach health endpoint. Server may be in cold sleep.",
    }
  } finally {
    if (timerId) clearTimeout(timerId)
    if (externalSignalCleanup) externalSignalCleanup()
  }
}
