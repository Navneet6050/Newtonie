package com.newtonite.activity;

import com.newtonite.activity.dto.ActivityLogResponse;
import com.newtonite.workitem.dto.PagedResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/activity")
public class ActivityController {

    private final ActivityLogService activityLogService;

    public ActivityController(ActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    @GetMapping
    public ResponseEntity<PagedResponse<ActivityLogResponse>> getActivityFeed(
            @RequestParam(required = false) UUID teamId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        int boundedPage = Math.max(0, page);
        int boundedSize = Math.clamp(size, 1, 100);
        Pageable pageable = PageRequest.of(boundedPage, boundedSize);

        PagedResponse<ActivityLogResponse> feed = activityLogService.getActivityFeed(teamId, pageable);
        return ResponseEntity.ok(feed);
    }
}
