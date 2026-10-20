package com.newtonite.security;

import com.newtonite.team.Team;
import com.newtonite.team.TeamMembership;
import com.newtonite.team.TeamMembershipRepository;
import com.newtonite.team.TeamRepository;
import com.newtonite.team.User;
import com.newtonite.team.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

/**
 * Controlled administrator bootstrap runner for assignment evaluation.
 * 
 * Governed strictly by explicit server-side environment variables:
 * - SECURITY_ADMIN_BOOTSTRAP_ENABLED (default: false)
 * - SECURITY_ADMIN_BOOTSTRAP_EMAIL (default: admin@newtonie.com)
 * - SECURITY_ADMIN_BOOTSTRAP_PASSWORD
 * 
 * Idempotent: Does not recreate accounts or alter existing passwords on subsequent deployments.
 * Secrets are never logged.
 */
@Component
public class AdminBootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapRunner.class);
    private static final UUID PRIMARY_WORKSPACE_TEAM_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TeamMembershipRepository teamMembershipRepository;
    private final PasswordEncoder passwordEncoder;

    private final boolean enabled;
    private final String adminEmail;
    private final String adminPassword;

    public AdminBootstrapRunner(
            UserRepository userRepository,
            TeamRepository teamRepository,
            TeamMembershipRepository teamMembershipRepository,
            PasswordEncoder passwordEncoder,
            @Value("${security.admin-bootstrap.enabled:false}") boolean enabled,
            @Value("${security.admin-bootstrap.email:admin@newtonie.com}") String adminEmail,
            @Value("${security.admin-bootstrap.password:}") String adminPassword) {
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.teamMembershipRepository = teamMembershipRepository;
        this.passwordEncoder = passwordEncoder;
        this.enabled = enabled;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.debug("Admin demo bootstrap is disabled.");
            return;
        }

        if (adminPassword == null || adminPassword.isBlank()) {
            log.warn("Admin demo bootstrap is enabled, but no password was configured via SECURITY_ADMIN_BOOTSTRAP_PASSWORD. Skipping provisioning.");
            return;
        }

        String cleanEmail = adminEmail.trim().toLowerCase();
        Optional<User> existingUserOpt = userRepository.findByEmail(cleanEmail);

        if (existingUserOpt.isPresent()) {
            User existing = existingUserOpt.get();
            log.info("Admin demo account ({}) already exists with system role {}. Bootstrap skipped to maintain idempotency.",
                    cleanEmail, existing.getSystemRole());
            return;
        }

        // Provision new administrator user
        User adminUser = new User(
                UUID.randomUUID(),
                cleanEmail,
                "Newtonite Admin",
                "AD",
                "ADMIN",
                passwordEncoder.encode(adminPassword),
                true
        );
        userRepository.save(adminUser);

        // Associate with primary workspace (Acme Studio) as TEAM_LEAD if team exists
        Optional<Team> primaryTeamOpt = teamRepository.findById(PRIMARY_WORKSPACE_TEAM_ID);
        if (primaryTeamOpt.isPresent()) {
            TeamMembership membership = new TeamMembership(
                    UUID.randomUUID(),
                    primaryTeamOpt.get(),
                    adminUser,
                    "TEAM_LEAD"
            );
            teamMembershipRepository.save(membership);
        }

        log.info("Admin demo account successfully provisioned for evaluation ({}) with system role ADMIN.", cleanEmail);
    }
}
