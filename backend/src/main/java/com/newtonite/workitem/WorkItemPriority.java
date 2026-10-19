package com.newtonite.workitem;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum WorkItemPriority {
    URGENT,
    HIGH,
    MEDIUM,
    LOW;

    @JsonCreator
    public static WorkItemPriority from(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return WorkItemPriority.valueOf(value.trim().toUpperCase());
    }

    @JsonValue
    public String toValue() {
        return name();
    }
}
