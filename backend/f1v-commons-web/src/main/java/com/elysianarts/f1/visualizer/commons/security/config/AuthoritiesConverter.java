package com.elysianarts.f1.visualizer.commons.security.config;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

/**
 * Turns an Auth0 access token into authorities.
 *
 * <p>Spring's default converter reads the {@code scope}/{@code scp} claim and prefixes each value
 * with {@code SCOPE_}. With Auth0 RBAC enabled the API's permissions arrive in a separate top-level
 * {@code permissions} array, already namespaced as {@code ingest:admin}, and nothing was reading it
 * — which is why the codebase contained no authorization rule beyond "has a token" (S1).
 *
 * <p>Both sources are unioned so scope-based rules keep working alongside the new permission-based
 * ones.
 */
public class AuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    static final String PERMISSIONS_CLAIM = "permissions";

    private final JwtGrantedAuthoritiesConverter scopes = new JwtGrantedAuthoritiesConverter();

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        Collection<GrantedAuthority> authorities = new LinkedHashSet<>(scopes.convert(jwt));

        // Auth0 permissions are already namespaced, so they carry no prefix.
        Object claim = jwt.getClaim(PERMISSIONS_CLAIM);
        if (claim instanceof List<?> permissions) {
            permissions.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .map(SimpleGrantedAuthority::new)
                    .forEach(authorities::add);
        }
        return authorities;
    }
}
