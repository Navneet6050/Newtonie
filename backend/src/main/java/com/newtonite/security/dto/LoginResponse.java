package com.newtonite.security.dto;

public record LoginResponse(
        String token,
        String type,
        AuthUserResponse user
) {
}
