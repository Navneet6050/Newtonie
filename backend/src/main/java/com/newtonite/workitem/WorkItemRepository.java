package com.newtonite.workitem;

import com.newtonite.team.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkItemRepository extends JpaRepository<WorkItem, UUID>, JpaSpecificationExecutor<WorkItem> {

    Optional<WorkItem> findByTrackingNumber(String trackingNumber);

    boolean existsByTrackingNumber(String trackingNumber);

    long countByTeamId(UUID teamId);

    @Query(value = "SELECT nextval('work_item_seq')", nativeQuery = true)
    Long getNextTrackingSequenceValue();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE WorkItem w SET w.assignee = :user, w.updatedAt = :now, w.version = w.version + 1 " +
           "WHERE w.id = :id AND w.assignee IS NULL")
    int claimWorkItemAtomically(@Param("id") UUID id, @Param("user") User user, @Param("now") Instant now);
}
