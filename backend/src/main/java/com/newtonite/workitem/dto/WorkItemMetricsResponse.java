package com.newtonite.workitem.dto;

public record WorkItemMetricsResponse(
        long openCount,
        long inProgressCount,
        long reviewNeededCount,
        long completedCount,
        long blockedCount,
        long urgentCount,
        long blockedOrUrgentCount,
        long totalCount
) {}
