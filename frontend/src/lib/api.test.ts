import test from "node:test"
import assert from "node:assert/strict"
import { login, register, DEFAULT_AUTH_TIMEOUT_MS } from "./api.ts"

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
