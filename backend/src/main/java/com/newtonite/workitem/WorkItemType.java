package com.newtonite.workitem;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum WorkItemType {
    INCIDENT,
    TASK,
    BUG,
    OPS;

    @JsonCreator
    public static WorkItemType from(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return WorkItemType.valueOf(value.trim().toUpperCase());
    }

    @JsonValue
    public String toValue() {
        return name();
    }
}
