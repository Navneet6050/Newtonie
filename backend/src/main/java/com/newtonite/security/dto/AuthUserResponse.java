package com.newtonite.security.dto;

import java.util.List;
import java.util.UUID;

public record AuthUserResponse(
        UUID id,
        String email,
        String name,
        String avatarInitials,
        String systemRole,
        List<TeamMembershipSummary> teams
) {
}
