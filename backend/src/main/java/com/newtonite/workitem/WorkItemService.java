package com.newtonite.workitem;

import com.newtonite.activity.ActivityLogService;
import com.newtonite.activity.IdempotencyService;
import com.newtonite.common.error.ClaimConflictException;
import com.newtonite.common.error.InvalidStateTransitionException;
import com.newtonite.common.error.ResourceNotFoundException;
import com.newtonite.common.error.StaleVersionConflictException;
import com.newtonite.common.identity.CurrentUserProvider;
import com.newtonite.team.Team;
import com.newtonite.team.TeamMembership;
import com.newtonite.team.TeamMembershipRepository;
import com.newtonite.team.TeamRepository;
import com.newtonite.team.User;
import com.newtonite.team.UserRepository;
import com.newtonite.workitem.dto.CommentResponse;
import com.newtonite.workitem.dto.CreateCommentRequest;
import com.newtonite.workitem.dto.CreateWorkItemRequest;
import com.newtonite.workitem.dto.PagedResponse;
import com.newtonite.workitem.dto.UpdateWorkItemRequest;
import com.newtonite.workitem.dto.WorkItemMetricsResponse;
import com.newtonite.workitem.dto.WorkItemResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class WorkItemService {

    private final WorkItemRepository workItemRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final TeamMembershipRepository teamMembershipRepository;
    private final ActivityLogService activityLogService;
    private final IdempotencyService idempotencyService;
    private final CurrentUserProvider currentUserProvider;
    private final CommentRepository commentRepository;

    public WorkItemService(
            WorkItemRepository workItemRepository,
            TeamRepository teamRepository,
            UserRepository userRepository,
            TeamMembershipRepository teamMembershipRepository,
            ActivityLogService activityLogService,
            IdempotencyService idempotencyService,
            CurrentUserProvider currentUserProvider,
            CommentRepository commentRepository) {
        this.workItemRepository = workItemRepository;
        this.teamRepository = teamRepository;
        this.userRepository = userRepository;
        this.teamMembershipRepository = teamMembershipRepository;
        this.activityLogService = activityLogService;
        this.idempotencyService = idempotencyService;
        this.currentUserProvider = currentUserProvider;
        this.commentRepository = commentRepository;
    }

    private boolean isAdmin(User user) {
        return user != null && "ADMIN".equalsIgnoreCase(user.getSystemRole());
    }

    private void checkTeamAccess(UUID teamId, User user) {
        if (!isAdmin(user)) {
            if (teamId == null || !teamMembershipRepository.existsByTeamIdAndUserId(teamId, user.getId())) {
                throw new AccessDeniedException("Access denied: user is not an authorized member of team " + teamId);
            }
        }
    }

    private void checkAssigneeTeamMembership(UUID teamId, User assignee) {
        if (assignee != null && teamId != null) {
            if (!teamMembershipRepository.existsByTeamIdAndUserId(teamId, assignee.getId())) {
                throw new IllegalArgumentException(String.format(
                        "Assignee '%s' is not a member of the work item's team",
                        assignee.getName()
                ));
            }
        }
    }

    @Transactional
    public WorkItemResponse createWorkItem(CreateWorkItemRequest request, String idempotencyKey) {
        User actor = currentUserProvider.getCurrentUser();

        String requestHash = null;
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            requestHash = idempotencyService.computePayloadHash(request);
            Optional<WorkItemResponse> cached = idempotencyService.getCachedResponse(actor.getId(), idempotencyKey, requestHash);
            if (cached.isPresent()) {
                return cached.get();
            }
        }

        if (request.teamId() == null) {
            throw new IllegalArgumentException("Team ID is required to create a work item");
        }

        Team team = teamRepository.findById(request.teamId())
                .orElseThrow(() -> new IllegalArgumentException("Referenced team not found with ID: " + request.teamId()));

        checkTeamAccess(team.getId(), actor);

        User assignee = null;
        if (request.assigneeId() != null) {
            assignee = userRepository.findById(request.assigneeId())
                    .orElseThrow(() -> new IllegalArgumentException("Referenced assignee user not found with ID: " + request.assigneeId()));
            checkAssigneeTeamMembership(team.getId(), assignee);
        }

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
                actor,
                request.dueDate()
        );

        WorkItem saved = workItemRepository.saveAndFlush(workItem);

        activityLogService.logActivity(
                saved,
                actor,
                "CREATED",
                null,
                null,
                null,
                "Work item created with tracking number " + trackingNumber
        );

        WorkItemResponse response = WorkItemResponse.from(saved);

        if (idempotencyKey != null && !idempotencyKey.isBlank() && requestHash != null) {
            idempotencyService.recordSuccess(actor.getId(), idempotencyKey, "/api/work-items", requestHash, 201, response);
        }

        return response;
    }

    @Transactional(readOnly = true)
    public WorkItemResponse getWorkItem(UUID id) {
        WorkItem workItem = workItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Work item not found with ID: " + id));

        User actor = currentUserProvider.getCurrentUser();
        if (workItem.getTeam() != null) {
            checkTeamAccess(workItem.getTeam().getId(), actor);
        } else if (!isAdmin(actor)) {
            throw new AccessDeniedException("Access denied: work item has no associated team");
        }

        return WorkItemResponse.from(workItem);
    }

    @Transactional(readOnly = true)
    public PagedResponse<WorkItemResponse> listWorkItems(
            String search,
            WorkItemStatus status,
            List<WorkItemPriority> priorities,
            WorkItemType type,
            UUID teamId,
            UUID assigneeId,
            String systemArea,
            Pageable pageable) {

        User actor = currentUserProvider.getCurrentUser();
        List<UUID> allowedTeamIds = null;

        if (!isAdmin(actor)) {
            List<TeamMembership> memberships = teamMembershipRepository.findByUserId(actor.getId());
            List<UUID> userTeamIds = memberships.stream().map(m -> m.getTeam().getId()).toList();

            if (teamId != null) {
                if (!userTeamIds.contains(teamId)) {
                    throw new AccessDeniedException("Access denied: user is not a member of team " + teamId);
                }
            } else {
                allowedTeamIds = userTeamIds;
            }
        }

        Specification<WorkItem> spec = WorkItemSpecification.filterBy(
                search, status, priorities, type, teamId, allowedTeamIds, assigneeId, systemArea
        );

        Page<WorkItem> page = workItemRepository.findAll(spec, pageable);
        return PagedResponse.from(page, WorkItemResponse::from);
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
        return listWorkItems(
                search,
                status,
                priority != null ? List.of(priority) : null,
                type,
                teamId,
                assigneeId,
                systemArea,
                pageable
        );
    }

    @Transactional(readOnly = true)
    public WorkItemMetricsResponse getWorkItemMetrics(UUID teamId) {
        User actor = currentUserProvider.getCurrentUser();
        List<UUID> allowedTeamIds = null;

        if (!isAdmin(actor)) {
            List<TeamMembership> memberships = teamMembershipRepository.findByUserId(actor.getId());
            List<UUID> userTeamIds = memberships.stream().map(m -> m.getTeam().getId()).toList();

            if (teamId != null) {
                if (!userTeamIds.contains(teamId)) {
                    throw new AccessDeniedException("Access denied: user is not a member of team " + teamId);
                }
            } else {
                allowedTeamIds = userTeamIds;
            }
        }

        long totalCount = workItemRepository.count(WorkItemSpecification.filterBy(
                null, null, (List<WorkItemPriority>) null, null, teamId, allowedTeamIds, null, null
        ));
        long openCount = workItemRepository.count(WorkItemSpecification.filterBy(
                null, WorkItemStatus.OPEN, (List<WorkItemPriority>) null, null, teamId, allowedTeamIds, null, null
        ));
        long inProgressCount = workItemRepository.count(WorkItemSpecification.filterBy(
                null, WorkItemStatus.IN_PROGRESS, (List<WorkItemPriority>) null, null, teamId, allowedTeamIds, null, null
        ));
        long reviewNeededCount = workItemRepository.count(WorkItemSpecification.filterBy(
                null, WorkItemStatus.REVIEW_NEEDED, (List<WorkItemPriority>) null, null, teamId, allowedTeamIds, null, null
        ));
        long completedCount = workItemRepository.count(WorkItemSpecification.filterBy(
                null, WorkItemStatus.COMPLETED, (List<WorkItemPriority>) null, null, teamId, allowedTeamIds, null, null
        ));
        long blockedCount = workItemRepository.count(WorkItemSpecification.filterBy(
                null, WorkItemStatus.BLOCKED, (List<WorkItemPriority>) null, null, teamId, allowedTeamIds, null, null
        ));
        long urgentCount = workItemRepository.count(WorkItemSpecification.filterBy(
                null, null, List.of(WorkItemPriority.URGENT), null, teamId, allowedTeamIds, null, null
        ));
        long blockedOrUrgentCount = workItemRepository.count(WorkItemSpecification.blockedOrUrgent(teamId, allowedTeamIds));

        return new WorkItemMetricsResponse(
                openCount,
                inProgressCount,
                reviewNeededCount,
                completedCount,
                blockedCount,
                urgentCount,
                blockedOrUrgentCount,
                totalCount
        );
    }

    @Transactional
    public WorkItemResponse updateWorkItem(UUID id, UpdateWorkItemRequest request) {
        WorkItem item = workItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Work item not found with ID: " + id));

        User actor = currentUserProvider.getCurrentUser();
        if (item.getTeam() != null) {
            checkTeamAccess(item.getTeam().getId(), actor);
        } else if (!isAdmin(actor)) {
            throw new AccessDeniedException("Access denied: work item has no associated team");
        }

        // Optimistic locking verification: enforce version precondition if supplied
        if (request.isPresent("expectedVersion") && request.getExpectedVersion() != null) {
            if (!item.getVersion().equals(request.getExpectedVersion())) {
                throw new StaleVersionConflictException(String.format(
                        "Work item version conflict: expected version %d but current version is %d",
                        request.getExpectedVersion(), item.getVersion()
                ));
            }
        }

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
                    if (item.getTeam() != null) {
                        checkAssigneeTeamMembership(item.getTeam().getId(), newAssignee);
                    }
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

        User actor = currentUserProvider.getCurrentUser();
        if (item.getTeam() != null) {
            checkTeamAccess(item.getTeam().getId(), actor);
        } else if (!isAdmin(actor)) {
            throw new AccessDeniedException("Access denied: cannot claim work item without team membership");
        }

        if (item.getAssignee() != null) {
            throw new ClaimConflictException(String.format(
                    "Work item %s is already assigned to %s",
                    item.getTrackingNumber(), item.getAssignee().getName()
            ));
        }

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

    @Transactional(readOnly = true)
    public List<CommentResponse> getComments(UUID workItemId) {
        WorkItem item = workItemRepository.findById(workItemId)
                .orElseThrow(() -> new ResourceNotFoundException("Work item not found with ID: " + workItemId));

        User actor = currentUserProvider.getCurrentUser();
        if (item.getTeam() != null) {
            checkTeamAccess(item.getTeam().getId(), actor);
        } else if (!isAdmin(actor)) {
            throw new AccessDeniedException("Access denied: cannot view comments for item without team access");
        }

        List<Comment> comments = commentRepository.findByWorkItemIdWithAuthorOrderByCreatedAtAsc(workItemId);
        return comments.stream().map(CommentResponse::from).toList();
    }

    @Transactional
    public CommentResponse addComment(UUID workItemId, CreateCommentRequest request) {
        WorkItem item = workItemRepository.findById(workItemId)
                .orElseThrow(() -> new ResourceNotFoundException("Work item not found with ID: " + workItemId));

        User actor = currentUserProvider.getCurrentUser();
        if (item.getTeam() != null) {
            checkTeamAccess(item.getTeam().getId(), actor);
        } else if (!isAdmin(actor)) {
            throw new AccessDeniedException("Access denied: cannot comment on item without team access");
        }

        Comment comment = new Comment(
                UUID.randomUUID(),
                item,
                actor,
                request.content().trim(),
                Instant.now(),
                Instant.now()
        );

        Comment saved = commentRepository.save(comment);

        activityLogService.logActivity(
                item,
                actor,
                "COMMENT_ADDED",
                "comment",
                null,
                null,
                "Added comment by " + actor.getName()
        );

        return CommentResponse.from(saved);
    }
}
