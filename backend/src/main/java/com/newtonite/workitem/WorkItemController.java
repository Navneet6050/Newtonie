package com.newtonite.workitem;

import com.newtonite.activity.ActivityLogService;
import com.newtonite.activity.dto.ActivityLogResponse;
import com.newtonite.workitem.dto.CreateWorkItemRequest;
import com.newtonite.workitem.dto.PagedResponse;
import com.newtonite.workitem.dto.UpdateWorkItemRequest;
import com.newtonite.workitem.dto.WorkItemResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/work-items")
public class WorkItemController {

    private final WorkItemService workItemService;
    private final ActivityLogService activityLogService;

    public WorkItemController(WorkItemService workItemService, ActivityLogService activityLogService) {
        this.workItemService = workItemService;
        this.activityLogService = activityLogService;
    }

    @PostMapping
    public ResponseEntity<WorkItemResponse> createWorkItem(
            @Valid @RequestBody CreateWorkItemRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        WorkItemResponse created = workItemService.createWorkItem(request, idempotencyKey);
        URI location = URI.create("/api/work-items/" + created.id());
        return ResponseEntity.created(location).body(created);
    }

    @GetMapping
    public ResponseEntity<PagedResponse<WorkItemResponse>> listWorkItems(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) WorkItemStatus status,
            @RequestParam(required = false) WorkItemPriority priority,
            @RequestParam(required = false) WorkItemType type,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID assigneeId,
            @RequestParam(required = false) String systemArea,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "updatedAt,desc") String sort) {

        int boundedPage = Math.max(0, page);
        int boundedSize = Math.clamp(size, 1, 100);

        Sort sorting = parseSort(sort);
        Pageable pageable = PageRequest.of(boundedPage, boundedSize, sorting);

        PagedResponse<WorkItemResponse> response = workItemService.listWorkItems(
                search, status, priority, type, teamId, assigneeId, systemArea, pageable
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkItemResponse> getWorkItem(@PathVariable UUID id) {
        WorkItemResponse response = workItemService.getWorkItem(id);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<WorkItemResponse> updateWorkItem(
            @PathVariable UUID id,
            @RequestBody UpdateWorkItemRequest request,
            @RequestHeader(value = "If-Match", required = false) String ifMatchHeader) {

        if (ifMatchHeader != null && !ifMatchHeader.isBlank() && !request.isPresent("expectedVersion")) {
            try {
                String cleanHeader = ifMatchHeader.replace("\"", "").trim();
                request.setExpectedVersion(Long.parseLong(cleanHeader));
            } catch (NumberFormatException ignored) {
                // If header is not a valid number, let the version check handle it or proceed with body version
            }
        }

        WorkItemResponse updated = workItemService.updateWorkItem(id, request);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/claim")
    public ResponseEntity<WorkItemResponse> claimWorkItem(@PathVariable UUID id) {
        WorkItemResponse claimed = workItemService.claimWorkItem(id);
        return ResponseEntity.ok(claimed);
    }

    @GetMapping("/{id}/activity")
    public ResponseEntity<PagedResponse<ActivityLogResponse>> getActivityHistory(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        // Validate existence of work item first
        workItemService.getWorkItem(id);

        int boundedPage = Math.max(0, page);
        int boundedSize = Math.clamp(size, 1, 100);
        Pageable pageable = PageRequest.of(boundedPage, boundedSize, Sort.by(Sort.Direction.DESC, "timestamp"));

        PagedResponse<ActivityLogResponse> activityHistory = activityLogService.getActivityHistory(id, pageable);
        return ResponseEntity.ok(activityHistory);
    }

    private Sort parseSort(String sortParam) {
        if (sortParam == null || sortParam.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "updatedAt");
        }
        String[] parts = sortParam.split(",");
        String property = parts[0].trim();
        Sort.Direction direction = (parts.length > 1 && parts[1].trim().equalsIgnoreCase("asc"))
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        // Whitelist allowed sort fields to prevent invalid property injection
        return switch (property) {
            case "createdAt" -> Sort.by(direction, "createdAt");
            case "priority" -> Sort.by(direction, "priority");
            case "status" -> Sort.by(direction, "status");
            case "title" -> Sort.by(direction, "title");
            case "trackingNumber" -> Sort.by(direction, "trackingNumber");
            default -> Sort.by(direction, "updatedAt");
        };
    }
}
