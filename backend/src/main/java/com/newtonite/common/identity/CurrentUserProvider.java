package com.newtonite.common.identity;

import com.newtonite.team.User;

import java.util.UUID;

/**
 * Strategy interface for resolving the active actor identity.
 */
public interface CurrentUserProvider {
    User getCurrentUser();
    UUID getCurrentUserId();
}
