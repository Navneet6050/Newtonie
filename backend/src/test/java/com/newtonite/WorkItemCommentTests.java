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
public class WorkItemCommentTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestTokenProvider tokenProvider;

    private static final UUID TEAM_ACME_STUDIO_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private UUID createStudioWorkItem(String title) throws Exception {
        String sarahAuth = tokenProvider.sarahChenToken();
        CreateWorkItemRequest req = new CreateWorkItemRequest(
                title,
                "Description for comment test item",
                WorkItemType.INCIDENT,
                WorkItemPriority.HIGH,
                "Checkout Flow",
                TEAM_ACME_STUDIO_ID,
                null,
                null
        );

        MvcResult result = mockMvc.perform(post("/api/work-items")
                        .header("Authorization", sarahAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return UUID.fromString(json.get("id").asText());
    }

    @Test
    @DisplayName("Authorized team member can add and view persistent comments")
    void testAddAndViewCommentsByTeamMember() throws Exception {
        UUID workItemId = createStudioWorkItem("Comment Flow Test Item");
        String sarahAuth = tokenProvider.sarahChenToken();

        CreateCommentRequest commentReq = new CreateCommentRequest("Triaging issue: reproduction confirmed on staging.");

        mockMvc.perform(post("/api/work-items/" + workItemId + "/comments")
                        .header("Authorization", sarahAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commentReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.authorName").value("Sarah Chen"))
                .andExpect(jsonPath("$.content").value("Triaging issue: reproduction confirmed on staging."))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        mockMvc.perform(get("/api/work-items/" + workItemId + "/comments")
                        .header("Authorization", sarahAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].authorName").value("Sarah Chen"))
                .andExpect(jsonPath("$[0].content").value("Triaging issue: reproduction confirmed on staging."));
    }

    @Test
    @DisplayName("Cross-team member is forbidden from viewing or adding comments")
    void testCrossTeamCommentForbidden() throws Exception {
        UUID workItemId = createStudioWorkItem("Cross-team Isolation Test Item");
        String liamAuth = tokenProvider.liamVanceToken(); // Acme Platform member, not Acme Studio

        CreateCommentRequest commentReq = new CreateCommentRequest("Unauthorized external comment");

        mockMvc.perform(post("/api/work-items/" + workItemId + "/comments")
                        .header("Authorization", liamAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commentReq)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/work-items/" + workItemId + "/comments")
                        .header("Authorization", liamAuth))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Admin can comment across team boundaries")
    void testAdminCrossTeamCommentAllowed() throws Exception {
        UUID workItemId = createStudioWorkItem("Admin Cross Team Comment Item");
        String adminAuth = tokenProvider.alexMorganToken();

        CreateCommentRequest commentReq = new CreateCommentRequest("Admin global audit note: approved for hotfix.");

        mockMvc.perform(post("/api/work-items/" + workItemId + "/comments")
                        .header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commentReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.authorName").value("Alex Morgan"))
                .andExpect(jsonPath("$.content").value("Admin global audit note: approved for hotfix."));
    }

    @Test
    @DisplayName("Empty or blank comment is rejected with 400 Bad Request")
    void testBlankCommentRejected() throws Exception {
        UUID workItemId = createStudioWorkItem("Validation Test Item");
        String sarahAuth = tokenProvider.sarahChenToken();

        CreateCommentRequest blankReq = new CreateCommentRequest("   ");

        mockMvc.perform(post("/api/work-items/" + workItemId + "/comments")
                        .header("Authorization", sarahAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(blankReq)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Adding a comment logs an activity log entry")
    void testCommentLogsActivity() throws Exception {
        UUID workItemId = createStudioWorkItem("Activity Log Test Item");
        String sarahAuth = tokenProvider.sarahChenToken();

        CreateCommentRequest commentReq = new CreateCommentRequest("Testing audit activity generation");

        mockMvc.perform(post("/api/work-items/" + workItemId + "/comments")
                        .header("Authorization", sarahAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commentReq)))
                .andExpect(status().isCreated());

        MvcResult result = mockMvc.perform(get("/api/work-items/" + workItemId + "/activity")
                        .header("Authorization", sarahAuth))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode items = json.get("content");
        boolean foundCommentActivity = false;
        for (JsonNode item : items) {
            if ("COMMENT_ADDED".equals(item.get("actionType").asText())) {
                foundCommentActivity = true;
                break;
            }
        }
        assertThat(foundCommentActivity).isTrue();
    }
}
