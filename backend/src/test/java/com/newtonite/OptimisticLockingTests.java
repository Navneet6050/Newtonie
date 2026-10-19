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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class OptimisticLockingTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final UUID TEAM_ACME_STUDIO_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    @Test
    @DisplayName("Scenario 2: Stale concurrent update - rejects stale write with 409 Conflict and preserves winner state")
    void testStaleConcurrentUpdateRejection() throws Exception {
        // 1. Create a work item (initial version = 0)
        CreateWorkItemRequest request = new CreateWorkItemRequest(
                "Initial Title for Concurrency Test",
                "Baseline description for version testing",
                WorkItemType.BUG,
                WorkItemPriority.HIGH,
                "Security Gateway",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );

        MvcResult createResult = mockMvc.perform(post("/api/work-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode initialJson = objectMapper.readTree(createResult.getResponse().getContentAsString());
        String id = initialJson.get("id").asText();
        long initialVersion = initialJson.get("version").asLong();
        assertThat(initialVersion).isEqualTo(0L);

        // 2. Both Client A and Client B read the current item at version 0
        MvcResult readResultA = mockMvc.perform(get("/api/work-items/" + id)).andExpect(status().isOk()).andReturn();
        long versionReadByA = objectMapper.readTree(readResultA.getResponse().getContentAsString()).get("version").asLong();

        MvcResult readResultB = mockMvc.perform(get("/api/work-items/" + id)).andExpect(status().isOk()).andReturn();
        long versionReadByB = objectMapper.readTree(readResultB.getResponse().getContentAsString()).get("version").asLong();

        assertThat(versionReadByA).isEqualTo(0L);
        assertThat(versionReadByB).isEqualTo(0L);

        // 3. Client A updates title with expectedVersion = 0 -> succeeds
        UpdateWorkItemRequest updateA = new UpdateWorkItemRequest();
        updateA.setTitle("Client A Successful Title Update");
        updateA.setExpectedVersion(versionReadByA);

        MvcResult resultA = mockMvc.perform(patch("/api/work-items/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Client A Successful Title Update"))
                .andReturn();

        long versionAfterA = objectMapper.readTree(resultA.getResponse().getContentAsString()).get("version").asLong();
        assertThat(versionAfterA).isGreaterThan(0L);

        // 4. Client B attempts update with stale expectedVersion = 0 (or If-Match: "0")
        UpdateWorkItemRequest updateB = new UpdateWorkItemRequest();
        updateB.setTitle("Client B Stale Title Overwrite Attempt");
        updateB.setExpectedVersion(versionReadByB); // 0 (now stale!)

        mockMvc.perform(patch("/api/work-items/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateB)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value(containsString("version conflict")));

        // 5. Also test If-Match header with stale version
        UpdateWorkItemRequest updateC = new UpdateWorkItemRequest();
        updateC.setTitle("Client C Header Stale Attempt");

        mockMvc.perform(patch("/api/work-items/" + id)
                        .header("If-Match", "0") // Stale!
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateC)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        // 6. Verify database state: Client A's title is preserved intact
        MvcResult finalRead = mockMvc.perform(get("/api/work-items/" + id))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode finalJson = objectMapper.readTree(finalRead.getResponse().getContentAsString());
        assertThat(finalJson.get("title").asText()).isEqualTo("Client A Successful Title Update");

        // 7. Verify activity history: only CREATED and Client A's TITLE_CHANGED exist (no entry for Client B or C)
        MvcResult activityResult = mockMvc.perform(get("/api/work-items/" + id + "/activity"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode activityLogs = objectMapper.readTree(activityResult.getResponse().getContentAsString()).get("content");
        assertThat(activityLogs.size()).isEqualTo(2); // 1 CREATED + 1 TITLE_CHANGED
        assertThat(activityLogs.get(0).get("toValue").asText()).isEqualTo("Client A Successful Title Update");
    }
}
