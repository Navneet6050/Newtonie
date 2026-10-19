package com.newtonite.common.error;

public class StaleVersionConflictException extends RuntimeException {
    public StaleVersionConflictException(String message) {
        super(message);
    }
}
