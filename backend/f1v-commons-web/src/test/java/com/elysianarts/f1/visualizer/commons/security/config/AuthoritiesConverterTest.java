package com.elysianarts.f1.visualizer.commons.security.config;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

/** S1: the mapping that decides who may rewrite the BigQuery reference tables. */
class AuthoritiesConverterTest {

    private final AuthoritiesConverter converter = new AuthoritiesConverter();

    private static Jwt jwt(Map<String, Object> claims) {
        Jwt.Builder builder =
                Jwt.withTokenValue("token")
                        .header("alg", "RS256")
                        .subject("auth0|user")
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(300));
        claims.forEach(builder::claim);
        return builder.build();
    }

    private List<String> authorityNames(Jwt jwt) {
        Collection<GrantedAuthority> authorities = converter.convert(jwt);
        return authorities.stream().map(GrantedAuthority::getAuthority).sorted().toList();
    }

    /** Auth0 RBAC permissions arrive already namespaced, so they carry no prefix. */
    @Test
    void permissionsBecomeAuthoritiesUnprefixed() {
        List<String> authorities =
                authorityNames(
                        jwt(Map.of("permissions", List.of("ingest:admin", "playback:control"))));

        assertEquals(List.of("ingest:admin", "playback:control"), authorities);
    }

    /** Scope-based rules keep working alongside the new permission-based ones. */
    @Test
    void scopesStillBecomeSCOPE_Authorities() {
        List<String> authorities = authorityNames(jwt(Map.of("scope", "read:laps write:laps")));

        assertEquals(List.of("SCOPE_read:laps", "SCOPE_write:laps"), authorities);
    }

    @Test
    void bothSourcesAreUnioned() {
        List<String> authorities =
                authorityNames(
                        jwt(Map.of("scope", "read:laps", "permissions", List.of("ingest:admin"))));

        assertEquals(List.of("SCOPE_read:laps", "ingest:admin"), authorities);
    }

    /**
     * A token from a tenant without RBAC enabled carries no permissions claim. It must produce no
     * authorities rather than failing — the request is then denied by the rule, which is the safe
     * direction.
     */
    @Test
    void aTokenWithNoPermissionsClaimYieldsNoAuthorities() {
        assertTrue(authorityNames(jwt(Map.of())).isEmpty());
    }

    @Test
    void nonStringPermissionsAreIgnoredRatherThanCrashing() {
        List<String> authorities =
                authorityNames(jwt(Map.of("permissions", List.of("ingest:admin", 42, true))));

        assertEquals(List.of("ingest:admin"), authorities);
    }

    @Test
    void aPermissionsClaimOfTheWrongShapeIsIgnored() {
        assertTrue(authorityNames(jwt(Map.of("permissions", "ingest:admin"))).isEmpty());
    }
}
