package com.elysianarts.f1.visualizer.data.ingestion.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.library.Architectures;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * The commons layering, as a build failure rather than a convention (T3).
 *
 * <p>Ten commons modules became four, and the shape only holds if something checks it. This runs
 * from the ingestion service because that is the module that depends on all four, so all four are
 * on its classpath.
 */
class CommonsLayeringTest {

    private static final String COMMONS = "com.elysianarts.f1.visualizer.commons";
    private static final String SERVICES = "com.elysianarts.f1.visualizer.data..";

    private static JavaClasses classes;

    @BeforeAll
    static void importClasses() {
        classes =
                new ClassFileImporter()
                        .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                        .importPackages("com.elysianarts.f1.visualizer");
    }

    /** Shared code that knows about one of its consumers is not shared code. */
    @Test
    void commonsDoesNotDependOnAnyService() {
        noClasses()
                .that()
                .resideInAPackage(COMMONS + "..")
                .should()
                .dependOnClassesThat()
                .resideInAnyPackage(
                        SERVICES,
                        "com.elysianarts.f1.visualizer.replay..",
                        "com.elysianarts.f1.visualizer.telemetry..",
                        "com.elysianarts.f1.visualizer.user..")
                .because("commons is depended upon, not the other way round")
                .check(classes);
    }

    /**
     * The four modules are meant to be independent slices, not a chain. The one permitted edge is
     * that messaging and openf1 build on web, because both expose HTTP-adjacent configuration.
     */
    @Test
    void theCommonsModulesRespectTheirBoundaries() {
        Architectures.layeredArchitecture()
                .consideringOnlyDependenciesInLayers()
                .layer("web")
                .definedBy(COMMONS + ".security..", COMMONS + ".web..")
                .layer("gcp")
                .definedBy(COMMONS + ".gcp..")
                .layer("messaging")
                .definedBy(COMMONS + ".messaging..")
                .layer("openf1")
                .definedBy(COMMONS + ".api.openf1..")
                .whereLayer("gcp")
                .mayOnlyBeAccessedByLayers("web", "messaging", "openf1")
                .whereLayer("messaging")
                .mayOnlyBeAccessedByLayers("web")
                .whereLayer("openf1")
                .mayOnlyBeAccessedByLayers("web", "messaging")
                .check(classes);
    }

    /** The data-access layer has no business knowing about the transport. */
    @Test
    void gcpDoesNotDependOnMessagingOrOpenF1() {
        noClasses()
                .that()
                .resideInAPackage(COMMONS + ".gcp..")
                .should()
                .dependOnClassesThat()
                .resideInAnyPackage(COMMONS + ".messaging..", COMMONS + ".api.openf1..")
                .because("BigQuery and Firestore clients should not know how packets are published")
                .check(classes);
    }

    /** C7: spring-tx was a compile dependency with no transaction anywhere. */
    @Test
    void nothingUsesSpringTransactions() {
        noClasses()
                .that()
                .resideInAPackage("com.elysianarts.f1.visualizer..")
                .should()
                .dependOnClassesThat()
                .resideInAPackage("org.springframework.transaction..")
                .because("there are no transactions here; spring-tx was carried for nothing")
                .check(classes);
    }

    /** C3: WebFlux existed only to provide WebClient, and every call was blocked on. */
    @Test
    void nothingDependsOnWebFluxOrReactor() {
        noClasses()
                .that()
                .resideInAPackage("com.elysianarts.f1.visualizer..")
                .should()
                .dependOnClassesThat()
                .resideInAnyPackage("org.springframework.web.reactive..", "reactor.core..")
                .because("the services run on Tomcat and WebMvc; RestClient replaced WebClient")
                .check(classes);
    }
}
