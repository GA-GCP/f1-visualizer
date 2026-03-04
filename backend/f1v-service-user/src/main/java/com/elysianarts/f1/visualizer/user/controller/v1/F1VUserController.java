package com.elysianarts.f1.visualizer.user.controller.v1;

import com.elysianarts.f1.visualizer.user.firestore.document.F1VUserDocument;
import com.elysianarts.f1.visualizer.user.service.F1VUserService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/users")
public class F1VUserController {
    private static final Logger log = LoggerFactory.getLogger(F1VUserController.class);
    private final F1VUserService f1VUserService;

    public F1VUserController(F1VUserService f1VUserService) {
        this.f1VUserService = f1VUserService;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        String authSubId = jwt.getSubject();
        String email = jwt.getClaimAsString("email");

        if (email == null || email.isBlank()) {
            log.warn("JWT for subject '{}' is missing the 'email' claim. "
                    + "Ensure the Auth0 Post-Login Action includes email in the access token.", authSubId);
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "JWT missing 'email' claim. Configure Auth0 Post-Login Action to include email in access token.",
                    "status", 400
            ));
        }

        F1VUserDocument user = f1VUserService.getOrCreateUser(authSubId, email);
        return ResponseEntity.ok(user);
    }

    @PutMapping("/me/preferences")
    public ResponseEntity<F1VUserDocument> updatePreferences(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody F1VUserDocument.UserPreferences preferences) {

        String authSubId = jwt.getSubject();
        F1VUserDocument updatedUser = f1VUserService.updatePreferences(authSubId, preferences);
        return ResponseEntity.ok(updatedUser);
    }
}
