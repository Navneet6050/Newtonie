package com.newtonite.activity;

import com.newtonite.activity.dto.ActivityLogResponse;
import com.newtonite.team.User;
import com.newtonite.workitem.WorkItem;
import com.newtonite.workitem.dto.PagedResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;

    public ActivityLogService(ActivityLogRepository activityLogRepository) {
        this.activityLogRepository = activityLogRepository;
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
}
