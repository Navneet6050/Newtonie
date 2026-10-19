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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class ConcurrentClaimingTests {

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

    @Test
    @DisplayName("Scenario 1: Concurrent claiming - exactly one succeeds, loser receives 409 Conflict")
    void testConcurrentClaiming() throws Exception {
        // 1. Create an unassigned work item
        CreateWorkItemRequest request = new CreateWorkItemRequest(
                "Unassigned concurrent claim test item",
                "Testing race conditions under simultaneous claim requests",
                WorkItemType.TASK,
                WorkItemPriority.URGENT,
                "Core Engine",
                TEAM_ACME_STUDIO_ID,
                null, // Unassigned!
                null
        );

        MvcResult createResult = mockMvc.perform(post("/api/work-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        String id = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asText();

        // 2. Launch two concurrent claim requests simultaneously
        int threadCount = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        List<Integer> statusCodes = Collections.synchronizedList(new ArrayList<>());
        List<String> responseBodies = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await(5, TimeUnit.SECONDS);
                    MvcResult result = mockMvc.perform(post("/api/work-items/" + id + "/claim")).andReturn();
                    statusCodes.add(result.getResponse().getStatus());
                    responseBodies.add(result.getResponse().getContentAsString());
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            });
        }

        // Wait for both worker threads to be ready, then trigger them simultaneously
        boolean ready = readyLatch.await(5, TimeUnit.SECONDS);
        assertThat(ready).isTrue();
        startLatch.countDown();

        executor.shutdown();
        boolean finished = executor.awaitTermination(10, TimeUnit.SECONDS);
        assertThat(finished).isTrue();

        // 3. Verify that exactly one returned 200 OK and exactly one returned 409 Conflict
        assertThat(statusCodes).containsExactlyInAnyOrder(200, 409);

        // 4. Verify that the conflict response contains a clear conflict error
        String conflictBody = responseBodies.stream()
                .filter(b -> b.contains("already") || b.contains("concurrently") || b.contains("Conflict"))
                .findFirst()
                .orElse("");
        assertThat(conflictBody).isNotBlank();

        // 5. Verify database state: item has a consistent assignee
        MvcResult getResult = mockMvc.perform(get("/api/work-items/" + id))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode itemJson = objectMapper.readTree(getResult.getResponse().getContentAsString());
        assertThat(itemJson.get("assignee").isNull()).isFalse();
        assertThat(itemJson.get("assignee").get("name").asText()).isEqualTo("Alex Morgan");

        // 6. Verify activity history: contains exactly ONE CLAIMED record (no duplicate successful-claim logs)
        MvcResult activityResult = mockMvc.perform(get("/api/work-items/" + id + "/activity"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode activityLogs = objectMapper.readTree(activityResult.getResponse().getContentAsString()).get("content");
        long claimCount = 0;
        for (JsonNode log : activityLogs) {
            if ("CLAIMED".equals(log.get("actionType").asText())) {
                claimCount++;
            }
        }
        assertThat(claimCount).isEqualTo(1L);
    }
}
