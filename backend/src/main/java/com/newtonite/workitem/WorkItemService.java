package com.newtonite.workitem;

import com.newtonite.activity.ActivityLogService;
import com.newtonite.activity.IdempotencyService;
import com.newtonite.common.error.ClaimConflictException;
import com.newtonite.common.error.InvalidStateTransitionException;
import com.newtonite.common.error.ResourceNotFoundException;
import com.newtonite.common.error.StaleVersionConflictException;
import com.newtonite.common.identity.CurrentUserProvider;
import com.newtonite.team.Team;
import com.newtonite.team.TeamRepository;
import com.newtonite.team.User;
import com.newtonite.team.UserRepository;
import com.newtonite.workitem.dto.CreateWorkItemRequest;
import com.newtonite.workitem.dto.PagedResponse;
import com.newtonite.workitem.dto.UpdateWorkItemRequest;
import com.newtonite.workitem.dto.WorkItemResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class WorkItemService {

    private final WorkItemRepository workItemRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final ActivityLogService activityLogService;
    private final IdempotencyService idempotencyService;
    private final CurrentUserProvider currentUserProvider;

    public WorkItemService(
            WorkItemRepository workItemRepository,
            TeamRepository teamRepository,
            UserRepository userRepository,
            ActivityLogService activityLogService,
            IdempotencyService idempotencyService,
            CurrentUserProvider currentUserProvider) {
        this.workItemRepository = workItemRepository;
        this.teamRepository = teamRepository;
        this.userRepository = userRepository;
        this.activityLogService = activityLogService;
        this.idempotencyService = idempotencyService;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional
    public WorkItemResponse createWorkItem(CreateWorkItemRequest request, String idempotencyKey) {
        String requestHash = null;
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            requestHash = idempotencyService.computePayloadHash(request);
            Optional<WorkItemResponse> cached = idempotencyService.getCachedResponse(idempotencyKey, requestHash);
            if (cached.isPresent()) {
                return cached.get();
            }
        }

        Team team = null;
        if (request.teamId() != null) {
            team = teamRepository.findById(request.teamId())
                    .orElseThrow(() -> new IllegalArgumentException("Referenced team not found with ID: " + request.teamId()));
        }

        User assignee = null;
        if (request.assigneeId() != null) {
            assignee = userRepository.findById(request.assigneeId())
                    .orElseThrow(() -> new IllegalArgumentException("Referenced assignee user not found with ID: " + request.assigneeId()));
        }

        User reporter = currentUserProvider.getCurrentUser();

        Long nextSeq = workItemRepository.getNextTrackingSequenceValue();
        String trackingNumber = String.format("NEW-%d", nextSeq != null ? nextSeq : 1000L);

        WorkItem workItem = new WorkItem(
                UUID.randomUUID(),
                trackingNumber,
                request.title().trim(),
                request.description(),
                request.type(),
                WorkItemStatus.OPEN,
                request.priority(),
                request.systemArea().trim(),
                team,
                assignee,
                reporter,
                request.dueDate()
        );

        WorkItem saved = workItemRepository.saveAndFlush(workItem);

        activityLogService.logActivity(
                saved,
                reporter,
                "CREATED",
                null,
                null,
                null,
                "Work item created with tracking number " + trackingNumber
        );

        WorkItemResponse response = WorkItemResponse.from(saved);

        if (idempotencyKey != null && !idempotencyKey.isBlank() && requestHash != null) {
            idempotencyService.recordSuccess(idempotencyKey, "/api/work-items", requestHash, 201, response);
        }

        return response;
    }

    @Transactional(readOnly = true)
    public WorkItemResponse getWorkItem(UUID id) {
        WorkItem workItem = workItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Work item not found with ID: " + id));
        return WorkItemResponse.from(workItem);
    }

    @Transactional(readOnly = true)
    public PagedResponse<WorkItemResponse> listWorkItems(
            String search,
            WorkItemStatus status,
            WorkItemPriority priority,
            WorkItemType type,
            UUID teamId,
            UUID assigneeId,
            String systemArea,
            Pageable pageable) {

        Specification<WorkItem> spec = WorkItemSpecification.filterBy(
                search, status, priority, type, teamId, assigneeId, systemArea
        );

        Page<WorkItem> page = workItemRepository.findAll(spec, pageable);
        return PagedResponse.from(page, WorkItemResponse::from);
    }

    @Transactional
    public WorkItemResponse updateWorkItem(UUID id, UpdateWorkItemRequest request) {
        WorkItem item = workItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Work item not found with ID: " + id));

        // Optimistic locking verification: enforce version precondition if supplied
        if (request.isPresent("expectedVersion") && request.getExpectedVersion() != null) {
            if (!item.getVersion().equals(request.getExpectedVersion())) {
                throw new StaleVersionConflictException(String.format(
                        "Work item version conflict: expected version %d but current version is %d",
                        request.getExpectedVersion(), item.getVersion()
                ));
            }
        }

        User actor = currentUserProvider.getCurrentUser();

        if (request.isPresent("title") && request.getTitle() != null && !request.getTitle().isBlank()) {
            String newTitle = request.getTitle().trim();
            if (!Objects.equals(item.getTitle(), newTitle)) {
                activityLogService.logActivity(item, actor, "TITLE_CHANGED", "title", item.getTitle(), newTitle, null);
                item.setTitle(newTitle);
            }
        }

        if (request.isPresent("description")) {
            String newDesc = request.getDescription();
            if (!Objects.equals(item.getDescription(), newDesc)) {
                activityLogService.logActivity(item, actor, "DESCRIPTION_CHANGED", "description", null, null, "Description updated");
                item.setDescription(newDesc);
            }
        }

        if (request.isPresent("type") && request.getType() != null) {
            if (item.getType() != request.getType()) {
                activityLogService.logActivity(item, actor, "TYPE_CHANGED", "type", item.getType().name(), request.getType().name(), null);
                item.setType(request.getType());
            }
        }

        if (request.isPresent("priority") && request.getPriority() != null) {
            if (item.getPriority() != request.getPriority()) {
                activityLogService.logActivity(item, actor, "PRIORITY_CHANGED", "priority", item.getPriority().name(), request.getPriority().name(), null);
                item.setPriority(request.getPriority());
            }
        }

        if (request.isPresent("status") && request.getStatus() != null) {
            WorkItemStatus targetStatus = request.getStatus();
            if (item.getStatus() != targetStatus) {
                if (!item.getStatus().canTransitionTo(targetStatus)) {
                    throw new InvalidStateTransitionException(String.format(
                            "Cannot transition work item %s from %s to %s",
                            item.getTrackingNumber(), item.getStatus(), targetStatus
                    ));
                }
                activityLogService.logActivity(item, actor, "STATUS_CHANGED", "status", item.getStatus().name(), targetStatus.name(), null);
                item.setStatus(targetStatus);
            }
        }

        if (request.isPresent("assigneeId")) {
            UUID newAssigneeId = request.getAssigneeId();
            User oldAssignee = item.getAssignee();
            UUID oldAssigneeId = oldAssignee != null ? oldAssignee.getId() : null;

            if (!Objects.equals(oldAssigneeId, newAssigneeId)) {
                User newAssignee = null;
                if (newAssigneeId != null) {
                    newAssignee = userRepository.findById(newAssigneeId)
                            .orElseThrow(() -> new IllegalArgumentException("Referenced assignee user not found with ID: " + newAssigneeId));
                }
                String fromVal = oldAssignee != null ? oldAssignee.getName() : "UNASSIGNED";
                String toVal = newAssignee != null ? newAssignee.getName() : "UNASSIGNED";
                activityLogService.logActivity(item, actor, "ASSIGNEE_CHANGED", "assignee", fromVal, toVal, null);
                item.setAssignee(newAssignee);
            }
        }

        if (request.isPresent("dueDate")) {
            Instant newDueDate = request.getDueDate();
            if (!Objects.equals(item.getDueDate(), newDueDate)) {
                String fromVal = item.getDueDate() != null ? item.getDueDate().toString() : "NONE";
                String toVal = newDueDate != null ? newDueDate.toString() : "NONE";
                activityLogService.logActivity(item, actor, "DUE_DATE_CHANGED", "dueDate", fromVal, toVal, null);
                item.setDueDate(newDueDate);
            }
        }

        if (request.isPresent("systemArea") && request.getSystemArea() != null && !request.getSystemArea().isBlank()) {
            String newArea = request.getSystemArea().trim();
            if (!Objects.equals(item.getSystemArea(), newArea)) {
                activityLogService.logActivity(item, actor, "SYSTEM_AREA_CHANGED", "systemArea", item.getSystemArea(), newArea, null);
                item.setSystemArea(newArea);
            }
        }

        item.setUpdatedAt(Instant.now());
        WorkItem updated = workItemRepository.saveAndFlush(item);
        return WorkItemResponse.from(updated);
    }

    @Transactional
    public WorkItemResponse claimWorkItem(UUID id) {
        WorkItem item = workItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Work item not found with ID: " + id));

        if (item.getAssignee() != null) {
            throw new ClaimConflictException(String.format(
                    "Work item %s is already assigned to %s",
                    item.getTrackingNumber(), item.getAssignee().getName()
            ));
        }

        User actor = currentUserProvider.getCurrentUser();

        // Database-level atomic update with WHERE assignee IS NULL
        int affectedRows = workItemRepository.claimWorkItemAtomically(id, actor, Instant.now());
        if (affectedRows == 0) {
            throw new ClaimConflictException(String.format(
                    "Work item %s was concurrently claimed by another user",
                    item.getTrackingNumber()
            ));
        }

        activityLogService.logActivity(
                item,
                actor,
                "CLAIMED",
                "assignee",
                "UNASSIGNED",
                actor.getName(),
                "Claimed by " + actor.getName()
        );

        WorkItem claimed = workItemRepository.findById(id).orElseThrow();
        return WorkItemResponse.from(claimed);
    }
}
