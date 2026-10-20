package com.newtonite.workitem.dto;

import com.newtonite.workitem.Comment;

import java.time.Instant;
import java.util.UUID;

public record CommentResponse(
        UUID id,
        UUID workItemId,
        UUID authorId,
        String authorName,
        String authorEmail,
        String authorInitials,
        String content,
        Instant createdAt,
        Instant updatedAt
) {
    public static CommentResponse from(Comment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getWorkItem().getId(),
                comment.getAuthor().getId(),
                comment.getAuthor().getName(),
                comment.getAuthor().getEmail(),
                comment.getAuthor().getAvatarInitials(),
                comment.getContent(),
                comment.getCreatedAt(),
                comment.getUpdatedAt()
        );
    }
}
