package com.elysianarts.f1.visualizer.data.ingestion.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class IngestionWebConfig implements WebMvcConfigurer {

    private final PlaybackRateLimitInterceptor playbackRateLimitInterceptor;

    public IngestionWebConfig(PlaybackRateLimitInterceptor playbackRateLimitInterceptor) {
        this.playbackRateLimitInterceptor = playbackRateLimitInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(playbackRateLimitInterceptor)
                .addPathPatterns("/api/v1/ingestion/playback/**");
    }
}
