package com.newtonite.team;

import com.newtonite.common.error.ResourceNotFoundException;
import com.newtonite.common.identity.CurrentUserProvider;
import com.newtonite.team.dto.TeamMemberResponse;
import com.newtonite.team.dto.TeamResponse;
import com.newtonite.workitem.WorkItemRepository;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class TeamService {

    private final TeamRepository teamRepository;
    private final TeamMembershipRepository teamMembershipRepository;
    private final WorkItemRepository workItemRepository;
    private final CurrentUserProvider currentUserProvider;

    public TeamService(
            TeamRepository teamRepository,
            TeamMembershipRepository teamMembershipRepository,
            WorkItemRepository workItemRepository,
            CurrentUserProvider currentUserProvider) {
        this.teamRepository = teamRepository;
        this.teamMembershipRepository = teamMembershipRepository;
        this.workItemRepository = workItemRepository;
        this.currentUserProvider = currentUserProvider;
    }

    private boolean isAdmin(User user) {
        return user != null && "ADMIN".equalsIgnoreCase(user.getSystemRole());
    }

    @Transactional
    public List<TeamResponse> getTeamsForCurrentUser() {
        User actor = currentUserProvider.getCurrentUser();
        List<Team> teams;

        if (isAdmin(actor)) {
            teams = teamRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
        } else {
            List<TeamMembership> memberships = teamMembershipRepository.findByUserId(actor.getId());
            if (memberships.isEmpty()) {
                provisionPersonalWorkspace(actor);
                memberships = teamMembershipRepository.findByUserId(actor.getId());
            }
            teams = memberships.stream()
                    .map(TeamMembership::getTeam)
                    .distinct()
                    .sorted(Comparator.comparing(Team::getName))
                    .toList();
        }

        List<TeamResponse> result = new ArrayList<>();
        for (Team team : teams) {
            List<TeamMembership> teamMembers = teamMembershipRepository.findByTeamId(team.getId());
            List<TeamMemberResponse> memberResponses = teamMembers.stream()
                    .map(TeamMemberResponse::from)
                    .toList();
            long workItemCount = workItemRepository.countByTeamId(team.getId());
            result.add(TeamResponse.of(team, memberResponses, workItemCount));
        }

        return result;
    }

    @Transactional
    public TeamMembership provisionPersonalWorkspace(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User cannot be null when provisioning workspace");
        }

        List<TeamMembership> existing = teamMembershipRepository.findByUserId(user.getId());
        if (!existing.isEmpty()) {
            return existing.get(0);
        }

        String uniqueName = generateUniqueWorkspaceName(user.getName());
        Team team = new Team(
                UUID.randomUUID(),
                uniqueName,
                "Personal workspace for " + (user.getName() != null ? user.getName().trim() : "Operator")
        );
        Team savedTeam = teamRepository.save(team);

        TeamMembership membership = new TeamMembership(
                UUID.randomUUID(),
                savedTeam,
                user,
                "TEAM_LEAD"
        );
        return teamMembershipRepository.save(membership);
    }

    @Transactional
    public TeamResponse provisionPersonalWorkspaceForCurrentUser() {
        User actor = currentUserProvider.getCurrentUser();
        TeamMembership membership = provisionPersonalWorkspace(actor);
        return getTeamById(membership.getTeam().getId());
    }

    private String generateUniqueWorkspaceName(String userName) {
        String cleanName = (userName != null && !userName.isBlank()) ? userName.trim() : "Personal";
        if (cleanName.length() > 75) {
            cleanName = cleanName.substring(0, 75).trim();
        }

        String baseName = cleanName + "'s Workspace";
        String candidate = baseName;
        int counter = 1;

        while (teamRepository.findByName(candidate).isPresent()) {
            String suffix = " (" + counter + ")";
            int maxBaseLen = 100 - suffix.length();
            if (baseName.length() > maxBaseLen) {
                candidate = baseName.substring(0, maxBaseLen) + suffix;
            } else {
                candidate = baseName + suffix;
            }
            counter++;
        }
        return candidate;
    }

    @Transactional(readOnly = true)
    public TeamResponse getTeamById(UUID teamId) {
        User actor = currentUserProvider.getCurrentUser();
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found with ID: " + teamId));

        if (!isAdmin(actor)) {
            if (!teamMembershipRepository.existsByTeamIdAndUserId(teamId, actor.getId())) {
                throw new AccessDeniedException("Access denied: user is not an authorized member of team " + teamId);
            }
        }

        List<TeamMembership> teamMembers = teamMembershipRepository.findByTeamId(team.getId());
        List<TeamMemberResponse> memberResponses = teamMembers.stream()
                .map(TeamMemberResponse::from)
                .toList();
        long workItemCount = workItemRepository.countByTeamId(team.getId());

        return TeamResponse.of(team, memberResponses, workItemCount);
    }
}
