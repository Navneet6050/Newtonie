package com.newtonite.workitem;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum WorkItemStatus {
    OPEN,
    IN_PROGRESS,
    REVIEW_NEEDED,
    COMPLETED,
    BLOCKED;

    /**
     * Evaluates whether a transition from this status to target status is permitted.
     * Same-status transitions are permitted (handled as no-ops).
     */
    public boolean canTransitionTo(WorkItemStatus target) {
        if (target == null || this == target) {
            return true;
        }

        return switch (this) {
            case OPEN -> target == IN_PROGRESS || target == BLOCKED;
            case IN_PROGRESS -> target == REVIEW_NEEDED || target == COMPLETED || target == BLOCKED;
            case REVIEW_NEEDED -> target == IN_PROGRESS || target == COMPLETED || target == BLOCKED;
            case BLOCKED -> target == OPEN || target == IN_PROGRESS || target == REVIEW_NEEDED;
            case COMPLETED -> false; // COMPLETED is a terminal state in M2; cannot be reopened by standard update
        };
    }

    @JsonCreator
    public static WorkItemStatus from(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase();
        if ("TODO".equals(normalized)) {
            return OPEN;
        }
        return WorkItemStatus.valueOf(normalized);
    }

    @JsonValue
    public String toValue() {
        return name();
    }
}
