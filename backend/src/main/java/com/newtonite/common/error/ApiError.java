package com.newtonite.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
    Instant timestamp,
    int status,
    String error,
    String message,
    String path,
    Map<String, String> validationErrors
) {
    public ApiError(int status, String error, String message, String path) {
        this(Instant.now(), status, error, message, path, null);
    }

    public ApiError(int status, String error, String message, String path, Map<String, String> validationErrors) {
        this(Instant.now(), status, error, message, path, validationErrors);
    }
}
