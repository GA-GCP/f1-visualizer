package com.elysianarts.f1.visualizer.data.ingestion.model.request;

import com.elysianarts.f1.visualizer.data.ingestion.model.constant.IngestionMode;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class IngestionCommandRequest {
    private IngestionMode mode;
    private Long sessionKey;
}
