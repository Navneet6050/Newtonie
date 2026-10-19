package com.newtonite.activity;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, UUID> {
    Page<ActivityLog> findByWorkItemIdOrderByTimestampDesc(UUID workItemId, Pageable pageable);
    Page<ActivityLog> findByWorkItemIdOrderByTimestampAsc(UUID workItemId, Pageable pageable);
    long countByWorkItemId(UUID workItemId);
}
