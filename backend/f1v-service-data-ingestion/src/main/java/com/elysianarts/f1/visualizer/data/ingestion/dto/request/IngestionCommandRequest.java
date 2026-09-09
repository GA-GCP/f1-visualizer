package com.elysianarts.f1.visualizer.data.ingestion.dto.request;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.constant.IngestionMode;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * C8: validated by Bean Validation rather than by hand-written null checks in the controller. The
 * validation starter was already on the classpath and unused, and a failure now produces the same
 * RFC 9457 body as every other error (S5).
 */
@Data
@NoArgsConstructor
public class IngestionCommandRequest {

    @NotNull(message = "mode is required (LIVE or SIMULATION)")
    private IngestionMode mode;

    @NotNull(message = "sessionKey is required")
    private Long sessionKey;
}
