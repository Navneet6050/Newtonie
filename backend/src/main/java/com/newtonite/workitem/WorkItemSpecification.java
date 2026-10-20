package com.newtonite.workitem;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class WorkItemSpecification {

    public static Specification<WorkItem> filterBy(
            String search,
            WorkItemStatus status,
            List<WorkItemPriority> priorities,
            WorkItemType type,
            UUID teamId,
            List<UUID> allowedTeamIds,
            UUID assigneeId,
            String systemArea,
            Instant dueDateFrom,
            Instant dueDateTo) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate titleMatch = cb.like(cb.lower(root.get("title")), pattern);
                Predicate trackingMatch = cb.like(cb.lower(root.get("trackingNumber")), pattern);
                Predicate systemAreaMatch = cb.like(cb.lower(root.get("systemArea")), pattern);
                predicates.add(cb.or(titleMatch, trackingMatch, systemAreaMatch));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (priorities != null && !priorities.isEmpty()) {
                if (priorities.size() == 1) {
                    predicates.add(cb.equal(root.get("priority"), priorities.get(0)));
                } else {
                    predicates.add(root.get("priority").in(priorities));
                }
            }

            if (type != null) {
                predicates.add(cb.equal(root.get("type"), type));
            }

            if (teamId != null) {
                predicates.add(cb.equal(root.get("team").get("id"), teamId));
            } else if (allowedTeamIds != null) {
                if (allowedTeamIds.isEmpty()) {
                    predicates.add(cb.disjunction());
                } else {
                    predicates.add(root.get("team").get("id").in(allowedTeamIds));
                }
            }

            if (assigneeId != null) {
                predicates.add(cb.equal(root.get("assignee").get("id"), assigneeId));
            }

            if (systemArea != null && !systemArea.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("systemArea")), systemArea.trim().toLowerCase()));
            }

            if (dueDateFrom != null || dueDateTo != null) {
                predicates.add(cb.isNotNull(root.get("dueDate")));
            }
            if (dueDateFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("dueDate"), dueDateFrom));
            }
            if (dueDateTo != null) {
                predicates.add(cb.lessThan(root.get("dueDate"), dueDateTo));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    public static Specification<WorkItem> filterBy(
            String search,
            WorkItemStatus status,
            List<WorkItemPriority> priorities,
            WorkItemType type,
            UUID teamId,
            List<UUID> allowedTeamIds,
            UUID assigneeId,
            String systemArea) {
        return filterBy(
                search,
                status,
                priorities,
                type,
                teamId,
                allowedTeamIds,
                assigneeId,
                systemArea,
                null,
                null
        );
    }

    public static Specification<WorkItem> filterBy(
            String search,
            WorkItemStatus status,
            WorkItemPriority priority,
            WorkItemType type,
            UUID teamId,
            List<UUID> allowedTeamIds,
            UUID assigneeId,
            String systemArea) {
        return filterBy(
                search,
                status,
                priority != null ? List.of(priority) : null,
                type,
                teamId,
                allowedTeamIds,
                assigneeId,
                systemArea,
                null,
                null
        );
    }

    /**
     * Specification that counts distinct items that are either BLOCKED or URGENT (preventing double counting)
     */
    public static Specification<WorkItem> blockedOrUrgent(UUID teamId, List<UUID> allowedTeamIds) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            Predicate isBlocked = cb.equal(root.get("status"), WorkItemStatus.BLOCKED);
            Predicate isUrgent = cb.equal(root.get("priority"), WorkItemPriority.URGENT);
            predicates.add(cb.or(isBlocked, isUrgent));

            if (teamId != null) {
                predicates.add(cb.equal(root.get("team").get("id"), teamId));
            } else if (allowedTeamIds != null) {
                if (allowedTeamIds.isEmpty()) {
                    predicates.add(cb.disjunction());
                } else {
                    predicates.add(root.get("team").get("id").in(allowedTeamIds));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
