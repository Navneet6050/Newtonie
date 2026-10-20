package com.newtonite;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newtonite.workitem.WorkItemPriority;
import com.newtonite.workitem.WorkItemType;
import com.newtonite.workitem.dto.CreateWorkItemRequest;
import com.newtonite.workitem.dto.UpdateWorkItemRequest;
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
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class WorkItemWorkflowTests {

    @Autowired
    private org.springframework.web.context.WebApplicationContext context;

    @Autowired
    private com.newtonite.support.TestTokenProvider tokenProvider;

    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @org.junit.jupiter.api.BeforeEach
    void setup() {
        this.mockMvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                .webAppContextSetup(context)
                .apply(org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity())
                .defaultRequest(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/")
                        .header("Authorization", tokenProvider.alexMorganToken()))
                .build();
    }

    private static final UUID TEAM_ACME_STUDIO_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID USER_SARAH_CHEN_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    @DisplayName("Create, read, and list work items successfully")
    void testCreateReadAndListWorkItems() throws Exception {
        CreateWorkItemRequest request = new CreateWorkItemRequest(
                "Ingest pipeline memory leak investigation",
                "Investigate heap dump after sustained 10k ingest spikes.",
                WorkItemType.INCIDENT,
                WorkItemPriority.URGENT,
                "Data Pipeline",
                TEAM_ACME_STUDIO_ID,
                USER_SARAH_CHEN_ID,
                null
        );

        MvcResult createResult = mockMvc.perform(post("/api/work-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.trackingNumber").value(containsString("NEW-")))
                .andExpect(jsonPath("$.title").value("Ingest pipeline memory leak investigation"))
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.priority").value("URGENT"))
                .andExpect(jsonPath("$.type").value("INCIDENT"))
                .andExpect(jsonPath("$.team.name").value("Acme Studio"))
                .andExpect(jsonPath("$.assignee.name").value("Sarah Chen"))
                .andExpect(jsonPath("$.reporter.name").value("Alex Morgan"))
                .andReturn();

        JsonNode json = objectMapper.readTree(createResult.getResponse().getContentAsString());
        String workItemId = json.get("id").asText();

        // Single item lookup
        mockMvc.perform(get("/api/work-items/" + workItemId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(workItemId))
                .andExpect(jsonPath("$.title").value("Ingest pipeline memory leak investigation"));

        // List and filter by type and status
        mockMvc.perform(get("/api/work-items")
                        .param("type", "INCIDENT")
                        .param("status", "OPEN")
                        .param("search", "Ingest pipeline"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].id").value(workItemId));
    }

    @Test
    @DisplayName("Validation failure on missing title or null type returns 400 Bad Request")
    void testValidationFailures() throws Exception {
        CreateWorkItemRequest invalidRequest = new CreateWorkItemRequest(
                "", // Blank title
                "Missing title description",
                null, // Null type
                WorkItemPriority.HIGH,
                "Infrastructure",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );

        mockMvc.perform(post("/api/work-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.validationErrors.title").exists())
                .andExpect(jsonPath("$.validationErrors.type").exists());
    }

    @Test
    @DisplayName("Referencing nonexistent team ID returns 400 Bad Request")
    void testNonexistentTeamReference() throws Exception {
        UUID nonexistentTeamId = UUID.randomUUID();
        CreateWorkItemRequest request = new CreateWorkItemRequest(
                "Valid Title",
                "Description",
                WorkItemType.TASK,
                WorkItemPriority.MEDIUM,
                "Core Engine",
                nonexistentTeamId,
                null,
                null
        );

        mockMvc.perform(post("/api/work-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Referenced team not found")));
    }

    @Test
    @DisplayName("Unknown work item ID returns 404 Not Found")
    void testUnknownWorkItemId() throws Exception {
        UUID unknownId = UUID.randomUUID();
        mockMvc.perform(get("/api/work-items/" + unknownId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("Valid status transitions record activity logs; invalid transitions return 409 Conflict")
    void testStateTransitionsAndActivityHistory() throws Exception {
        // Create new item (starts in OPEN)
        CreateWorkItemRequest createReq = new CreateWorkItemRequest(
                "Telemetry buffer overflow",
                "Buffer overflowing at 200k events/sec",
                WorkItemType.BUG,
                WorkItemPriority.HIGH,
                "Telemetry",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );

        MvcResult createResult = mockMvc.perform(post("/api/work-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText();

        // 1. Invalid transition: OPEN -> COMPLETED is not allowed directly
        UpdateWorkItemRequest invalidTransitionReq = new UpdateWorkItemRequest();
        invalidTransitionReq.setStatus(com.newtonite.workitem.WorkItemStatus.COMPLETED);

        mockMvc.perform(patch("/api/work-items/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidTransitionReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("Cannot transition work item")));

        // 2. Valid transition: OPEN -> IN_PROGRESS
        UpdateWorkItemRequest toInProgressReq = new UpdateWorkItemRequest();
        toInProgressReq.setStatus(com.newtonite.workitem.WorkItemStatus.IN_PROGRESS);

        mockMvc.perform(patch("/api/work-items/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(toInProgressReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        // 3. Valid transition: IN_PROGRESS -> REVIEW_NEEDED
        UpdateWorkItemRequest toReviewReq = new UpdateWorkItemRequest();
        toReviewReq.setStatus(com.newtonite.workitem.WorkItemStatus.REVIEW_NEEDED);

        mockMvc.perform(patch("/api/work-items/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(toReviewReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVIEW_NEEDED"));

        // 4. Valid transition: REVIEW_NEEDED -> COMPLETED
        UpdateWorkItemRequest toCompletedReq = new UpdateWorkItemRequest();
        toCompletedReq.setStatus(com.newtonite.workitem.WorkItemStatus.COMPLETED);

        mockMvc.perform(patch("/api/work-items/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(toCompletedReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        // 5. Invalid transition: COMPLETED is terminal; cannot reopen
        UpdateWorkItemRequest reopenReq = new UpdateWorkItemRequest();
        reopenReq.setStatus(com.newtonite.workitem.WorkItemStatus.IN_PROGRESS);

        mockMvc.perform(patch("/api/work-items/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reopenReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("Cannot transition work item")));

        // 6. Check Activity History: should have CREATED + 3 status transitions = 4 logs
        MvcResult activityResult = mockMvc.perform(get("/api/work-items/" + id + "/activity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(4)))
                .andReturn();

        JsonNode logs = objectMapper.readTree(activityResult.getResponse().getContentAsString()).get("content");
        assertThat(logs.get(0).get("actionType").asText()).isEqualTo("STATUS_CHANGED");
        assertThat(logs.get(0).get("toValue").asText()).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("No-op update does not generate duplicate activity log entries")
    void testNoOpUpdateDoesNotCreateActivityLogs() throws Exception {
        CreateWorkItemRequest createReq = new CreateWorkItemRequest(
                "Static Analysis Threshold Adjustment",
                "Increase strictness on nullable warnings",
                WorkItemType.TASK,
                WorkItemPriority.LOW,
                "Core Engine",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );

        MvcResult createResult = mockMvc.perform(post("/api/work-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText();

        // Fetch activity count after creation (should be 1: CREATED)
        MvcResult initialHistory = mockMvc.perform(get("/api/work-items/" + id + "/activity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andReturn();

        // Perform update sending identical title and identical status (OPEN)
        UpdateWorkItemRequest noOpReq = new UpdateWorkItemRequest();
        noOpReq.setTitle("Static Analysis Threshold Adjustment");
        noOpReq.setStatus(com.newtonite.workitem.WorkItemStatus.OPEN);

        mockMvc.perform(patch("/api/work-items/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(noOpReq)))
                .andExpect(status().isOk());

        // Activity log count must STILL be 1 (no spurious entries generated)
        mockMvc.perform(get("/api/work-items/" + id + "/activity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)));
    }

    @Test
    @DisplayName("Filter work items by due date range correctly matches boundary conditions")
    void testDueDateFiltering() throws Exception {
        java.time.Instant now = java.time.Instant.now();
        java.time.Instant overdue = now.minus(java.time.Duration.ofDays(3));
        java.time.Instant inThreeDays = now.plus(java.time.Duration.ofDays(3));
        java.time.Instant inTwoWeeks = now.plus(java.time.Duration.ofDays(14));

        // 1. Create overdue item
        CreateWorkItemRequest overdueReq = new CreateWorkItemRequest(
                "Overdue Patch " + UUID.randomUUID(),
                "Fix overdue security bug",
                WorkItemType.BUG,
                WorkItemPriority.HIGH,
                "Security",
                TEAM_ACME_STUDIO_ID,
                null,
                overdue
        );
        MvcResult overdueRes = mockMvc.perform(post("/api/work-items")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(overdueReq)))
                .andExpect(status().isCreated())
                .andReturn();
        String overdueId = objectMapper.readTree(overdueRes.getResponse().getContentAsString()).get("id").asText();

        // 2. Create item due in 3 days
        CreateWorkItemRequest upcomingReq = new CreateWorkItemRequest(
                "Upcoming Deploy " + UUID.randomUUID(),
                "Deploy release candidate",
                WorkItemType.OPS,
                WorkItemPriority.MEDIUM,
                "Release",
                TEAM_ACME_STUDIO_ID,
                null,
                inThreeDays
        );
        MvcResult upcomingRes = mockMvc.perform(post("/api/work-items")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(upcomingReq)))
                .andExpect(status().isCreated())
                .andReturn();
        String upcomingId = objectMapper.readTree(upcomingRes.getResponse().getContentAsString()).get("id").asText();

        // 3. Create item due in two weeks
        CreateWorkItemRequest farReq = new CreateWorkItemRequest(
                "Far Future Feature " + UUID.randomUUID(),
                "Quarterly capacity planning",
                WorkItemType.TASK,
                WorkItemPriority.LOW,
                "Planning",
                TEAM_ACME_STUDIO_ID,
                null,
                inTwoWeeks
        );
        MvcResult farRes = mockMvc.perform(post("/api/work-items")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(farReq)))
                .andExpect(status().isCreated())
                .andReturn();
        String farId = objectMapper.readTree(farRes.getResponse().getContentAsString()).get("id").asText();

        // 4. Create item with NO due date
        CreateWorkItemRequest noDueReq = new CreateWorkItemRequest(
                "Undated Backlog Item " + UUID.randomUUID(),
                "General cleanup task",
                WorkItemType.TASK,
                WorkItemPriority.LOW,
                "General",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );
        MvcResult noDueRes = mockMvc.perform(post("/api/work-items")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(noDueReq)))
                .andExpect(status().isCreated())
                .andReturn();
        String noDueId = objectMapper.readTree(noDueRes.getResponse().getContentAsString()).get("id").asText();

        // Query Overdue: dueDateTo = now - 1 day
        mockMvc.perform(get("/api/work-items")
                .param("dueDateTo", now.minus(java.time.Duration.ofDays(1)).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id == '" + overdueId + "')]").exists())
                .andExpect(jsonPath("$.content[?(@.id == '" + upcomingId + "')]").doesNotExist())
                .andExpect(jsonPath("$.content[?(@.id == '" + farId + "')]").doesNotExist())
                .andExpect(jsonPath("$.content[?(@.id == '" + noDueId + "')]").doesNotExist());

        // Query Upcoming 7 days: dueDateFrom = now, dueDateTo = now + 7 days
        mockMvc.perform(get("/api/work-items")
                .param("dueDateFrom", now.minus(java.time.Duration.ofMinutes(5)).toString())
                .param("dueDateTo", now.plus(java.time.Duration.ofDays(7)).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id == '" + upcomingId + "')]").exists())
                .andExpect(jsonPath("$.content[?(@.id == '" + overdueId + "')]").doesNotExist())
                .andExpect(jsonPath("$.content[?(@.id == '" + farId + "')]").doesNotExist())
                .andExpect(jsonPath("$.content[?(@.id == '" + noDueId + "')]").doesNotExist());

        // Query Custom Range: from now + 10 days to now + 20 days
        mockMvc.perform(get("/api/work-items")
                .param("dueDateFrom", now.plus(java.time.Duration.ofDays(10)).toString())
                .param("dueDateTo", now.plus(java.time.Duration.ofDays(20)).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id == '" + farId + "')]").exists())
                .andExpect(jsonPath("$.content[?(@.id == '" + upcomingId + "')]").doesNotExist())
                .andExpect(jsonPath("$.content[?(@.id == '" + overdueId + "')]").doesNotExist())
                .andExpect(jsonPath("$.content[?(@.id == '" + noDueId + "')]").doesNotExist());

        // Query All Dates (no dueDate params): undated item is included
        mockMvc.perform(get("/api/work-items")
                .param("search", "Undated Backlog Item"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id == '" + noDueId + "')]").exists());
    }
}
