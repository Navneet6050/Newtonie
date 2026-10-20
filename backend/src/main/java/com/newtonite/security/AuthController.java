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
import com.newtonite.security.dto.RegisterRequest;
import jakarta.servlet.http.HttpServletRequest;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final TeamMembershipRepository teamMembershipRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CurrentUserProvider currentUserProvider;
    private final RegistrationRateLimiter registrationRateLimiter;
    private final UserRegistrationService userRegistrationService;
    private final com.newtonite.team.TeamService teamService;

    public AuthController(
            UserRepository userRepository,
            TeamMembershipRepository teamMembershipRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            CurrentUserProvider currentUserProvider,
            RegistrationRateLimiter registrationRateLimiter,
            UserRegistrationService userRegistrationService,
            com.newtonite.team.TeamService teamService) {
        this.userRepository = userRepository;
        this.teamMembershipRepository = teamMembershipRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.currentUserProvider = currentUserProvider;
        this.registrationRateLimiter = registrationRateLimiter;
        this.userRegistrationService = userRegistrationService;
        this.teamService = teamService;
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

        // Safe recovery for existing registered users who have no team memberships
        if (!"ADMIN".equalsIgnoreCase(user.getSystemRole())) {
            teamService.provisionPersonalWorkspace(user);
        }

        String token = jwtService.generateToken(user);
        AuthUserResponse userResponse = toAuthUserResponse(user);

        return ResponseEntity.ok(new LoginResponse(token, "Bearer", userResponse));
    }

    @PostMapping("/register")
    public ResponseEntity<LoginResponse> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest servletRequest) {

        String clientIp = getClientIp(servletRequest);
        registrationRateLimiter.checkRateLimit(clientIp);

        String cleanEmail = request.email().trim().toLowerCase();
        if (userRepository.findByEmail(cleanEmail).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }

        String trimmedName = request.name().trim();
        if (trimmedName.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name must be at least 2 characters long");
        }

        String initials = computeInitials(trimmedName);

        // Strictly assign least-privileged "USER" system role and atomically provision personal workspace
        User newUser = userRegistrationService.registerUserWithPersonalWorkspace(
                cleanEmail,
                trimmedName,
                initials,
                request.password()
        );

        String token = jwtService.generateToken(newUser);
        AuthUserResponse userResponse = toAuthUserResponse(newUser);

        return ResponseEntity.status(HttpStatus.CREATED).body(new LoginResponse(token, "Bearer", userResponse));
    }

    @GetMapping("/me")
    public ResponseEntity<AuthUserResponse> getCurrentUser() {
        User user = currentUserProvider.getCurrentUser();
        // Safe recovery for active session users who have no team memberships
        if (!"ADMIN".equalsIgnoreCase(user.getSystemRole())) {
            teamService.provisionPersonalWorkspace(user);
        }
        AuthUserResponse response = toAuthUserResponse(user);
        return ResponseEntity.ok(response);
    }

    private String getClientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    private String computeInitials(String name) {
        if (name == null || name.isBlank()) {
            return "OP";
        }
        String[] parts = name.trim().split("\\s+");
        if (parts.length >= 2) {
            String first = parts[0].substring(0, 1).toUpperCase();
            String last = parts[parts.length - 1].substring(0, 1).toUpperCase();
            return first + last;
        }
        return name.substring(0, Math.min(2, name.length())).toUpperCase();
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
