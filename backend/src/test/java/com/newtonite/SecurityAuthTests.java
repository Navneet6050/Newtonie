package com.newtonite;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newtonite.security.JwtService;
import com.newtonite.security.dto.LoginRequest;
import com.newtonite.support.TestTokenProvider;
import com.newtonite.team.User;
import com.newtonite.workitem.WorkItemPriority;
import com.newtonite.workitem.WorkItemStatus;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.newtonite.security.AdminBootstrapRunner;
import com.newtonite.security.RegistrationRateLimiter;
import com.newtonite.security.UserRegistrationService;
import com.newtonite.security.dto.RegisterRequest;
import com.newtonite.team.TeamMembershipRepository;
import com.newtonite.team.TeamRepository;
import com.newtonite.team.TeamService;
import com.newtonite.team.UserRepository;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;

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

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private TeamMembershipRepository teamMembershipRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RegistrationRateLimiter registrationRateLimiter;

    @SpyBean
    private TeamService teamService;

    @Autowired
    private UserRegistrationService userRegistrationService;

    @Autowired
    private PlatformTransactionManager transactionManager;

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

    @Test
    @DisplayName("13. Work item metrics endpoint enforces team scoping and authorization")
    void testMetricsTeamAuthorization() throws Exception {
        // A. Unauthenticated call is rejected with 401
        mockMvc.perform(get("/api/work-items/metrics"))
                .andExpect(status().isUnauthorized());

        String sarahToken = tokenProvider.sarahChenToken();
        String adminToken = tokenProvider.alexMorganToken();

        // B. Sarah (Acme Studio) requesting Acme Platform metrics is rejected with 403
        mockMvc.perform(get("/api/work-items/metrics")
                        .header("Authorization", sarahToken)
                        .param("teamId", TEAM_ACME_PLATFORM_ID.toString()))
                .andExpect(status().isForbidden());

        // C. Sarah gets her team's metrics
        MvcResult sarahMetricsResult = mockMvc.perform(get("/api/work-items/metrics")
                        .header("Authorization", sarahToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openCount").isNumber())
                .andExpect(jsonPath("$.inProgressCount").isNumber())
                .andExpect(jsonPath("$.blockedCount").isNumber())
                .andExpect(jsonPath("$.urgentCount").isNumber())
                .andExpect(jsonPath("$.blockedOrUrgentCount").isNumber())
                .andExpect(jsonPath("$.totalCount").isNumber())
                .andReturn();

        JsonNode sarahMetrics = objectMapper.readTree(sarahMetricsResult.getResponse().getContentAsString());
        assertThat(sarahMetrics.get("totalCount").asLong()).isGreaterThanOrEqualTo(0);
        long blocked = sarahMetrics.get("blockedCount").asLong();
        long urgent = sarahMetrics.get("urgentCount").asLong();
        long distinctBlockedOrUrgent = sarahMetrics.get("blockedOrUrgentCount").asLong();
        assertThat(distinctBlockedOrUrgent).isLessThanOrEqualTo(blocked + urgent);

        // D. Admin Alex can view metrics for Acme Platform
        mockMvc.perform(get("/api/work-items/metrics")
                        .header("Authorization", adminToken)
                        .param("teamId", TEAM_ACME_PLATFORM_ID.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").isNumber())
                .andExpect(jsonPath("$.blockedOrUrgentCount").isNumber());
    }

    @Test
    @DisplayName("14. Deterministic distinct blocked-or-urgent metrics calculation and team isolation")
    void testDeterministicBlockedOrUrgentMetrics() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();
        String liamToken = tokenProvider.liamVanceToken();

        // 1. Capture baseline metrics for Sarah (Acme Studio) and Liam (Acme Platform)
        MvcResult sarahBaseResult = mockMvc.perform(get("/api/work-items/metrics")
                        .header("Authorization", sarahToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode sarahBase = objectMapper.readTree(sarahBaseResult.getResponse().getContentAsString());
        long sarahBaseBlocked = sarahBase.get("blockedCount").asLong();
        long sarahBaseUrgent = sarahBase.get("urgentCount").asLong();
        long sarahBaseDistinct = sarahBase.get("blockedOrUrgentCount").asLong();
        long sarahBaseTotal = sarahBase.get("totalCount").asLong();

        MvcResult liamBaseResult = mockMvc.perform(get("/api/work-items/metrics")
                        .header("Authorization", liamToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode liamBase = objectMapper.readTree(liamBaseResult.getResponse().getContentAsString());
        long liamBaseDistinct = liamBase.get("blockedOrUrgentCount").asLong();
        long liamBaseTotal = liamBase.get("totalCount").asLong();

        // 2. Sarah creates 4 deterministic items for Acme Studio:
        // Item 1: BLOCKED + URGENT (both categories)
        CreateWorkItemRequest item1 = new CreateWorkItemRequest(
                "Metric Test 1: Blocked and Urgent",
                "Both categories",
                WorkItemType.TASK,
                WorkItemPriority.URGENT,
                "Metrics",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );
        MvcResult r1 = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", sarahToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(item1)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID id1 = UUID.fromString(objectMapper.readTree(r1.getResponse().getContentAsString()).get("id").asText());
        UpdateWorkItemRequest block1 = new UpdateWorkItemRequest();
        block1.setStatus(WorkItemStatus.BLOCKED);
        block1.setExpectedVersion(0L);
        mockMvc.perform(patch("/api/work-items/" + id1)
                        .header("Authorization", sarahToken)
                        .header("If-Match", "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(block1)))
                .andExpect(status().isOk());

        // Item 2: BLOCKED only (status BLOCKED, priority MEDIUM)
        CreateWorkItemRequest item2 = new CreateWorkItemRequest(
                "Metric Test 2: Blocked Only",
                "Blocked only",
                WorkItemType.TASK,
                WorkItemPriority.MEDIUM,
                "Metrics",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );
        MvcResult r2 = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", sarahToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(item2)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID id2 = UUID.fromString(objectMapper.readTree(r2.getResponse().getContentAsString()).get("id").asText());
        UpdateWorkItemRequest block2 = new UpdateWorkItemRequest();
        block2.setStatus(WorkItemStatus.BLOCKED);
        block2.setExpectedVersion(0L);
        mockMvc.perform(patch("/api/work-items/" + id2)
                        .header("Authorization", sarahToken)
                        .header("If-Match", "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(block2)))
                .andExpect(status().isOk());

        // Item 3: URGENT only (status OPEN, priority URGENT)
        CreateWorkItemRequest item3 = new CreateWorkItemRequest(
                "Metric Test 3: Urgent Only",
                "Urgent only",
                WorkItemType.TASK,
                WorkItemPriority.URGENT,
                "Metrics",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );
        mockMvc.perform(post("/api/work-items")
                        .header("Authorization", sarahToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(item3)))
                .andExpect(status().isCreated());

        // Item 4: Ordinary item (status OPEN, priority LOW)
        CreateWorkItemRequest item4 = new CreateWorkItemRequest(
                "Metric Test 4: Ordinary",
                "Neither blocked nor urgent",
                WorkItemType.TASK,
                WorkItemPriority.LOW,
                "Metrics",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );
        mockMvc.perform(post("/api/work-items")
                        .header("Authorization", sarahToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(item4)))
                .andExpect(status().isCreated());

        // 3. Re-query Sarah's metrics and assert exact deterministic deltas
        MvcResult sarahPostResult = mockMvc.perform(get("/api/work-items/metrics")
                        .header("Authorization", sarahToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode sarahPost = objectMapper.readTree(sarahPostResult.getResponse().getContentAsString());

        long newTotal = sarahPost.get("totalCount").asLong();
        long newBlocked = sarahPost.get("blockedCount").asLong();
        long newUrgent = sarahPost.get("urgentCount").asLong();
        long newDistinct = sarahPost.get("blockedOrUrgentCount").asLong();

        assertThat(newTotal).isEqualTo(sarahBaseTotal + 4);
        assertThat(newBlocked).isEqualTo(sarahBaseBlocked + 2); // items 1 and 2
        assertThat(newUrgent).isEqualTo(sarahBaseUrgent + 2);   // items 1 and 3

        // CRITICAL CHECK: Raw sum adds 4, but distinct count only adds 3!
        // Because item 1 is in both categories and item 4 is in neither!
        assertThat(newDistinct).isEqualTo(sarahBaseDistinct + 3);

        // 4. Verify team scoping: Liam's team metrics must be completely unaffected
        MvcResult liamPostResult = mockMvc.perform(get("/api/work-items/metrics")
                        .header("Authorization", liamToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode liamPost = objectMapper.readTree(liamPostResult.getResponse().getContentAsString());
        assertThat(liamPost.get("totalCount").asLong()).isEqualTo(liamBaseTotal);
        assertThat(liamPost.get("blockedOrUrgentCount").asLong()).isEqualTo(liamBaseDistinct);
    }

    @Test
    @DisplayName("15. Priority filtering contract: comma-separated and repeated params match pagination totals")
    void testPriorityFilterContractAndPagination() throws Exception {
        String adminToken = tokenProvider.alexMorganToken();

        // 1. Query individual priority totals
        MvcResult urgentRes = mockMvc.perform(get("/api/work-items")
                        .header("Authorization", adminToken)
                        .param("priority", "URGENT")
                        .param("size", "100"))
                .andExpect(status().isOk())
                .andReturn();
        long urgentTotal = objectMapper.readTree(urgentRes.getResponse().getContentAsString()).get("totalElements").asLong();

        MvcResult highRes = mockMvc.perform(get("/api/work-items")
                        .header("Authorization", adminToken)
                        .param("priority", "HIGH")
                        .param("size", "100"))
                .andExpect(status().isOk())
                .andReturn();
        long highTotal = objectMapper.readTree(highRes.getResponse().getContentAsString()).get("totalElements").asLong();

        long expectedCombinedTotal = urgentTotal + highTotal;

        // 2. Repeated query params: ?priority=URGENT&priority=HIGH
        MvcResult repeatedRes = mockMvc.perform(get("/api/work-items")
                        .header("Authorization", adminToken)
                        .param("priority", "URGENT", "HIGH"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode repeatedJson = objectMapper.readTree(repeatedRes.getResponse().getContentAsString());
        long repeatedTotal = repeatedJson.get("totalElements").asLong();
        assertThat(repeatedTotal).isEqualTo(expectedCombinedTotal);

        // 3. Comma-separated query param: ?priority=URGENT,HIGH
        MvcResult commaRes = mockMvc.perform(get("/api/work-items")
                        .header("Authorization", adminToken)
                        .param("priority", "URGENT,HIGH"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode commaJson = objectMapper.readTree(commaRes.getResponse().getContentAsString());
        long commaTotal = commaJson.get("totalElements").asLong();
        assertThat(commaTotal).isEqualTo(expectedCombinedTotal);

        // 4. Verify server-side pagination with filtered results
        if (expectedCombinedTotal >= 2) {
            MvcResult page0Res = mockMvc.perform(get("/api/work-items")
                            .header("Authorization", adminToken)
                            .param("priority", "URGENT,HIGH")
                            .param("page", "0")
                            .param("size", "1"))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode page0Json = objectMapper.readTree(page0Res.getResponse().getContentAsString());
            assertThat(page0Json.get("totalElements").asLong()).isEqualTo(expectedCombinedTotal);
            assertThat(page0Json.get("totalPages").asLong()).isEqualTo(expectedCombinedTotal);
            assertThat(page0Json.get("content").size()).isEqualTo(1);
            String item0Id = page0Json.get("content").get(0).get("id").asText();

            MvcResult page1Res = mockMvc.perform(get("/api/work-items")
                            .header("Authorization", adminToken)
                            .param("priority", "URGENT,HIGH")
                            .param("page", "1")
                            .param("size", "1"))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode page1Json = objectMapper.readTree(page1Res.getResponse().getContentAsString());
            assertThat(page1Json.get("totalElements").asLong()).isEqualTo(expectedCombinedTotal);
            assertThat(page1Json.get("content").size()).isEqualTo(1);
            String item1Id = page1Json.get("content").get(0).get("id").asText();

            // Distinct items across pages
            assertThat(item1Id).isNotEqualTo(item0Id);
        }
    }

    @Test
    @DisplayName("16. Registration succeeds, normalizes email, hashes password with BCrypt, and issues valid token")
    void testRegistrationSuccess() throws Exception {
        registrationRateLimiter.reset();
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 6);
        String uniqueEmail = "reg.test." + uniqueSuffix + "@acme.internal";
        String opName = "New Operator " + uniqueSuffix;
        String expectedWorkspace = opName + "'s Workspace";
        RegisterRequest registerReq = new RegisterRequest(opName, uniqueEmail.toUpperCase(), "SecurePass2026!");

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.type").value("Bearer"))
                .andExpect(jsonPath("$.user.email").value(uniqueEmail.toLowerCase()))
                .andExpect(jsonPath("$.user.name").value(opName))
                .andExpect(jsonPath("$.user.systemRole").value("USER"))
                .andExpect(jsonPath("$.user.teams").isArray())
                .andExpect(jsonPath("$.user.teams", hasSize(1)))
                .andExpect(jsonPath("$.user.teams[0].teamName").value(expectedWorkspace))
                .andExpect(jsonPath("$.user.teams[0].role").value("TEAM_LEAD"))
                .andReturn();

        String token = objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
        assertThat(jwtService.validateToken(token)).isTrue();

        // Verify password in database is BCrypt hashed (not plaintext)
        User savedUser = userRepository.findByEmail(uniqueEmail.toLowerCase()).orElseThrow();
        assertThat(savedUser.getPasswordHash()).startsWith("$2a$");
        assertThat(passwordEncoder.matches("SecurePass2026!", savedUser.getPasswordHash())).isTrue();
        assertThat(teamRepository.findByName(expectedWorkspace)).isPresent();
        assertThat(teamMembershipRepository.findByUserId(savedUser.getId())).hasSize(1);

        // Verify newly registered user can subsequently log in with their normalized email and password
        LoginRequest loginReq = new LoginRequest(uniqueEmail.toLowerCase(), "SecurePass2026!");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.user.email").value(uniqueEmail.toLowerCase()));
    }

    @Test
    @DisplayName("17. Registration rejects duplicate email with 409 Conflict")
    void testRegistrationDuplicateEmail() throws Exception {
        registrationRateLimiter.reset();
        // alex.morgan@acme.internal already exists from V1 seed
        RegisterRequest dupReq = new RegisterRequest("Alex Impostor", "alex.morgan@acme.internal", "Password123!");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dupReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("already exists")));
    }

    @Test
    @DisplayName("18. Registration rejects invalid input fields with 400 Bad Request")
    void testRegistrationValidation() throws Exception {
        registrationRateLimiter.reset();
        // 1. Invalid email format
        RegisterRequest badEmail = new RegisterRequest("Valid Name", "not-an-email", "ValidPass123!");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badEmail)))
                .andExpect(status().isBadRequest());

        // 2. Short password (< 8 chars)
        RegisterRequest shortPass = new RegisterRequest("Valid Name", "valid@acme.internal", "short");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shortPass)))
                .andExpect(status().isBadRequest());

        // 3. Blank name
        RegisterRequest blankName = new RegisterRequest("  ", "valid@acme.internal", "ValidPass123!");
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(blankName)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("19. Registration strictly assigns USER role and ignores injected privileges")
    void testRegistrationIgnoresInjectedAdminPrivileges() throws Exception {
        registrationRateLimiter.reset();
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 6);
        String uniqueEmail = "priv.test." + uniqueSuffix + "@acme.internal";
        String atkName = "Attacker " + uniqueSuffix;
        String expectedWorkspace = atkName + "'s Workspace";
        String payloadWithInjectedPrivileges = """
            {
                "name": "%s",
                "email": "%s",
                "password": "Password1234!",
                "systemRole": "ADMIN",
                "role": "ADMIN",
                "admin": true,
                "teamId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
            }
            """.formatted(atkName, uniqueEmail);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadWithInjectedPrivileges))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.systemRole").value("USER"))
                .andExpect(jsonPath("$.user.teams", hasSize(1)))
                .andExpect(jsonPath("$.user.teams[0].teamName").value(expectedWorkspace))
                .andExpect(jsonPath("$.user.teams[0].role").value("TEAM_LEAD"));

        User userInDb = userRepository.findByEmail(uniqueEmail).orElseThrow();
        assertThat(userInDb.getSystemRole()).isEqualTo("USER");
        assertThat(teamMembershipRepository.existsByTeamIdAndUserId(UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), userInDb.getId())).isFalse();
    }

    @Test
    @DisplayName("20. Registration rate limiter protects against request floods with 429 Too Many Requests")
    void testRegistrationRateLimiterAbuseProtection() throws Exception {
        registrationRateLimiter.reset();
        String clientIp = "192.168.1.100";
        String emailPrefix = "flood." + UUID.randomUUID() + ".";

        // Perform requests up to limit (10)
        for (int i = 0; i < 10; i++) {
            RegisterRequest req = new RegisterRequest("Operator " + i, emailPrefix + i + "@acme.internal", "FloodPass123!");
            mockMvc.perform(post("/api/auth/register")
                            .with(request -> {
                                request.setRemoteAddr(clientIp);
                                return request;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated());
        }

        // The 11th request from the same IP must be rejected with 429 Too Many Requests
        RegisterRequest req11 = new RegisterRequest("Operator 11", emailPrefix + "11@acme.internal", "FloodPass123!");
        mockMvc.perform(post("/api/auth/register")
                        .with(request -> {
                            request.setRemoteAddr(clientIp);
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req11)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(containsString("Too many registration attempts")));

        registrationRateLimiter.reset();
    }

    @Test
    @DisplayName("21. Admin demo bootstrap provisions admin@newtonite.com with ADMIN role idempotently")
    void testAdminDemoBootstrap() throws Exception {
        String adminEmail = "admin@newtonite.com";
        String adminPassword = "admin123";

        // Clean up if already present from previous run
        userRepository.findByEmail(adminEmail).ifPresent(u -> {
            teamMembershipRepository.deleteAll(teamMembershipRepository.findByUserId(u.getId()));
            userRepository.delete(u);
        });

        AdminBootstrapRunner runner = new AdminBootstrapRunner(
                userRepository,
                teamRepository,
                teamMembershipRepository,
                passwordEncoder,
                true,
                adminEmail,
                adminPassword
        );

        // First run: provisions admin
        runner.run(null);

        User adminUser = userRepository.findByEmail(adminEmail).orElseThrow();
        assertThat(adminUser.getSystemRole()).isEqualTo("ADMIN");
        assertThat(passwordEncoder.matches(adminPassword, adminUser.getPasswordHash())).isTrue();

        // Verify admin has membership in Acme Studio
        assertThat(teamMembershipRepository.findByUserId(adminUser.getId())).isNotEmpty();

        // Verify admin can authenticate via /api/auth/login and receives ADMIN token
        LoginRequest loginReq = new LoginRequest(adminEmail, adminPassword);
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(adminEmail))
                .andExpect(jsonPath("$.user.systemRole").value("ADMIN"))
                .andReturn();

        String adminToken = objectMapper.readTree(loginResult.getResponse().getContentAsString()).get("token").asText();
        assertThat(jwtService.validateToken(adminToken)).isTrue();

        // Verify admin has global workspace access (can list items across teams)
        mockMvc.perform(get("/api/work-items")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Second run: idempotent (does not alter or reset user)
        runner.run(null);
        User stillSame = userRepository.findByEmail(adminEmail).orElseThrow();
        assertThat(stillSame.getId()).isEqualTo(adminUser.getId());
    }

    @Test
    @DisplayName("22. Successful registration creates workspace and membership, allowing user to retrieve team and create work items")
    void testNewUserCanRetrieveWorkspaceAndCreateWorkItem() throws Exception {
        registrationRateLimiter.reset();
        String janeSuffix = UUID.randomUUID().toString().substring(0, 6);
        String janeName = "Jane Flow " + janeSuffix;
        String expectedWorkspace = janeName + "'s Workspace";
        String email = "jane.flow." + janeSuffix + "@acme.internal";
        RegisterRequest req = new RegisterRequest(janeName, email, "Password123!");

        MvcResult regResult = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.teams", hasSize(1)))
                .andExpect(jsonPath("$.user.teams[0].teamName").value(expectedWorkspace))
                .andExpect(jsonPath("$.user.teams[0].role").value("TEAM_LEAD"))
                .andReturn();

        JsonNode json = objectMapper.readTree(regResult.getResponse().getContentAsString());
        String token = "Bearer " + json.get("token").asText();
        UUID teamId = UUID.fromString(json.get("user").get("teams").get(0).get("teamId").asText());

        // 1. Retrieve teams via /api/teams
        mockMvc.perform(get("/api/teams")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(teamId.toString()))
                .andExpect(jsonPath("$[0].name").value(expectedWorkspace));

        // 2. Create work item in newly created personal workspace
        CreateWorkItemRequest itemReq = new CreateWorkItemRequest(
                "Jane Initial Pipeline Task",
                "Verify automated workspace creation and item creation flow.",
                WorkItemType.TASK,
                WorkItemPriority.HIGH,
                "Ops",
                teamId,
                null,
                null
        );

        MvcResult itemResult = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(itemReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Jane Initial Pipeline Task"))
                .andExpect(jsonPath("$.team.id").value(teamId.toString()))
                .andExpect(jsonPath("$.team.name").value(expectedWorkspace))
                .andExpect(jsonPath("$.trackingNumber").value(containsString("NEW-")))
                .andReturn();

        UUID createdItemId = UUID.fromString(objectMapper.readTree(itemResult.getResponse().getContentAsString()).get("id").asText());

        // 3. User lists work items -> Jane's item is present
        mockMvc.perform(get("/api/work-items")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(createdItemId.toString()));
    }

    @Test
    @DisplayName("23. Strict data isolation: A new user cannot access another user's workspace, items, comments, or activity logs")
    void testNewUserCannotAccessAnotherUserWorkspaceOrData() throws Exception {
        registrationRateLimiter.reset();
        // Register User A
        String emailA = "user.a." + UUID.randomUUID() + "@acme.internal";
        MvcResult regA = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest("User A", emailA, "Password123!"))))
                .andExpect(status().isCreated())
                .andReturn();
        String tokenA = "Bearer " + objectMapper.readTree(regA.getResponse().getContentAsString()).get("token").asText();
        UUID teamAId = UUID.fromString(objectMapper.readTree(regA.getResponse().getContentAsString()).get("user").get("teams").get(0).get("teamId").asText());

        // Register User B
        String emailB = "user.b." + UUID.randomUUID() + "@acme.internal";
        MvcResult regB = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest("User B", emailB, "Password123!"))))
                .andExpect(status().isCreated())
                .andReturn();
        String tokenB = "Bearer " + objectMapper.readTree(regB.getResponse().getContentAsString()).get("token").asText();

        // User A creates a work item
        CreateWorkItemRequest itemA = new CreateWorkItemRequest(
                "Private Data of User A",
                "Confidential task in User A workspace",
                WorkItemType.INCIDENT,
                WorkItemPriority.URGENT,
                "Security",
                teamAId,
                null,
                null
        );
        MvcResult itemAResult = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(itemA)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID itemAId = UUID.fromString(objectMapper.readTree(itemAResult.getResponse().getContentAsString()).get("id").asText());

        // User B tries to read User A's item -> 403 Forbidden
        mockMvc.perform(get("/api/work-items/" + itemAId)
                        .header("Authorization", tokenB))
                .andExpect(status().isForbidden());

        // User B tries to update User A's item -> 403 Forbidden
        UpdateWorkItemRequest updateReq = new UpdateWorkItemRequest();
        updateReq.setTitle("Hacked Title");
        mockMvc.perform(patch("/api/work-items/" + itemAId)
                        .header("Authorization", tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isForbidden());

        // User B tries to claim User A's item -> 403 Forbidden
        mockMvc.perform(post("/api/work-items/" + itemAId + "/claim")
                        .header("Authorization", tokenB))
                .andExpect(status().isForbidden());

        // User B tries to view comments on User A's item -> 403 Forbidden
        mockMvc.perform(get("/api/work-items/" + itemAId + "/comments")
                        .header("Authorization", tokenB))
                .andExpect(status().isForbidden());

        // User B tries to view activity logs for User A's item -> 403 Forbidden
        mockMvc.perform(get("/api/work-items/" + itemAId + "/activity")
                        .header("Authorization", tokenB))
                .andExpect(status().isForbidden());

        // User B tries to view User A's team by ID -> 403 Forbidden
        mockMvc.perform(get("/api/teams/" + teamAId)
                        .header("Authorization", tokenB))
                .andExpect(status().isForbidden());

        // User B lists work items -> User A's item is NOT included
        MvcResult listB = mockMvc.perform(get("/api/work-items")
                        .header("Authorization", tokenB))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode bContent = objectMapper.readTree(listB.getResponse().getContentAsString()).get("content");
        assertThat(bContent.isEmpty()).isTrue();
    }

    @Test
    @DisplayName("24. Duplicate registration does not create extra workspaces")
    void testDuplicateRegistrationDoesNotCreateExtraWorkspaces() throws Exception {
        registrationRateLimiter.reset();
        String dupSuffix = UUID.randomUUID().toString().substring(0, 6);
        String dupName = "Dup Person " + dupSuffix;
        String expectedWs = dupName + "'s Workspace";
        String dupEmail = "dup.test." + dupSuffix + "@acme.internal";
        RegisterRequest req1 = new RegisterRequest(dupName, dupEmail, "Password123!");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isCreated());

        // Re-attempt registration with same email
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isConflict());

        // Verify only one workspace was created
        assertThat(teamRepository.findByName(expectedWs)).isPresent();
        assertThat(teamRepository.findByName(expectedWs + " (1)")).isEmpty();
    }

    @Test
    @DisplayName("25. A provisioning failure rolls back user registration atomically")
    void testProvisioningFailureRollsBackTransaction() {
        String rollbackEmail = "rollback.tx." + UUID.randomUUID() + "@acme.internal";

        org.mockito.Mockito.doAnswer(invocation -> {
            User u = invocation.getArgument(0);
            if (u.getEmail().startsWith("rollback.tx.")) {
                throw new RuntimeException("Simulated provisioning crash");
            }
            return invocation.callRealMethod();
        }).when(teamService).provisionPersonalWorkspace(org.mockito.ArgumentMatchers.any());

        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class, () -> {
            userRegistrationService.registerUserWithPersonalWorkspace(
                    rollbackEmail,
                    "Rollback User",
                    "RU",
                    "Password123!"
            );
        });

        // Verify that the user was NOT persisted in the database
        assertThat(userRepository.findByEmail(rollbackEmail)).isEmpty();
    }

    @Test
    @DisplayName("26. Existing admin permissions continue to work across all workspaces")
    void testAdminAccessAcrossWorkspaces() throws Exception {
        registrationRateLimiter.reset();
        // Register a regular user and create an item
        String adminCheckSuffix = UUID.randomUUID().toString().substring(0, 6);
        String adminCheckName = "Admin Check User " + adminCheckSuffix;
        String expectedWs = adminCheckName + "'s Workspace";
        String email = "admin.check." + adminCheckSuffix + "@acme.internal";
        MvcResult regResult = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest(adminCheckName, email, "Password123!"))))
                .andExpect(status().isCreated())
                .andReturn();

        String userToken = "Bearer " + objectMapper.readTree(regResult.getResponse().getContentAsString()).get("token").asText();
        UUID teamId = UUID.fromString(objectMapper.readTree(regResult.getResponse().getContentAsString()).get("user").get("teams").get(0).get("teamId").asText());

        CreateWorkItemRequest itemReq = new CreateWorkItemRequest(
                "Task Visible to Admin",
                "Created by regular user",
                WorkItemType.TASK,
                WorkItemPriority.MEDIUM,
                "Ops",
                teamId,
                null,
                null
        );
        MvcResult itemResult = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(itemReq)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID createdItemId = UUID.fromString(objectMapper.readTree(itemResult.getResponse().getContentAsString()).get("id").asText());

        // Admin Alex Morgan accesses the new user's team and work item
        String adminToken = tokenProvider.alexMorganToken();

        // Admin can read new user's team details
        mockMvc.perform(get("/api/teams/" + teamId)
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(teamId.toString()))
                .andExpect(jsonPath("$.name").value(expectedWs));

        // Admin can read the new user's work item
        mockMvc.perform(get("/api/work-items/" + createdItemId)
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(createdItemId.toString()));
    }

    @Test
    @DisplayName("27. Existing registered user without team membership is safely recovered on login and /api/auth/me")
    void testExistingUnassignedUserRecoveryOnLogin() throws Exception {
        String legacySuffix = UUID.randomUUID().toString().substring(0, 6);
        String legacyName = "Legacy Unassigned " + legacySuffix;
        String expectedWs = legacyName + "'s Workspace";
        String unassignedEmail = "legacy.unassigned." + legacySuffix + "@acme.internal";
        User legacyUser = new User(
                UUID.randomUUID(),
                unassignedEmail,
                legacyName,
                "LU",
                "USER",
                passwordEncoder.encode("LegacyPass2026!"),
                true
        );
        userRepository.save(legacyUser);

        // Confirm user has 0 team memberships
        assertThat(teamMembershipRepository.findByUserId(legacyUser.getId())).isEmpty();

        // When legacy user logs in, their personal workspace is automatically provisioned
        LoginRequest loginReq = new LoginRequest(unassignedEmail, "LegacyPass2026!");
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.teams", hasSize(1)))
                .andExpect(jsonPath("$.user.teams[0].teamName").value(expectedWs))
                .andExpect(jsonPath("$.user.teams[0].role").value("TEAM_LEAD"))
                .andReturn();

        // Verify in DB that workspace was created and membership assigned
        List<com.newtonite.team.TeamMembership> memberships = teamMembershipRepository.findByUserId(legacyUser.getId());
        assertThat(memberships).hasSize(1);
        assertThat(memberships.get(0).getRole()).isEqualTo("TEAM_LEAD");
        assertThat(memberships.get(0).getTeam().getName()).isEqualTo(expectedWs);

        // Verify user can now immediately retrieve their workspace and create items
        String token = "Bearer " + objectMapper.readTree(loginResult.getResponse().getContentAsString()).get("token").asText();
        mockMvc.perform(get("/api/teams")
                        .header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }
}
