package com.newtonite;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newtonite.support.TestTokenProvider;
import com.newtonite.workitem.WorkItemPriority;
import com.newtonite.workitem.WorkItemType;
import com.newtonite.workitem.dto.CreateCommentRequest;
import com.newtonite.workitem.dto.CreateWorkItemRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class TeamAndActivityAuthorizationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestTokenProvider tokenProvider;

    private static final UUID TEAM_ACME_STUDIO_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID TEAM_ACME_PLATFORM_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID TEAM_ACME_CLOUD_INFRA_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");

    @Test
    @DisplayName("1. Unauthenticated requests to /api/teams and /api/activity are rejected with 401")
    void testUnauthenticatedEndpointsReturn401() throws Exception {
        mockMvc.perform(get("/api/teams"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/teams/" + TEAM_ACME_STUDIO_ID))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/activity"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("2. Sarah Chen (regular user) only sees teams she is a member of (Acme Studio)")
    void testTeamsEndpointEnforcesTeamScopingForRegularUser() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();

        MvcResult result = mockMvc.perform(get("/api/teams")
                        .header("Authorization", sarahToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(TEAM_ACME_STUDIO_ID.toString()))
                .andExpect(jsonPath("$[0].name").value("Acme Studio"))
                .andExpect(jsonPath("$[0].memberCount").isNumber())
                .andExpect(jsonPath("$[0].workItemCount").isNumber())
                .andExpect(jsonPath("$[0].members").isArray())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode team = root.get(0);
        assertThat(team.get("memberCount").asInt()).isGreaterThanOrEqualTo(1);
        assertThat(team.get("members").size()).isEqualTo(team.get("memberCount").asInt());

        // Verify member structure
        JsonNode firstMember = team.get("members").get(0);
        assertThat(firstMember.hasNonNull("userId")).isTrue();
        assertThat(firstMember.hasNonNull("name")).isTrue();
        assertThat(firstMember.hasNonNull("role")).isTrue();
    }

    @Test
    @DisplayName("3. Liam Vance (Acme Platform) only sees Acme Platform team")
    void testTeamsEndpointForLiamVance() throws Exception {
        String liamToken = tokenProvider.liamVanceToken();

        mockMvc.perform(get("/api/teams")
                        .header("Authorization", liamToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(TEAM_ACME_PLATFORM_ID.toString()))
                .andExpect(jsonPath("$[0].name").value("Acme Platform"));
    }

    @Test
    @DisplayName("4. Admin Alex Morgan sees all teams in the system")
    void testTeamsEndpointForAdmin() throws Exception {
        String adminToken = tokenProvider.alexMorganToken();

        mockMvc.perform(get("/api/teams")
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(org.hamcrest.Matchers.greaterThanOrEqualTo(3))))
                .andExpect(jsonPath("$[*].id", org.hamcrest.Matchers.hasItems(
                        TEAM_ACME_STUDIO_ID.toString(),
                        TEAM_ACME_PLATFORM_ID.toString(),
                        TEAM_ACME_CLOUD_INFRA_ID.toString()
                )));
    }

    @Test
    @DisplayName("5. Single team endpoint GET /api/teams/{id} rejects unauthorized users with 403")
    void testSingleTeamAuthorization() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();
        String liamToken = tokenProvider.liamVanceToken();
        String adminToken = tokenProvider.alexMorganToken();

        // Sarah can read her team
        mockMvc.perform(get("/api/teams/" + TEAM_ACME_STUDIO_ID)
                        .header("Authorization", sarahToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Acme Studio"));

        // Sarah cannot read Acme Platform (403 Forbidden)
        mockMvc.perform(get("/api/teams/" + TEAM_ACME_PLATFORM_ID)
                        .header("Authorization", sarahToken))
                .andExpect(status().isForbidden());

        // Liam cannot read Acme Studio (403 Forbidden)
        mockMvc.perform(get("/api/teams/" + TEAM_ACME_STUDIO_ID)
                        .header("Authorization", liamToken))
                .andExpect(status().isForbidden());

        // Admin can read any team
        mockMvc.perform(get("/api/teams/" + TEAM_ACME_PLATFORM_ID)
                        .header("Authorization", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Acme Platform"));

        // Non-existent team returns 404
        mockMvc.perform(get("/api/teams/" + UUID.randomUUID())
                        .header("Authorization", adminToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("6. Activity feed enforces team isolation and includes tracking number")
    void testActivityFeedScopingAndTrackingDetails() throws Exception {
        String sarahToken = tokenProvider.sarahChenToken();
        String liamToken = tokenProvider.liamVanceToken();
        String adminToken = tokenProvider.alexMorganToken();

        // 1. Create a work item for Studio by Sarah
        CreateWorkItemRequest studioReq = new CreateWorkItemRequest(
                "Studio Auth Audit Activity Test",
                "Testing activity logging for Studio",
                WorkItemType.TASK,
                WorkItemPriority.HIGH,
                "Security Area",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );
        MvcResult studioItemRes = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", sarahToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(studioReq)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID studioItemId = UUID.fromString(objectMapper.readTree(studioItemRes.getResponse().getContentAsString()).get("id").asText());
        String studioTracking = objectMapper.readTree(studioItemRes.getResponse().getContentAsString()).get("trackingNumber").asText();

        // Sarah adds a comment to generate another activity log
        mockMvc.perform(post("/api/work-items/" + studioItemId + "/comments")
                        .header("Authorization", sarahToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateCommentRequest("Studio comment for audit"))))
                .andExpect(status().isCreated());

        // 2. Create a work item for Platform by Liam
        CreateWorkItemRequest platformReq = new CreateWorkItemRequest(
                "Platform Telemetry Activity Test",
                "Testing activity logging for Platform",
                WorkItemType.OPS,
                WorkItemPriority.URGENT,
                "Platform Cluster",
                TEAM_ACME_PLATFORM_ID,
                null,
                null
        );
        MvcResult platformItemRes = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", liamToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(platformReq)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID platformItemId = UUID.fromString(objectMapper.readTree(platformItemRes.getResponse().getContentAsString()).get("id").asText());
        String platformTracking = objectMapper.readTree(platformItemRes.getResponse().getContentAsString()).get("trackingNumber").asText();

        // 3. Sarah queries GET /api/activity
        MvcResult sarahFeedRes = mockMvc.perform(get("/api/activity")
                        .header("Authorization", sarahToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andReturn();

        JsonNode sarahFeed = objectMapper.readTree(sarahFeedRes.getResponse().getContentAsString()).get("content");
        assertThat(sarahFeed.size()).isGreaterThanOrEqualTo(2);

        // Verify Sarah's feed only contains Studio activities and has tracking number
        boolean foundStudioItem = false;
        for (JsonNode entry : sarahFeed) {
            assertThat(entry.get("workItemId").asText()).isNotEqualTo(platformItemId.toString());
            if (entry.get("workItemId").asText().equals(studioItemId.toString())) {
                foundStudioItem = true;
                assertThat(entry.get("trackingNumber").asText()).isEqualTo(studioTracking);
                assertThat(entry.get("workItemTitle").asText()).isEqualTo("Studio Auth Audit Activity Test");
                assertThat(entry.get("actor").get("email").asText()).isEqualTo("sarah.chen@acme.internal");
            }
        }
        assertThat(foundStudioItem).isTrue();

        // 4. Sarah attempting to query Platform team's activity is rejected with 403 Forbidden
        mockMvc.perform(get("/api/activity")
                        .header("Authorization", sarahToken)
                        .param("teamId", TEAM_ACME_PLATFORM_ID.toString()))
                .andExpect(status().isForbidden());

        // 5. Liam querying GET /api/activity only sees Platform activities
        MvcResult liamFeedRes = mockMvc.perform(get("/api/activity")
                        .header("Authorization", liamToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode liamFeed = objectMapper.readTree(liamFeedRes.getResponse().getContentAsString()).get("content");
        boolean foundPlatformItem = false;
        for (JsonNode entry : liamFeed) {
            assertThat(entry.get("workItemId").asText()).isNotEqualTo(studioItemId.toString());
            if (entry.get("workItemId").asText().equals(platformItemId.toString())) {
                foundPlatformItem = true;
                assertThat(entry.get("trackingNumber").asText()).isEqualTo(platformTracking);
            }
        }
        assertThat(foundPlatformItem).isTrue();

        // 6. Admin Alex Morgan can view all activities or filter by team
        mockMvc.perform(get("/api/activity")
                        .header("Authorization", adminToken)
                        .param("teamId", TEAM_ACME_PLATFORM_ID.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }
}
