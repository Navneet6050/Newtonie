package com.newtonite.activity.dto;

import com.newtonite.activity.ActivityLog;
import com.newtonite.workitem.dto.UserSummaryResponse;

import java.time.Instant;
import java.util.UUID;

public record ActivityLogResponse(
        UUID id,
        UUID workItemId,
        UserSummaryResponse actor,
        String actionType,
        String fieldName,
        String fromValue,
        String toValue,
        String metadata,
        Instant timestamp
) {
    public static ActivityLogResponse from(ActivityLog log) {
        if (log == null) {
            return null;
        }
        return new ActivityLogResponse(
                log.getId(),
                log.getWorkItem() != null ? log.getWorkItem().getId() : null,
                UserSummaryResponse.from(log.getActor()),
                log.getActionType(),
                log.getFieldName(),
                log.getFromValue(),
                log.getToValue(),
                log.getMetadata(),
                log.getTimestamp()
        );
    }
}
