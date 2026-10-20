package com.newtonite.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window rate limiter for public registration endpoint to protect against registration abuse.
 */
@Component
public class RegistrationRateLimiter {

    private final int maxRequestsPerWindow;
    private final long windowSeconds;
    private final Map<String, Deque<Long>> requestTimesByIp = new ConcurrentHashMap<>();

    public RegistrationRateLimiter(
            @Value("${security.registration.rate-limit.max-requests:10}") int maxRequestsPerWindow,
            @Value("${security.registration.rate-limit.window-seconds:60}") long windowSeconds) {
        this.maxRequestsPerWindow = maxRequestsPerWindow;
        this.windowSeconds = windowSeconds;
    }

    public synchronized void checkRateLimit(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = "unknown";
        }

        long now = Instant.now().getEpochSecond();
        long windowStart = now - windowSeconds;

        Deque<Long> timestamps = requestTimesByIp.computeIfAbsent(clientIp, k -> new ArrayDeque<>());

        // Evict expired timestamps
        while (!timestamps.isEmpty() && timestamps.peekFirst() <= windowStart) {
            timestamps.pollFirst();
        }

        if (timestamps.size() >= maxRequestsPerWindow) {
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Too many registration attempts. Please wait a few moments and try again."
            );
        }

        timestamps.addLast(now);
    }

    public synchronized void reset() {
        requestTimesByIp.clear();
    }
}
