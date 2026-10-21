import test from "node:test"
import assert from "node:assert/strict"
import {
  login,
  register,
  checkBackendHealth,
  normalizeApiBase,
  DEFAULT_AUTH_TIMEOUT_MS,
  getApiConfigurationError,
  _setApiConfigErrorForTesting,
  getCurrentUser,
  fetchWorkItemMetrics,
  fetchWorkItems,
  getWorkItem,
  createWorkItem,
  updateWorkItem,
  claimWorkItem,
  fetchActivityHistory,
  fetchWorkItemComments,
  createWorkItemComment,
  fetchTeams,
  fetchTeamDetails,
  provisionPersonalWorkspace,
  fetchActivityFeed,
} from "./api.ts"

// Save original fetch
const originalFetch = globalThis.fetch

test("DEFAULT_AUTH_TIMEOUT_MS is 50000ms to accommodate Render cold starts", () => {
  assert.strictEqual(DEFAULT_AUTH_TIMEOUT_MS, 50000)
})

test("login() aborts and throws clear timeout error when request exceeds timeoutMs", async () => {
  // Mock fetch that hangs forever
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("This operation was aborted")
        error.name = "AbortError"
        reject(error)
      })
    })
  }) as typeof fetch

  try {
    await assert.rejects(
      async () => {
        await login("test@newtonite.com", "Secret123!", true, { timeoutMs: 50 })
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("timed out while waiting for the server to wake up"),
          `Expected timeout error message but got: ${err.message}`
        )
        // Ensure sensitive credentials are never leaked in error message
        assert.ok(!err.message.includes("Secret123!"), "Password must not be in error message")
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("login() aborts immediately when caller AbortSignal fires", async () => {
  const controller = new AbortController()

  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("This operation was aborted")
        error.name = "AbortError"
        reject(error)
      })
    })
  }) as typeof fetch

  try {
    const loginPromise = login("test@newtonite.com", "Secret123!", true, {
      signal: controller.signal,
      timeoutMs: 10000,
    })

    // Abort from outside
    controller.abort()

    await assert.rejects(
      loginPromise,
      (err: Error) => {
        assert.ok(
          err.message.includes("cancelled"),
          `Expected cancellation error but got: ${err.message}`
        )
        assert.ok(!err.message.includes("Secret123!"), "Password must not be leaked")
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("login() maps 401 to clear credential error without exposing password", async () => {
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ message: "Invalid email or password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch

  try {
    await assert.rejects(
      async () => {
        await login("wrong@newtonite.com", "MyBadPass123!", true, { timeoutMs: 1000 })
      },
      (err: Error) => {
        assert.strictEqual(err.message, "Invalid email or password. Please verify your credentials.")
        assert.ok(!err.message.includes("MyBadPass123!"))
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("login() maps 502/504 gateway errors to wake-up guidance", async () => {
  for (const status of [502, 503, 504]) {
    globalThis.fetch = (async () => {
      return new Response("Gateway Timeout", { status })
    }) as typeof fetch

    try {
      await assert.rejects(
        async () => {
          await login("alex@newtonite.com", "Pass123!", true, { timeoutMs: 1000 })
        },
        (err: Error) => {
          assert.ok(
            err.message.includes("waking up or unavailable"),
            `Status ${status} expected wake-up error but got: ${err.message}`
          )
          return true
        }
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  }
})

test("login() returns data and sets token on 200 OK", async () => {
  const fakeToken = "mock.jwt.token"
  const fakeResponse = {
    token: fakeToken,
    type: "Bearer",
    user: {
      id: "11111111-1111-1111-1111-111111111111",
      email: "alex@newtonite.com",
      name: "Alex",
      avatarInitials: "AM",
      systemRole: "ADMIN",
      teams: [],
    },
  }

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify(fakeResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch

  try {
    const result = await login("alex@newtonite.com", "Pass123!", true, { timeoutMs: 1000 })
    assert.strictEqual(result.token, fakeToken)
    assert.strictEqual(result.user.email, "alex@newtonite.com")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("register() aborts and throws timeout error on slow server", async () => {
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("This operation was aborted")
        error.name = "AbortError"
        reject(error)
      })
    })
  }) as typeof fetch

  try {
    await assert.rejects(
      async () => {
        await register("New User", "new@newtonite.com", "Pass123!", true, { timeoutMs: 50 })
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("timed out while waiting for the server to wake up"),
          `Expected timeout error but got: ${err.message}`
        )
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("login() allows subsequent retry attempt after a previous timeout without hanging", async () => {
  let callCount = 0
  const fakeToken = "retry.jwt.token"
  const fakeUser = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "alex@newtonite.com",
    name: "Alex Morgan",
    avatarInitials: "AM",
    systemRole: "ADMIN",
    teams: [],
  }

  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    callCount++
    if (callCount === 1) {
      // First attempt hangs until aborted by timeout
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("This operation was aborted")
          error.name = "AbortError"
          reject(error)
        })
      })
    } else {
      // Second attempt (manual retry) succeeds immediately (server has finished waking up)
      return Promise.resolve(
        new Response(
          JSON.stringify({
            token: fakeToken,
            type: "Bearer",
            user: fakeUser,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    }
  }) as typeof fetch

  try {
    // 1st attempt: times out after 40ms
    await assert.rejects(
      async () => {
        await login("alex@newtonite.com", "DevPassword!", true, { timeoutMs: 40 })
      },
      (err: Error) => {
        assert.ok(err.message.includes("timed out while waiting for the server to wake up"))
        return true
      }
    )

    // 2nd attempt (manual user retry): succeeds cleanly
    const retryResult = await login("alex@newtonite.com", "DevPassword!", true, { timeoutMs: 1000 })
    assert.strictEqual(retryResult.token, fakeToken)
    assert.strictEqual(retryResult.user.email, "alex@newtonite.com")
    assert.strictEqual(callCount, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("checkBackendHealth() returns isUp: true and latency when /api/health responds 200 UP", async () => {
  globalThis.fetch = (async (url: string | URL | Request) => {
    assert.ok(String(url).endsWith("/health"), `Expected health endpoint URL but got: ${url}`)
    return new Response(JSON.stringify({ status: "UP" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch

  try {
    const result = await checkBackendHealth({ timeoutMs: 1000 })
    assert.strictEqual(result.isUp, true)
    assert.strictEqual(result.status, 200)
    assert.ok(result.durationMs >= 0)
    assert.ok(result.message.includes("responsive"))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("checkBackendHealth() returns isUp: false when health endpoint responds non-200", async () => {
  globalThis.fetch = (async () => {
    return new Response("Bad Gateway", { status: 502 })
  }) as typeof fetch

  try {
    const result = await checkBackendHealth({ timeoutMs: 1000 })
    assert.strictEqual(result.isUp, false)
    assert.strictEqual(result.status, 502)
    assert.ok(result.message.includes("502"))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("checkBackendHealth() gracefully handles timeout without throwing unhandled rejection", async () => {
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("This operation was aborted")
        error.name = "AbortError"
        reject(error)
      })
    })
  }) as typeof fetch

  try {
    const result = await checkBackendHealth({ timeoutMs: 30 })
    assert.strictEqual(result.isUp, false)
    assert.strictEqual(result.status, 0)
    assert.ok(result.message.includes("timed out"))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("checkBackendHealth() respects external AbortSignal cancellation", async () => {
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("This operation was aborted")
        error.name = "AbortError"
        reject(error)
      })
    })
  }) as typeof fetch

  try {
    const controller = new AbortController()
    controller.abort()

    const result = await checkBackendHealth({ signal: controller.signal })
    assert.strictEqual(result.isUp, false)
    assert.ok(result.message.includes("cancelled"))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("normalizeApiBase() correctly handles default, paths, trailing slashes, and origins", () => {
  assert.strictEqual(normalizeApiBase(undefined), "/api")
  assert.strictEqual(normalizeApiBase(""), "/api")
  assert.strictEqual(normalizeApiBase("   "), "/api")
  assert.strictEqual(normalizeApiBase("/api"), "/api")
  assert.strictEqual(normalizeApiBase("/api/"), "/api")
  assert.strictEqual(normalizeApiBase("https://newtonite-api-g4r3.onrender.com/api"), "https://newtonite-api-g4r3.onrender.com/api")
  assert.strictEqual(normalizeApiBase("https://newtonite-api-g4r3.onrender.com/api/"), "https://newtonite-api-g4r3.onrender.com/api")
  assert.strictEqual(normalizeApiBase("https://newtonite-api-g4r3.onrender.com"), "https://newtonite-api-g4r3.onrender.com/api")
  assert.strictEqual(normalizeApiBase("https://newtonite-api-g4r3.onrender.com/"), "https://newtonite-api-g4r3.onrender.com/api")
})

test("login() does not automatically replay POST request upon timeout", async () => {
  let postCount = 0
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    postCount++
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("This operation was aborted")
        error.name = "AbortError"
        reject(error)
      })
    })
  }) as typeof fetch

  try {
    await assert.rejects(
      async () => {
        await login("alex@newtonite.com", "DevSecret123!", true, { timeoutMs: 35 })
      },
      (err: Error) => {
        assert.ok(err.message.includes("timed out while waiting for the server to wake up"))
        return true
      }
    )
    // Must be called exactly once; never automatically replayed
    assert.strictEqual(postCount, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("login() distinguishes external caller AbortSignal from server cold-start timeout", async () => {
  const controller = new AbortController()

  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const err = new Error("User navigated away or cancelled")
        err.name = "AbortError"
        reject(err)
      })
    })
  }) as typeof fetch

  try {
    const loginPromise = login("alex@newtonite.com", "DevSecret123!", true, {
      signal: controller.signal,
      timeoutMs: 5000,
    })

    // User or caller aborts immediately
    controller.abort(new Error("USER_CANCELLED"))

    await assert.rejects(
      loginPromise,
      (err: Error) => {
        assert.strictEqual(err.message, "Login request was cancelled.")
        assert.ok(!err.message.includes("timed out"), "User cancellation must not be reported as timeout")
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("checkBackendHealth() fetches exactly /health with GET method and no body", async () => {
  let capturedUrl = ""
  let capturedMethod = ""

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url)
    capturedMethod = init?.method || "GET"
    return new Response(JSON.stringify({ status: "UP" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch

  try {
    const result = await checkBackendHealth({ timeoutMs: 1000 })
    assert.strictEqual(result.isUp, true)
    assert.ok(capturedUrl.endsWith("/api/health") || capturedUrl.endsWith("/health"))
    assert.strictEqual(capturedMethod, "GET")
    // Health probe must communicate server responsiveness without falsely guaranteeing DB/auth readiness
    assert.ok(result.message.includes("responsive"))
    assert.ok(!result.message.includes("database verified"))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("normalizeApiBase() throws on invalid URL protocols or malformed schemes without leaking secrets", () => {
  assert.throws(
    () => normalizeApiBase("ftp://supersecrettoken@newtonite.test"),
    (err: Error) => {
      assert.ok(err.message.includes('Invalid API URL protocol: "ftp:"'))
      assert.ok(!err.message.includes("supersecrettoken"), "Secrets in URL must not be leaked into error message")
      return true
    }
  )
  assert.throws(
    () => normalizeApiBase("javascript:alert(1)"),
    (err: Error) => {
      assert.ok(err.message.includes("Invalid API URL protocol"))
      return true
    }
  )
  assert.throws(
    () => normalizeApiBase("http://"),
    (err: Error) => {
      assert.ok(err.message.includes("Invalid API URL"))
      return true
    }
  )
})

test("misconfigured API URL produces clear actionable errors and blocks unintended network requests", async () => {
  let fetchCalled = false
  globalThis.fetch = (async () => {
    fetchCalled = true
    return new Response("Unexpected call", { status: 500 })
  }) as typeof fetch

  try {
    // Simulate invalid configuration captured during module initialization
    _setApiConfigErrorForTesting('Invalid API URL protocol: "ftp:". Only http: and https: are supported.')
    assert.ok(getApiConfigurationError()?.includes('Only http: and https: are supported'))

    // 1. login() must reject immediately without calling fetch
    await assert.rejects(
      async () => {
        await login("alex@newtonite.com", "DevPassword123!", true)
      },
      (err: Error) => {
        assert.ok(err.message.includes("Application configuration error"))
        assert.ok(err.message.includes("Only http: and https: are supported"))
        return true
      }
    )
    assert.strictEqual(fetchCalled, false, "Login must not issue network request on configuration error")

    // 2. register() must reject immediately without calling fetch
    await assert.rejects(
      async () => {
        await register("Alex", "alex@newtonite.com", "DevPassword123!", true)
      },
      (err: Error) => {
        assert.ok(err.message.includes("Application configuration error"))
        return true
      }
    )
    assert.strictEqual(fetchCalled, false, "Register must not issue network request on configuration error")

    // 3. checkBackendHealth() returns clean error result without throwing or calling fetch
    const healthResult = await checkBackendHealth()
    assert.strictEqual(healthResult.isUp, false)
    assert.ok(healthResult.message.includes("Configuration error"))
    assert.strictEqual(fetchCalled, false, "Health check must not issue network request on configuration error")
  } finally {
    _setApiConfigErrorForTesting(null)
    globalThis.fetch = originalFetch
  }
})

test("invalid API configuration blocks all 17 API functions from calling fetch", async () => {
  let fetchCallCount = 0
  globalThis.fetch = (async () => {
    fetchCallCount++
    return new Response("Unexpected fetch call", { status: 500 })
  }) as typeof fetch

  try {
    _setApiConfigErrorForTesting('Invalid API URL protocol: "ftp:". Only http: and https: are supported.')

    const throwingCalls: Array<() => Promise<unknown>> = [
      () => login("alex@newtonite.com", "DevPassword123!", true),
      () => register("Alex", "alex@newtonite.com", "DevPassword123!", true),
      () => getCurrentUser(),
      () => fetchWorkItemMetrics(),
      () => fetchWorkItems(),
      () => getWorkItem("item-1"),
      () => createWorkItem({ title: "Audit WorkItem", type: "TASK", priority: "MEDIUM", systemArea: "Core" }),
      () => updateWorkItem("item-1", { title: "Updated" }),
      () => claimWorkItem("item-1"),
      () => fetchActivityHistory("item-1"),
      () => fetchWorkItemComments("item-1"),
      () => createWorkItemComment("item-1", "Test comment"),
      () => fetchTeams(),
      () => fetchTeamDetails("team-1"),
      () => provisionPersonalWorkspace(),
      () => fetchActivityFeed(),
    ]

    for (const call of throwingCalls) {
      await assert.rejects(
        call,
        (err: Error) => {
          assert.ok(
            err.message.includes("Application configuration error"),
            `Expected configuration error but got: ${err.message}`
          )
          return true
        }
      )
    }

    // Health check returns error result rather than throwing
    const healthResult = await checkBackendHealth()
    assert.strictEqual(healthResult.isUp, false)
    assert.ok(healthResult.message.includes("Configuration error"))

    // Confirm that fetch was NEVER called across all 17 endpoints
    assert.strictEqual(fetchCallCount, 0, "No API function should call fetch when configuration is invalid")
  } finally {
    _setApiConfigErrorForTesting(null)
    globalThis.fetch = originalFetch
  }
})

test("recovery flow: health check UP followed by failed login and subsequent successful manual retry", async () => {
  let step = 0
  const fakeToken = "recovered.jwt.token"
  const fakeUser = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "alex@newtonite.com",
    name: "Alex Morgan",
    avatarInitials: "AM",
    systemRole: "ADMIN",
    teams: [],
  }

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    step++
    const urlStr = String(url)
    if (step === 1) {
      // Step 1: Health check succeeds (JVM/container is responsive)
      assert.ok(urlStr.endsWith("/health"))
      assert.strictEqual(init?.method || "GET", "GET")
      return new Response(JSON.stringify({ status: "UP" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    } else if (step === 2) {
      // Step 2: Login fails (e.g., PostgreSQL connection pool not ready yet, returns 503)
      assert.ok(urlStr.endsWith("/auth/login"))
      assert.strictEqual(init?.method, "POST")
      return new Response(JSON.stringify({ message: "Database connection initializing" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    } else {
      // Step 3: Explicit user retry succeeds (DB warm and ready)
      assert.ok(urlStr.endsWith("/auth/login"))
      assert.strictEqual(init?.method, "POST")
      return new Response(
        JSON.stringify({
          token: fakeToken,
          type: "Bearer",
          user: fakeUser,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }
  }) as typeof fetch

  try {
    // 1. Health check returns UP
    const healthResult = await checkBackendHealth({ timeoutMs: 1000 })
    assert.strictEqual(healthResult.isUp, true)
    assert.strictEqual(healthResult.status, 200)

    // 2. Login fails because DB is still initializing
    await assert.rejects(
      async () => {
        await login("alex@newtonite.com", "DevPassword123!", true, { timeoutMs: 1000 })
      },
      (err: Error) => {
        assert.ok(err.message.includes("waking up or unavailable"))
        return true
      }
    )

    // 3. User explicitly clicks retry -> login succeeds cleanly
    const loginResult = await login("alex@newtonite.com", "DevPassword123!", true, { timeoutMs: 1000 })
    assert.strictEqual(loginResult.token, fakeToken)
    assert.strictEqual(loginResult.user.email, "alex@newtonite.com")
    assert.strictEqual(step, 3)
  } finally {
    globalThis.fetch = originalFetch
  }
})
