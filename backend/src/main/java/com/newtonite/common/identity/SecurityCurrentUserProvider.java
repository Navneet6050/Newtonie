package com.newtonite.common.identity;

import com.newtonite.security.UserPrincipal;
import com.newtonite.team.User;
import com.newtonite.team.UserRepository;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Production CurrentUserProvider implementation backed by the Spring Security context.
 * Resolves identity strictly from the authenticated security principal.
 * Never falls back to a default user or trusts client-supplied identity headers.
 */
@Component
@Primary
public class SecurityCurrentUserProvider implements CurrentUserProvider {

    private final UserRepository userRepository;

    public SecurityCurrentUserProvider(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public User getCurrentUser() {
        UUID userId = getCurrentUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Authenticated user not found in database: " + userId
                ));
    }

    @Override
    public UUID getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated() || authentication.getPrincipal() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication required: no active security principal"
            );
        }

        Object principal = authentication.getPrincipal();
        if ("anonymousUser".equals(principal)) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication required: user is anonymous"
            );
        }

        if (principal instanceof UserPrincipal up) {
            return up.getId();
        }

        if (principal instanceof User u) {
            return u.getId();
        }

        // Check if authentication name is a valid UUID
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Unable to resolve user ID from principal: " + authentication.getName()
            );
        }
    }
}
