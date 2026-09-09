package com.elysianarts.f1.visualizer.data.analysis.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

@Configuration
public class WebConfig {

    /**
     * P5: reference data carried no validator, so a client that already had the
     * current catalog re-downloaded it in full. With an ETag the same request
     * becomes a 304 and no body crosses the wire.
     */
    @Bean
    public FilterRegistrationBean<ShallowEtagHeaderFilter> etagFilter() {
        FilterRegistrationBean<ShallowEtagHeaderFilter> registration =
                new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
        registration.addUrlPatterns("/api/v1/analysis/*");
        registration.setName("etagFilter");
        return registration;
    }
}
