package com.elysianarts.f1.visualizer.user;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {
        "com.elysianarts.f1.visualizer.user",
        "com.elysianarts.f1.visualizer.commons"
})
public class F1VUserServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(F1VUserServiceApplication.class, args);
    }
}
