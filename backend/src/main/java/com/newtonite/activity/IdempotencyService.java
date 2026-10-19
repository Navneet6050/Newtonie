package com.newtonite.activity;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.newtonite.common.error.IdempotencyConflictException;
import com.newtonite.workitem.dto.WorkItemResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyService.class);

    private final IdempotencyRecordRepository idempotencyRecordRepository;
    private final ObjectMapper objectMapper;

    public IdempotencyService(IdempotencyRecordRepository idempotencyRecordRepository, ObjectMapper objectMapper) {
        this.idempotencyRecordRepository = idempotencyRecordRepository;
        this.objectMapper = objectMapper;
    }

    public String computePayloadHash(Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(json.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to serialize request payload for idempotency check", e);
        }
    }

    @Transactional(readOnly = true)
    public Optional<WorkItemResponse> getCachedResponse(String key, String requestHash) {
        if (key == null || key.isBlank()) {
            return Optional.empty();
        }

        Optional<IdempotencyRecord> recordOpt = idempotencyRecordRepository.findById(key);
        if (recordOpt.isEmpty()) {
            return Optional.empty();
        }

        IdempotencyRecord record = recordOpt.get();
        if (!record.getRequestHash().equals(requestHash)) {
            throw new IdempotencyConflictException(
                    String.format("Idempotency key '%s' was previously used with a different request payload", key)
            );
        }

        try {
            WorkItemResponse response = objectMapper.readValue(record.getResponseBody(), WorkItemResponse.class);
            return Optional.of(response);
        } catch (Exception e) {
            log.error("Failed to deserialize idempotency record body for key {}", key, e);
            return Optional.empty();
        }
    }

    @Transactional
    public void recordSuccess(String key, String endpoint, String requestHash, int statusCode, WorkItemResponse response) {
        if (key == null || key.isBlank()) {
            return;
        }

        try {
            String bodyJson = objectMapper.writeValueAsString(response);
            IdempotencyRecord record = new IdempotencyRecord(
                    key,
                    endpoint,
                    requestHash,
                    statusCode,
                    bodyJson,
                    Instant.now().plus(Duration.ofDays(1))
            );
            idempotencyRecordRepository.save(record);
        } catch (DataIntegrityViolationException ex) {
            log.info("Concurrent idempotency record insertion detected for key {}", key);
        } catch (Exception e) {
            log.warn("Failed to record idempotency for key {}", key, e);
        }
    }
}
