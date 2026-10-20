package com.newtonite.team.dto;

import com.newtonite.team.TeamMembership;

import java.time.Instant;
import java.util.UUID;

public record TeamMemberResponse(
        UUID userId,
        String name,
        String email,
        String avatarInitials,
        String role,
        Instant joinedAt
) {
    public static TeamMemberResponse from(TeamMembership membership) {
        if (membership == null || membership.getUser() == null) {
            return null;
        }
        return new TeamMemberResponse(
                membership.getUser().getId(),
                membership.getUser().getName(),
                membership.getUser().getEmail(),
                membership.getUser().getAvatarInitials(),
                membership.getRole(),
                membership.getCreatedAt()
        );
    }
}
