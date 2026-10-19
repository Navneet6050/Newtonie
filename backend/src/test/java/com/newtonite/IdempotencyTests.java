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

    @Test
    @DisplayName("Simultaneous duplicate creation requests with identical key never create duplicate work items or return 500")
    void testSimultaneousDuplicateCreateRequests() throws Exception {
        String sharedKey = "simultaneous-key-" + UUID.randomUUID();

        CreateWorkItemRequest payload = new CreateWorkItemRequest(
                "Simultaneous Idempotency Race Test Item",
                "Testing concurrent identical submissions",
                WorkItemType.TASK,
                WorkItemPriority.HIGH,
                "Core Engine",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );

        int threadCount = 2;
        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(threadCount);
        java.util.concurrent.CountDownLatch readyLatch = new java.util.concurrent.CountDownLatch(threadCount);
        java.util.concurrent.CountDownLatch startLatch = new java.util.concurrent.CountDownLatch(1);

        java.util.List<Integer> statuses = java.util.Collections.synchronizedList(new java.util.ArrayList<>());
        java.util.List<String> bodies = java.util.Collections.synchronizedList(new java.util.ArrayList<>());

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await(5, java.util.concurrent.TimeUnit.SECONDS);
                    MvcResult res = mockMvc.perform(post("/api/work-items")
                                    .header("Idempotency-Key", sharedKey)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(objectMapper.writeValueAsString(payload)))
                            .andReturn();
                    statuses.add(res.getResponse().getStatus());
                    bodies.add(res.getResponse().getContentAsString());
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            });
        }

        readyLatch.await(5, java.util.concurrent.TimeUnit.SECONDS);
        startLatch.countDown();

        executor.shutdown();
        executor.awaitTermination(10, java.util.concurrent.TimeUnit.SECONDS);

        // Neither request must ever receive an unhandled 500 Internal Server Error
        assertThat(statuses).allMatch(s -> s == 201 || s == 409);
        assertThat(statuses).contains(201); // At least one succeeded

        // Extract the created ID
        String createdId = null;
        for (String body : bodies) {
            JsonNode node = objectMapper.readTree(body);
            if (node.has("id")) {
                createdId = node.get("id").asText();
                break;
            }
        }
        assertThat(createdId).isNotNull();

        // Verify only 1 CREATED activity log was committed
        MvcResult activityResult = mockMvc.perform(get("/api/work-items/" + createdId + "/activity"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode logs = objectMapper.readTree(activityResult.getResponse().getContentAsString()).get("content");
        assertThat(logs.size()).isEqualTo(1);
        assertThat(logs.get(0).get("actionType").asText()).isEqualTo("CREATED");
    }
}
