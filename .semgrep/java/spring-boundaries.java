import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SpringBoundariesTest {

    // ruleid: f1v-no-cross-origin-annotation
    @CrossOrigin(origins = "https://example.com")
    @GetMapping("/a")
    String annotated() {
        return "a";
    }

    // ok: f1v-no-cross-origin-annotation
    @GetMapping("/b")
    String plain() {
        return "b";
    }

    void authorization(Object auth) {
        // ruleid: f1v-permit-all-outside-commons
        auth.permitAll();
    }

    void logging(Exception e) {
        // ruleid: f1v-log-do-not-print
        System.out.println("started");
        // ruleid: f1v-log-do-not-print
        e.printStackTrace();
        // ok: f1v-log-do-not-print
        log.info("started");
    }
}
