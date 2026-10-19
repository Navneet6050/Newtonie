package com.newtonite.security;

import com.newtonite.common.identity.CurrentUserProvider;
import com.newtonite.security.dto.AuthUserResponse;
import com.newtonite.security.dto.LoginRequest;
import com.newtonite.security.dto.LoginResponse;
import com.newtonite.security.dto.TeamMembershipSummary;
import com.newtonite.team.TeamMembership;
import com.newtonite.team.TeamMembershipRepository;
import com.newtonite.team.User;
import com.newtonite.team.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final TeamMembershipRepository teamMembershipRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CurrentUserProvider currentUserProvider;

    public AuthController(
            UserRepository userRepository,
            TeamMembershipRepository teamMembershipRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            CurrentUserProvider currentUserProvider) {
        this.userRepository = userRepository;
        this.teamMembershipRepository = teamMembershipRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.currentUserProvider = currentUserProvider;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        String cleanEmail = request.email().trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmail(cleanEmail);

        if (userOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        User user = userOpt.get();

        if (!user.isEnabled() || user.getPasswordHash() == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        String token = jwtService.generateToken(user);
        AuthUserResponse userResponse = toAuthUserResponse(user);

        return ResponseEntity.ok(new LoginResponse(token, "Bearer", userResponse));
    }

    @GetMapping("/me")
    public ResponseEntity<AuthUserResponse> getCurrentUser() {
        User user = currentUserProvider.getCurrentUser();
        AuthUserResponse response = toAuthUserResponse(user);
        return ResponseEntity.ok(response);
    }

    private AuthUserResponse toAuthUserResponse(User user) {
        List<TeamMembership> memberships = teamMembershipRepository.findByUserId(user.getId());
        List<TeamMembershipSummary> teamSummaries = memberships.stream()
                .map(m -> new TeamMembershipSummary(
                        m.getTeam().getId(),
                        m.getTeam().getName(),
                        m.getRole()
                ))
                .toList();

        return new AuthUserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getAvatarInitials(),
                user.getSystemRole(),
                teamSummaries
        );
    }
}
