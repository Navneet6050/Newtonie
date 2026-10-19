package com.newtonite.workitem.dto;

import com.newtonite.workitem.WorkItemPriority;
import com.newtonite.workitem.WorkItemType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public record CreateWorkItemRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title cannot exceed 255 characters")
        String title,

        String description,

        @NotNull(message = "Work item type is required (INCIDENT, TASK, BUG, OPS)")
        WorkItemType type,

        @NotNull(message = "Work item priority is required (URGENT, HIGH, MEDIUM, LOW)")
        WorkItemPriority priority,

        @NotBlank(message = "System area is required")
        @Size(max = 100, message = "System area cannot exceed 100 characters")
        String systemArea,

        UUID teamId,

        UUID assigneeId,

        Instant dueDate
) {}
