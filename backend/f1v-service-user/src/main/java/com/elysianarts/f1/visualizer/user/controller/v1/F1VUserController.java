package com.elysianarts.f1.visualizer.user.controller.v1;

import com.elysianarts.f1.visualizer.user.firestore.document.F1VUserDocument;
import com.elysianarts.f1.visualizer.user.service.F1VUserService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/users")
public class F1VUserController {
    private static final Logger log = LoggerFactory.getLogger(F1VUserController.class);
    private final F1VUserService f1VUserService;

    public F1VUserController(F1VUserService f1VUserService) {
        this.f1VUserService = f1VUserService;
    }

    @GetMapping("/me")
    public ResponseEntity<F1VUserDocument> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        String authSubId = requireSubject(jwt);
        String email = jwt.getClaimAsString("email");

        if (email == null || email.isBlank()) {
            log.warn(
                    "jwt missing claim=email subject={} — the Auth0 Post-Login Action must add it to"
                            + " the access token",
                    authSubId);
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "The access token is missing the 'email' claim.");
        }

        return ResponseEntity.ok(f1VUserService.getOrCreateUser(authSubId, email));
    }

    @PutMapping("/me/preferences")
    public ResponseEntity<F1VUserDocument> updatePreferences(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody F1VUserDocument.UserPreferences preferences) {

        F1VUserDocument updatedUser =
                f1VUserService.updatePreferences(requireSubject(jwt), preferences);
        return ResponseEntity.ok(updatedUser);
    }

    /**
     * The subject, or a 400.
     *
     * <p>{@code Jwt.getSubject()} is nullable, and both handlers passed the result straight to
     * Firestore as a document id — so a token without a {@code sub} claim would have keyed a
     * document on null. SpotBugs found this; the controller already refused a token with no {@code
     * email}, and a missing subject deserves the same treatment.
     */
    private String requireSubject(Jwt jwt) {
        String authSubId = jwt.getSubject();
        if (authSubId == null || authSubId.isBlank()) {
            log.warn("jwt missing claim=sub — refusing to key a user document on it");
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "The access token is missing the 'sub' claim.");
        }
        return authSubId;
    }
}
