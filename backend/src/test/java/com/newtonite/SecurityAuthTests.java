package com.newtonite;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newtonite.security.JwtService;
import com.newtonite.security.dto.LoginRequest;
import com.newtonite.support.TestTokenProvider;
import com.newtonite.team.User;
import com.newtonite.workitem.WorkItemPriority;
import com.newtonite.workitem.WorkItemType;
import com.newtonite.workitem.dto.CreateWorkItemRequest;
import com.newtonite.workitem.dto.UpdateWorkItemRequest;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class SecurityAuthTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestTokenProvider tokenProvider;

    @Autowired
    private JwtService jwtService;

    private static final UUID TEAM_ACME_STUDIO_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID TEAM_ACME_PLATFORM_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private static final UUID USER_ALEX_MORGAN_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_SARAH_CHEN_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID USER_LIAM_VANCE_ID = UUID.fromString("55555555-5555-5555-5555-555555555555");

    private static final UUID PLATFORM_ITEM_ID = UUID.fromString("d0000007-0000-0000-0000-000000000007");

    @Test
    @DisplayName("1. Login succeeds with valid credentials and returns JWT access token")
    void testLoginSuccess() throws Exception {
        LoginRequest loginRequest = new LoginRequest("alex.morgan@acme.internal", "NewtoniteDev2026!");

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.type").value("Bearer"))
                .andExpect(jsonPath("$.user.id").value(USER_ALEX_MORGAN_ID.toString()))
                .andExpect(jsonPath("$.user.email").value("alex.morgan@acme.internal"))
                .andExpect(jsonPath("$.user.systemRole").value("ADMIN"))
                .andExpect(jsonPath("$.user.teams").isArray())
                .andReturn();

        String token = objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
        assertThat(jwtService.validateToken(token)).isTrue();
    }

    @Test
    @DisplayName("2. Invalid credentials return 401 without leaking user existence")
    void testInvalidCredentialsReturn401() throws Exception {
        // Case A: Non-existent email
        LoginRequest nonExistent = new LoginRequest("ghost.user@acme.internal", "NewtoniteDev2026!");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(nonExistent)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));

        // Case B: Existing user with wrong password
        LoginRequest wrongPassword = new LoginRequest("alex.morgan@acme.internal", "WrongPassword123!");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(wrongPassword)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    @DisplayName("3. Missing credentials return 401 on protected endpoints")
    void testMissingCredentialsReturn401() throws Exception {
        mockMvc.perform(get("/api/work-items"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("4. Invalid or expired credentials are rejected with 401")
    void testInvalidOrExpiredTokens() throws Exception {
        // Garbage token
        mockMvc.perform(get("/api/work-items")
                        .header("Authorization", "Bearer invalid-garbage-token-here"))
                .andExpect(status().isUnauthorized());

        // Expired token
        String expiredSecret = "newtonite-insecure-development-jwt-secret-key-32bytes-long-for-hmac-sha256";
        String expiredToken = Jwts.builder()
                .subject(USER_ALEX_MORGAN_ID.toString())
                .issuedAt(new Date(System.currentTimeMillis() - 100000))
                .expiration(new Date(System.currentTimeMillis() - 1000))
                .signWith(Keys.hmacShaKeyFor(expiredSecret.getBytes(StandardCharsets.UTF_8)))
                .compact();

        mockMvc.perform(get("/api/work-items")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("5. /api/auth/me resolves identity from the security principal, ignoring spoofed headers")
    void testMeResolvesAuthenticatedPrincipal() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();

        // Attempting to spoof Alex Morgan's identity via headers or parameters
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", sarahToken)
                        .header("X-User-Id", USER_ALEX_MORGAN_ID.toString())
                        .param("userId", USER_ALEX_MORGAN_ID.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(USER_SARAH_CHEN_ID.toString()))
                .andExpect(jsonPath("$.name").value("Sarah Chen"))
                .andExpect(jsonPath("$.email").value("sarah.chen@acme.internal"))
                .andExpect(jsonPath("$.systemRole").value("USER"));
    }

    @Test
    @DisplayName("6. A user from Team A cannot read Team B's work item")
    void testCrossTeamItemReadForbidden() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();

        // Sarah Chen belongs only to Acme Studio, trying to read Acme Platform's seeded work item
        mockMvc.perform(get("/api/work-items/" + PLATFORM_ITEM_ID)
                        .header("Authorization", sarahToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.message").value(containsString("Access denied")));
    }

    @Test
    @DisplayName("7. A user from Team A cannot update, claim, or read activity for Team B's item")
    void testCrossTeamItemMutationForbidden() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();

        // Sarah attempting to update Acme Platform item
        UpdateWorkItemRequest updateReq = new UpdateWorkItemRequest();
        updateReq.setTitle("Unauthorized update by Team A member");

        mockMvc.perform(patch("/api/work-items/" + PLATFORM_ITEM_ID)
                        .header("Authorization", sarahToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isForbidden());

        // Sarah attempting to claim Acme Platform item
        mockMvc.perform(post("/api/work-items/" + PLATFORM_ITEM_ID + "/claim")
                        .header("Authorization", sarahToken))
                .andExpect(status().isForbidden());

        // Sarah attempting to view activity logs for Acme Platform item
        mockMvc.perform(get("/api/work-items/" + PLATFORM_ITEM_ID + "/activity")
                        .header("Authorization", sarahToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("8. A user cannot create a work item for a team they do not belong to")
    void testCannotCreateItemForUnauthorizedTeam() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();

        // Sarah Chen (Acme Studio) trying to create an item in Acme Platform
        CreateWorkItemRequest request = new CreateWorkItemRequest(
                "Unauthorized Cross-Team Creation",
                "This should fail with 403 Forbidden",
                WorkItemType.TASK,
                WorkItemPriority.HIGH,
                "Infrastructure",
                TEAM_ACME_PLATFORM_ID,
                null,
                null
        );

        mockMvc.perform(post("/api/work-items")
                        .header("Authorization", sarahToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("9. A user cannot assign a work item to a non-member of the item's team")
    void testCannotAssignToNonTeamMember() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();

        // Sarah creates item in Acme Studio, but attempts to assign to Liam Vance (who belongs only to Acme Platform)
        CreateWorkItemRequest invalidCreate = new CreateWorkItemRequest(
                "Cross Team Assignee Test",
                "Assignee is not in Acme Studio",
                WorkItemType.BUG,
                WorkItemPriority.MEDIUM,
                "Gateway",
                TEAM_ACME_STUDIO_ID,
                USER_LIAM_VANCE_ID,
                null
        );

        mockMvc.perform(post("/api/work-items")
                        .header("Authorization", sarahToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidCreate)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value(containsString("not a member of the work item's team")));
    }

    @Test
    @DisplayName("10. Authorized team members and admins retain legitimate work-item access")
    void testAuthorizedTeamMembersRetainAccess() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();
        String liamToken = tokenProvider.liamVanceToken();
        String adminToken = tokenProvider.alexMorganToken();

        // Liam can read his own team's item
        mockMvc.perform(get("/api/work-items/" + PLATFORM_ITEM_ID)
                        .header("Authorization", liamToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(PLATFORM_ITEM_ID.toString()))
                .andExpect(jsonPath("$.trackingNumber").value("NEW-1049"));

        // Admin Alex Morgan can read any team's item
        mockMvc.perform(get("/api/work-items/" + PLATFORM_ITEM_ID)
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(PLATFORM_ITEM_ID.toString()));
    }

    @Test
    @DisplayName("11. Team filtering rejects unauthorized teams and scopes list results")
    void testTeamFilterScoping() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();

        // Sarah specifies teamId for Acme Platform (which she does not belong to) -> 403 Forbidden
        mockMvc.perform(get("/api/work-items")
                        .header("Authorization", sarahToken)
                        .param("teamId", TEAM_ACME_PLATFORM_ID.toString()))
                .andExpect(status().isForbidden());

        // Sarah lists work items without filter -> only sees items from her team (Acme Studio)
        MvcResult listResult = mockMvc.perform(get("/api/work-items")
                        .header("Authorization", sarahToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode items = objectMapper.readTree(listResult.getResponse().getContentAsString()).get("content");
        assertThat(items.isArray()).isTrue();
        for (JsonNode item : items) {
            assertThat(item.get("team").get("id").asText()).isEqualTo(TEAM_ACME_STUDIO_ID.toString());
        }
    }

    @Test
    @DisplayName("12. Idempotency keys are strictly scoped to the authenticated user")
    void testIdempotencyUserScoping() throws Exception {
        String sharedKey = "scoped-key-" + UUID.randomUUID();

        // 1. User Sarah Chen (Acme Studio) creates an item using sharedKey
        CreateWorkItemRequest sarahItem = new CreateWorkItemRequest(
                "Sarah Studio Scoped Item",
                "Studio operation",
                WorkItemType.TASK,
                WorkItemPriority.HIGH,
                "Studio Area",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );

        MvcResult sarahResult = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", tokenProvider.sarahChenToken())
                        .header("Idempotency-Key", sharedKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sarahItem)))
                .andExpect(status().isCreated())
                .andReturn();

        UUID sarahCreatedId = UUID.fromString(objectMapper.readTree(sarahResult.getResponse().getContentAsString()).get("id").asText());

        // 2. User Liam Vance (Acme Platform) uses the EXACT same Idempotency-Key with his own payload
        CreateWorkItemRequest liamItem = new CreateWorkItemRequest(
                "Liam Platform Scoped Item",
                "Platform operation",
                WorkItemType.TASK,
                WorkItemPriority.URGENT,
                "Platform Area",
                TEAM_ACME_PLATFORM_ID,
                null,
                null
        );

        MvcResult liamResult = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", tokenProvider.liamVanceToken())
                        .header("Idempotency-Key", sharedKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(liamItem)))
                .andExpect(status().isCreated())
                .andReturn();

        UUID liamCreatedId = UUID.fromString(objectMapper.readTree(liamResult.getResponse().getContentAsString()).get("id").asText());

        // Ensure Liam was NOT served Sarah's cached response!
        assertThat(liamCreatedId).isNotEqualTo(sarahCreatedId);

        // 3. Sarah retrying with sharedKey receives HER cached response
        MvcResult sarahRetry = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", tokenProvider.sarahChenToken())
                        .header("Idempotency-Key", sharedKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sarahItem)))
                .andExpect(status().isCreated())
                .andReturn();

        UUID retryId = UUID.fromString(objectMapper.readTree(sarahRetry.getResponse().getContentAsString()).get("id").asText());
        assertThat(retryId).isEqualTo(sarahCreatedId);
    }
}
