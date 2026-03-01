package com.elysianarts.f1.visualizer.data.ingestion.dto.request;

import com.elysianarts.f1.visualizer.commons.api.openf1.dto.constant.IngestionMode;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class IngestionCommandRequest {
    private IngestionMode mode;
    private Long sessionKey;
}
