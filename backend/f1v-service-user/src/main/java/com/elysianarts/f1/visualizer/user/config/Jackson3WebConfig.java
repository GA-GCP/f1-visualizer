package com.elysianarts.f1.visualizer.user.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.HttpMessageConverters;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import tools.jackson.databind.json.JsonMapper;

@Configuration
public class Jackson3WebConfig implements WebMvcConfigurer {
    // 1. Define as JsonMapper
    private final JsonMapper jsonMapper;

    // 2. Inject JsonMapper
    public Jackson3WebConfig(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    public void configureMessageConverters(HttpMessageConverters.ServerBuilder builder) {
        // 3. Pass it to the converter (which expects JsonMapper)
        builder.withJsonConverter(new JacksonJsonHttpMessageConverter(jsonMapper));
    }
}
