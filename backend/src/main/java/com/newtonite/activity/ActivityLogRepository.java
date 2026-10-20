package com.newtonite.activity;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.UUID;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, UUID> {
    Page<ActivityLog> findByWorkItemIdOrderByTimestampDesc(UUID workItemId, Pageable pageable);
    Page<ActivityLog> findByWorkItemIdOrderByTimestampAsc(UUID workItemId, Pageable pageable);
    long countByWorkItemId(UUID workItemId);

    @EntityGraph(attributePaths = {"workItem", "actor"})
    @Query("SELECT a FROM ActivityLog a ORDER BY a.timestamp DESC")
    Page<ActivityLog> findAllActivities(Pageable pageable);

    @EntityGraph(attributePaths = {"workItem", "actor"})
    @Query("SELECT a FROM ActivityLog a WHERE a.workItem.team.id = :teamId ORDER BY a.timestamp DESC")
    Page<ActivityLog> findByWorkItemTeamId(@Param("teamId") UUID teamId, Pageable pageable);

    @EntityGraph(attributePaths = {"workItem", "actor"})
    @Query("SELECT a FROM ActivityLog a WHERE a.workItem.team.id IN :teamIds ORDER BY a.timestamp DESC")
    Page<ActivityLog> findByWorkItemTeamIdIn(@Param("teamIds") Collection<UUID> teamIds, Pageable pageable);
}
