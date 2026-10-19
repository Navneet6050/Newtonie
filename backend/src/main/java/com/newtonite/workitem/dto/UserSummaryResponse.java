package com.newtonite.workitem.dto;

import com.newtonite.team.User;

import java.util.UUID;

public record UserSummaryResponse(
        UUID id,
        String name,
        String avatarInitials,
        String email
) {
    public static UserSummaryResponse from(User user) {
        if (user == null) {
            return null;
        }
        return new UserSummaryResponse(
                user.getId(),
                user.getName(),
                user.getAvatarInitials(),
                user.getEmail()
        );
    }
}
