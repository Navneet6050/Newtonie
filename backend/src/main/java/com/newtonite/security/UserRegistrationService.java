package com.newtonite.security;

import com.newtonite.team.TeamMembership;
import com.newtonite.team.TeamService;
import com.newtonite.team.User;
import com.newtonite.team.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Transactional user registration service.
 * Ensures account creation and personal workspace onboarding are performed atomically.
 */
@Service
public class UserRegistrationService {

    private final UserRepository userRepository;
    private final TeamService teamService;
    private final PasswordEncoder passwordEncoder;

    public UserRegistrationService(
            UserRepository userRepository,
            TeamService teamService,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.teamService = teamService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public User registerUserWithPersonalWorkspace(
            String cleanEmail,
            String trimmedName,
            String initials,
            String rawPassword) {

        String passwordHash = passwordEncoder.encode(rawPassword);

        User newUser = new User(
                UUID.randomUUID(),
                cleanEmail,
                trimmedName,
                initials,
                "USER",
                passwordHash,
                true
        );

        User savedUser = userRepository.save(newUser);
        teamService.provisionPersonalWorkspace(savedUser);

        return savedUser;
    }
}
