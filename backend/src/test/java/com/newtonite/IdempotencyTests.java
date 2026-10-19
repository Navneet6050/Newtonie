package com.newtonite;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.newtonite.workitem.WorkItemPriority;
import com.newtonite.workitem.WorkItemType;
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
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class IdempotencyTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final UUID TEAM_ACME_STUDIO_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    @Test
    @DisplayName("Scenario 3: Duplicate create retry with same Idempotency-Key returns cached response; conflicting payload returns 409 Conflict")
    void testIdempotentCreationAndConflictDetection() throws Exception {
        String idempotencyKey = "idemp-key-" + UUID.randomUUID();

        CreateWorkItemRequest payloadA = new CreateWorkItemRequest(
                "Idempotent Payment Webhook Queue Alert",
                "Ensure retry queue processing under peak load",
                WorkItemType.OPS,
                WorkItemPriority.URGENT,
                "Payment Engine",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );

        // 1. First request with Idempotency-Key
        MvcResult firstResult = mockMvc.perform(post("/api/work-items")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payloadA)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.trackingNumber").exists())
                .andReturn();

        JsonNode firstJson = objectMapper.readTree(firstResult.getResponse().getContentAsString());
        String createdId = firstJson.get("id").asText();
        String createdTrackingNumber = firstJson.get("trackingNumber").asText();

        // 2. Retry identical request with same Idempotency-Key
        MvcResult retryResult = mockMvc.perform(post("/api/work-items")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payloadA)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode retryJson = objectMapper.readTree(retryResult.getResponse().getContentAsString());
        assertThat(retryJson.get("id").asText()).isEqualTo(createdId);
        assertThat(retryJson.get("trackingNumber").asText()).isEqualTo(createdTrackingNumber);

        // 3. Verify that total work items created is 1 and activity logs has only 1 CREATED log
        MvcResult activityResult = mockMvc.perform(get("/api/work-items/" + createdId + "/activity"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode logs = objectMapper.readTree(activityResult.getResponse().getContentAsString()).get("content");
        assertThat(logs.size()).isEqualTo(1);
        assertThat(logs.get(0).get("actionType").asText()).isEqualTo("CREATED");

        // 4. Conflicting reuse of the same Idempotency-Key with different payload
        CreateWorkItemRequest payloadB = new CreateWorkItemRequest(
                "Different payload with same key",
                "This should trigger conflict detection",
                WorkItemType.BUG,
                WorkItemPriority.LOW,
                "Billing Gateway",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );

        mockMvc.perform(post("/api/work-items")
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payloadB)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value(containsString("previously used with a different request payload")));
    }
}
