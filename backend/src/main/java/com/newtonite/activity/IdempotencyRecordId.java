package com.newtonite.activity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class IdempotencyRecordId implements Serializable {

    private UUID userId;
    private String key;

    public IdempotencyRecordId() {
    }

    public IdempotencyRecordId(UUID userId, String key) {
        this.userId = userId;
        this.key = key;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        IdempotencyRecordId that = (IdempotencyRecordId) o;
        return Objects.equals(userId, that.userId) && Objects.equals(key, that.key);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, key);
    }
}
