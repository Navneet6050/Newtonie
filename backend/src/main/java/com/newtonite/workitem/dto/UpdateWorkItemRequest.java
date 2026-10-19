package com.newtonite.workitem.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.newtonite.workitem.WorkItemPriority;
import com.newtonite.workitem.WorkItemStatus;
import com.newtonite.workitem.WorkItemType;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateWorkItemRequest {

    private Long expectedVersion;
    private String title;
    private String description;
    private WorkItemType type;
    private WorkItemPriority priority;
    private WorkItemStatus status;
    private UUID assigneeId;
    private Instant dueDate;
    private String systemArea;

    @JsonIgnore
    private final Set<String> presentFields = new HashSet<>();

    public UpdateWorkItemRequest() {
    }

    public Long getExpectedVersion() {
        return expectedVersion;
    }

    public void setExpectedVersion(Long expectedVersion) {
        this.expectedVersion = expectedVersion;
        this.presentFields.add("expectedVersion");
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
        this.presentFields.add("title");
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
        this.presentFields.add("description");
    }

    public WorkItemType getType() {
        return type;
    }

    public void setType(WorkItemType type) {
        this.type = type;
        this.presentFields.add("type");
    }

    public WorkItemPriority getPriority() {
        return priority;
    }

    public void setPriority(WorkItemPriority priority) {
        this.priority = priority;
        this.presentFields.add("priority");
    }

    public WorkItemStatus getStatus() {
        return status;
    }

    public void setStatus(WorkItemStatus status) {
        this.status = status;
        this.presentFields.add("status");
    }

    public UUID getAssigneeId() {
        return assigneeId;
    }

    public void setAssigneeId(UUID assigneeId) {
        this.assigneeId = assigneeId;
        this.presentFields.add("assigneeId");
    }

    public Instant getDueDate() {
        return dueDate;
    }

    public void setDueDate(Instant dueDate) {
        this.dueDate = dueDate;
        this.presentFields.add("dueDate");
    }

    public String getSystemArea() {
        return systemArea;
    }

    public void setSystemArea(String systemArea) {
        this.systemArea = systemArea;
        this.presentFields.add("systemArea");
    }

    public boolean isPresent(String fieldName) {
        return presentFields.contains(fieldName);
    }
}
