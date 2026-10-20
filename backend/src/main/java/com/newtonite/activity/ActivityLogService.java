package com.newtonite.activity;

import com.newtonite.activity.dto.ActivityLogResponse;
import com.newtonite.common.error.ResourceNotFoundException;
import com.newtonite.common.identity.CurrentUserProvider;
import com.newtonite.team.TeamMembership;
import com.newtonite.team.TeamMembershipRepository;
import com.newtonite.team.TeamRepository;
import com.newtonite.team.User;
import com.newtonite.workitem.WorkItem;
import com.newtonite.workitem.dto.PagedResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;
    private final TeamRepository teamRepository;
    private final TeamMembershipRepository teamMembershipRepository;
    private final CurrentUserProvider currentUserProvider;

    public ActivityLogService(
            ActivityLogRepository activityLogRepository,
            TeamRepository teamRepository,
            TeamMembershipRepository teamMembershipRepository,
            CurrentUserProvider currentUserProvider) {
        this.activityLogRepository = activityLogRepository;
        this.teamRepository = teamRepository;
        this.teamMembershipRepository = teamMembershipRepository;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional
    public ActivityLog logActivity(WorkItem workItem, User actor, String actionType,
                                  String fieldName, String fromValue, String toValue, String metadata) {
        ActivityLog log = new ActivityLog(
                UUID.randomUUID(),
                workItem,
                actor,
                actionType,
                fieldName,
                fromValue,
                toValue,
                metadata
        );
        return activityLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ActivityLogResponse> getActivityHistory(UUID workItemId, Pageable pageable) {
        Page<ActivityLog> page = activityLogRepository.findByWorkItemIdOrderByTimestampDesc(workItemId, pageable);
        return PagedResponse.from(page, ActivityLogResponse::from);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ActivityLogResponse> getActivityFeed(UUID teamId, Pageable pageable) {
        User actor = currentUserProvider.getCurrentUser();
        boolean isAdmin = actor != null && "ADMIN".equalsIgnoreCase(actor.getSystemRole());

        Page<ActivityLog> page;

        if (isAdmin) {
            if (teamId != null) {
                if (!teamRepository.existsById(teamId)) {
                    throw new ResourceNotFoundException("Team not found with ID: " + teamId);
                }
                page = activityLogRepository.findByWorkItemTeamId(teamId, pageable);
            } else {
                page = activityLogRepository.findAllActivities(pageable);
            }
        } else {
            List<TeamMembership> memberships = teamMembershipRepository.findByUserId(actor.getId());
            List<UUID> userTeamIds = memberships.stream()
                    .map(m -> m.getTeam().getId())
                    .toList();

            if (teamId != null) {
                if (!userTeamIds.contains(teamId)) {
                    throw new AccessDeniedException("Access denied: user is not an authorized member of team " + teamId);
                }
                page = activityLogRepository.findByWorkItemTeamId(teamId, pageable);
            } else {
                if (userTeamIds.isEmpty()) {
                    return PagedResponse.from(Page.empty(pageable), ActivityLogResponse::from);
                }
                page = activityLogRepository.findByWorkItemTeamIdIn(userTeamIds, pageable);
            }
        }

        return PagedResponse.from(page, ActivityLogResponse::from);
    }
}
