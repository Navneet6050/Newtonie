package com.newtonite.common.identity;

import com.newtonite.team.User;
import com.newtonite.team.UserRepository;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Development-only identity resolution strategy for Newtonite Milestone M2.
 * Resolves the acting user to the seeded development lead user: Alex Morgan (UUID: 11111111-1111-1111-1111-111111111111).
 * 
 * SECURITY BOUNDARY:
 * This provider explicitly isolates the development identity fixture.
 * In accordance with engineering requirements, it does NOT trust client-supplied identity headers (such as X-User-Id).
 * Production identity (e.g. JWT tokens or authenticated session principals) will replace this in future milestones.
 */
@Component
public class DevelopmentCurrentUserProvider implements CurrentUserProvider {

    public static final UUID DEV_USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    private final UserRepository userRepository;

    public DevelopmentCurrentUserProvider(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public User getCurrentUser() {
        return userRepository.findById(DEV_USER_ID)
                .orElseGet(() -> new User(DEV_USER_ID, "alex.morgan@acme.internal", "Alex Morgan", "AM", "ADMIN"));
    }

    @Override
    public UUID getCurrentUserId() {
        return DEV_USER_ID;
    }
}
