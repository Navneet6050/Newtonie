package com.newtonite.team;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TeamMembershipRepository extends JpaRepository<TeamMembership, UUID> {

    boolean existsByTeamIdAndUserId(UUID teamId, UUID userId);

    @EntityGraph(attributePaths = {"team", "user"})
    List<TeamMembership> findByUserId(UUID userId);

    @EntityGraph(attributePaths = {"team", "user"})
    List<TeamMembership> findByTeamId(UUID teamId);
}
