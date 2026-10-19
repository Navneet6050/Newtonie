package com.newtonite.security.dto;

import java.util.UUID;

public record TeamMembershipSummary(
        UUID teamId,
        String teamName,
        String role
) {
}
