package com.newtonite.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Security baseline for Newtonite M1.
 * 
 * NOTE: This is a deliberate development-safe baseline for M1 foundation validation.
 * It permits /actuator/health for readiness/liveness checks, and permits /api/** temporarily
 * until Milestone M2 introduces server-enforced role and identity authorization.
 * Client-provided headers (such as X-User-Id) are NOT treated as trusted identity here.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
                // M1 Baseline: Development access for API foundation; M2 will introduce server-side authorization
                .requestMatchers("/api/**").permitAll()
                .anyRequest().authenticated()
            );

        return http.build();
    }
}
