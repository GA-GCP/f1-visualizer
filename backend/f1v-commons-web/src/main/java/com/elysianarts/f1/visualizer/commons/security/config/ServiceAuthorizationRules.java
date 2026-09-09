package com.elysianarts.f1.visualizer.commons.security.config;

import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;

/**
 * A service's own authorization rules, applied ahead of the shared catch-all.
 *
 * <p>The filter chain is defined once in commons, so without a hook like this the only rule any
 * service could express was {@code anyRequest().authenticated()} — which is how a signed-in user
 * came to be able to delete and rewrite BigQuery reference tables (S1). Declare a bean of this type
 * in a service to add rules that only make sense there; they run before {@code anyRequest()}, so
 * the catch-all still closes anything a service forgets.
 */
@FunctionalInterface
public interface ServiceAuthorizationRules
        extends Customizer<
                AuthorizeHttpRequestsConfigurer<HttpSecurity>
                        .AuthorizationManagerRequestMatcherRegistry> {}
