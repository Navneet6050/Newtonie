package com.newtonite.common.error;

public class ClaimConflictException extends RuntimeException {
    public ClaimConflictException(String message) {
        super(message);
    }
}
