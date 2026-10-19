package com.newtonite.workitem;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class WorkItemSpecification {

    public static Specification<WorkItem> filterBy(
            String search,
            WorkItemStatus status,
            WorkItemPriority priority,
            WorkItemType type,
            UUID teamId,
            List<UUID> allowedTeamIds,
            UUID assigneeId,
            String systemArea) {

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

            if (priority != null) {
                predicates.add(cb.equal(root.get("priority"), priority));
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

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
