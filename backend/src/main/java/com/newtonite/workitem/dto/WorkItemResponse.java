package com.newtonite.workitem.dto;

import com.newtonite.workitem.WorkItem;
import com.newtonite.workitem.WorkItemPriority;
import com.newtonite.workitem.WorkItemStatus;
import com.newtonite.workitem.WorkItemType;

import java.time.Instant;
import java.util.UUID;

public record WorkItemResponse(
        UUID id,
        String trackingNumber,
        String title,
        String description,
        WorkItemType type,
        WorkItemStatus status,
        WorkItemPriority priority,
        String systemArea,
        TeamSummaryResponse team,
        UserSummaryResponse assignee,
        UserSummaryResponse reporter,
        Instant dueDate,
        Long version,
        Instant createdAt,
        Instant updatedAt
) {
    public static WorkItemResponse from(WorkItem item) {
        if (item == null) {
            return null;
        }
        return new WorkItemResponse(
                item.getId(),
                item.getTrackingNumber(),
                item.getTitle(),
                item.getDescription(),
                item.getType(),
                item.getStatus(),
                item.getPriority(),
                item.getSystemArea(),
                TeamSummaryResponse.from(item.getTeam()),
                UserSummaryResponse.from(item.getAssignee()),
                UserSummaryResponse.from(item.getReporter()),
                item.getDueDate(),
                item.getVersion() != null ? item.getVersion() : 0L,
                item.getCreatedAt(),
                item.getUpdatedAt()
        );
    }
}
