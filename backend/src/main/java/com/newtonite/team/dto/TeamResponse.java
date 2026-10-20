package com.newtonite.team.dto;

import com.newtonite.team.Team;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record TeamResponse(
        UUID id,
        String name,
        String description,
        long memberCount,
        long workItemCount,
        List<TeamMemberResponse> members,
        Instant createdAt,
        Instant updatedAt
) {
    public static TeamResponse of(Team team, List<TeamMemberResponse> members, long workItemCount) {
        if (team == null) {
            return null;
        }
        return new TeamResponse(
                team.getId(),
                team.getName(),
                team.getDescription(),
                members != null ? members.size() : 0,
                workItemCount,
                members != null ? members : List.of(),
                team.getCreatedAt(),
                team.getUpdatedAt()
        );
    }
}
