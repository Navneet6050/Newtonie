package com.newtonite.workitem.dto;

import com.newtonite.team.Team;

import java.util.UUID;

public record TeamSummaryResponse(
        UUID id,
        String name
) {
    public static TeamSummaryResponse from(Team team) {
        if (team == null) {
            return null;
        }
        return new TeamSummaryResponse(team.getId(), team.getName());
    }
}
