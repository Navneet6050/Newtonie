package com.newtonite.health;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Lightweight public health check endpoint for uptime monitoring and warm-up pings.
 * Operates purely in-memory with no database writes or sensitive state.
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    private static final Map<String, String> HEALTHY_RESPONSE = Map.of("status", "UP");

    @GetMapping
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(HEALTHY_RESPONSE);
    }
}
