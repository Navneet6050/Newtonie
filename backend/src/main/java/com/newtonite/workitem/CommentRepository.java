package com.newtonite.workitem;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CommentRepository extends JpaRepository<Comment, UUID> {

    @Query("SELECT c FROM Comment c JOIN FETCH c.author WHERE c.workItem.id = :workItemId ORDER BY c.createdAt ASC")
    List<Comment> findByWorkItemIdWithAuthorOrderByCreatedAtAsc(@Param("workItemId") UUID workItemId);
}
