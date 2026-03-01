package com.elysianarts.f1.visualizer.commons.service.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.HttpMessageConverters;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import tools.jackson.databind.json.JsonMapper;

@Configuration
public class Jackson3WebConfig implements WebMvcConfigurer {
    private final JsonMapper jsonMapper;

    public Jackson3WebConfig(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    public void configureMessageConverters(HttpMessageConverters.ServerBuilder builder) {
        builder.withJsonConverter(new JacksonJsonHttpMessageConverter(jsonMapper));
    }
}


