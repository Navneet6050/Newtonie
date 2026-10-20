package com.newtonite.workitem.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCommentRequest(
        @NotBlank(message = "Comment content cannot be empty")
        @Size(max = 5000, message = "Comment content cannot exceed 5000 characters")
        String content
) {
}
