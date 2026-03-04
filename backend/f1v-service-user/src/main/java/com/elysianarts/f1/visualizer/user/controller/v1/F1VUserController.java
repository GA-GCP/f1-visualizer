package com.elysianarts.f1.visualizer.user.controller.v1;

import com.elysianarts.f1.visualizer.user.firestore.document.F1VUserDocument;
import com.elysianarts.f1.visualizer.user.service.F1VUserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class F1VUserController {
    private final F1VUserService f1VUserService;

    public F1VUserController(F1VUserService f1VUserService) {
        this.f1VUserService = f1VUserService;
    }

    @GetMapping("/me")
    public ResponseEntity<F1VUserDocument> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        String authSubId = jwt.getSubject();
        String email = jwt.getClaimAsString("email");

        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().build();
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
