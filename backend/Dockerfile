# syntax=docker/dockerfile:1
# ==========================================
# Base images, pinned by digest.
# ==========================================
# `eclipse-temurin:25-jdk` and `gcr.io/distroless/java25-debian13` are floating
# tags: two builds of the same commit could compile against a different JDK
# patch and run on a different base. The tag is kept beside the digest for
# readability; the digest is what resolves (S8).
#
# Dockerfile.ci pins the same runtime image and the two must move together —
# that is the image production actually runs.
#
# The pins sit in the FROM lines themselves rather than in an `ARG X=...` above
# a `FROM ${X}`. Dependabot reads FROM lines as written and does not expand
# ARGs, so behind ARGs it found no base images at all and never proposed an
# update. Nothing passed those ARGs with --build-arg.

# ==========================================
# STAGE 1: Build & Layer Extraction
# ==========================================
FROM eclipse-temurin:25.0.5_8-jdk@sha256:83f4a7fc27df94dcc7b8de04d14cbbba8da14406f921e966969c3b09000aa507 AS builder

WORKDIR /app

# O1: the Maven wrapper, not whatever Maven the base image's apt repo happens to
# ship. `apt-get install maven` pulled a different Maven for every rebuild of the
# same commit, and a different one again from what CI used.
COPY mvnw ./
COPY .mvn .mvn

# The POMs first, on their own layer: dependency resolution is then cached until
# a POM actually changes, instead of re-downloading the world on every source
# edit (O1). The BuildKit cache mount keeps ~/.m2 across builds as well.
#
# Every <module> in pom.xml needs its POM here, not only the ones MODULE builds:
# Maven reads the whole reactor before `-pl` narrows it, and one missing POM
# fails every build with "Child module ... does not exist". The replay worker
# and f1v-coverage were added to the reactor without a line here, and this build
# failed for every MODULE until they were.
COPY pom.xml ./
COPY f1v-commons-web/pom.xml f1v-commons-web/
COPY f1v-commons-gcp/pom.xml f1v-commons-gcp/
COPY f1v-commons-messaging/pom.xml f1v-commons-messaging/
COPY f1v-commons-openf1/pom.xml f1v-commons-openf1/
COPY f1v-service-data-analysis/pom.xml f1v-service-data-analysis/
COPY f1v-service-data-ingestion/pom.xml f1v-service-data-ingestion/
COPY f1v-service-replay-worker/pom.xml f1v-service-replay-worker/
COPY f1v-service-telemetry/pom.xml f1v-service-telemetry/
COPY f1v-service-user/pom.xml f1v-service-user/
COPY f1v-coverage/pom.xml f1v-coverage/

ARG MODULE
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -pl ${MODULE} -am dependency:go-offline -DskipTests

COPY . .

RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B clean package -pl ${MODULE} -am -DskipTests

# Extract the JAR layers
# jarmode=tools, not layertools: Boot 4 removed the layertools jarmode.
#
# Into a folder of their own: the tools jarmode refuses a destination that is
# not empty, and the module's folder holds its sources and target/. Extracting
# there failed every build once the reactor above could be read at all. The PR
# check's image build extracts into an empty staging folder for the same reason.
RUN java -Djarmode=tools -jar ${MODULE}/target/*.jar extract --layers --launcher --destination /app/layers

# ==========================================
# STAGE 2: Run in Distroless (Production)
# ==========================================
# The :nonroot variant runs as uid 65532 instead of root. Nothing here writes to
# the filesystem, so there is no reason for the runtime to be able to (S8).
FROM gcr.io/distroless/java25-debian13:nonroot@sha256:8ac5525549d14b8ddd34562f9fc8e6ba4840c995363a1507b17cadf8bb7ab57e

WORKDIR /app

# 1. Copy the extracted layers
COPY --from=builder /app/layers/dependencies/ ./
COPY --from=builder /app/layers/spring-boot-loader/ ./
COPY --from=builder /app/layers/snapshot-dependencies/ ./
COPY --from=builder /app/layers/application/ ./

# ==========================================
# JVM options (P4)
# ==========================================
# The entrypoint passed none, so the heap was capped at the default 25% of
# container memory — about 128 MB on the 512Mi services — and an OutOfMemoryError
# left a wedged instance that still answered health checks instead of a restart
# Cloud Run could act on.
#
# AutoCreateSharedArchive writes a CDS archive on first start and reuses it on
# every later start of the same container, so a restart does not re-pay the full
# class-loading cost that startup_cpu_boost is there to mask.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError -XX:+AutoCreateSharedArchive -XX:SharedArchiveFile=/tmp/f1v-app.jsa"

EXPOSE 8080

# The base is gcr.io/distroless/java25-debian13:nonroot, whose default user is
# uid 65532 — there is no shell and no root to drop from. Semgrep cannot resolve
# a base image's default USER, so it reports the absent directive; an explicit
# `USER` here would restate what the tag already guarantees.
# nosemgrep: dockerfile.security.missing-user-entrypoint.missing-user-entrypoint
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
