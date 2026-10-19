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
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

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
}
