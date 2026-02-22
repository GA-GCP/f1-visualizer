package com.elysianarts.f1.visualizer.user.controller.v1;

import com.elysianarts.f1.visualizer.user.firestore.document.F1UserDocument;
import com.elysianarts.f1.visualizer.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<F1UserDocument> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        String oktaSubId = jwt.getSubject();
        String email = jwt.getClaimAsString("email");

        F1UserDocument user = userService.getOrCreateUser(oktaSubId, email);
        return ResponseEntity.ok(user);
    }

    @PutMapping("/me/preferences")
    public ResponseEntity<F1UserDocument> updatePreferences(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody F1UserDocument.UserPreferences preferences) {

        String oktaSubId = jwt.getSubject();
        F1UserDocument updatedUser = userService.updatePreferences(oktaSubId, preferences);
        return ResponseEntity.ok(updatedUser);
    }
}
