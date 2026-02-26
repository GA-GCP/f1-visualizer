package com.elysianarts.f1.visualizer.user;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {
        "com.elysianarts.f1.visualizer.user",
        "com.elysianarts.f1.visualizer.user.config",
        "com.elysianarts.f1.visualizer.commons"
})
public class F1VUserServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(F1VUserServiceApplication.class, args);
    }
}
