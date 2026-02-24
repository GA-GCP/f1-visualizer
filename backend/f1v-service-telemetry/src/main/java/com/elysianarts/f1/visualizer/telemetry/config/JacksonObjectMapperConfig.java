package com.elysianarts.f1.visualizer.telemetry.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import tools.jackson.databind.json.JsonMapper;

@Configuration
public class JacksonObjectMapperConfig {
    @Bean
    @Primary
    public JsonMapper jsonMapper() {
        return JsonMapper.builder()
                .build();
    }
}