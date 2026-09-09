# syntax=docker/dockerfile:1
# ==========================================
# Base images, pinned by digest.
# ==========================================
# `eclipse-temurin:25-jdk` and `gcr.io/distroless/java25-debian13` are floating
# tags: two builds of the same commit could compile against a different JDK
# patch and run on a different base. The tag is kept beside the digest for
# readability; the digest is what resolves (S8).
#
# Dockerfile.ci pins the same RUNTIME_IMAGE and the two must move together —
# that is the image production actually runs.
ARG BUILD_IMAGE=eclipse-temurin:25.0.4_7-jdk@sha256:e787e08ef76f4c16866108cd7f9fcd96a68eef3ac6cc76866897d4d02d5a2262
ARG RUNTIME_IMAGE=gcr.io/distroless/java25-debian13:nonroot@sha256:fce4a1d66284e8866c46113d9bdc286c46fb8c3c3f0a098f877034349e88debe

# ==========================================
# STAGE 1: Build & Layer Extraction
# ==========================================
FROM ${BUILD_IMAGE} AS builder

WORKDIR /app

# O1: the Maven wrapper, not whatever Maven the base image's apt repo happens to
# ship. `apt-get install maven` pulled a different Maven for every rebuild of the
# same commit, and a different one again from what CI used.
COPY mvnw ./
COPY .mvn .mvn

# The POMs first, on their own layer: dependency resolution is then cached until
# a POM actually changes, instead of re-downloading the world on every source
# edit (O1). The BuildKit cache mount keeps ~/.m2 across builds as well.
COPY pom.xml ./
COPY f1v-commons-web/pom.xml f1v-commons-web/
COPY f1v-commons-gcp/pom.xml f1v-commons-gcp/
COPY f1v-commons-messaging/pom.xml f1v-commons-messaging/
COPY f1v-commons-openf1/pom.xml f1v-commons-openf1/
COPY f1v-service-data-analysis/pom.xml f1v-service-data-analysis/
COPY f1v-service-data-ingestion/pom.xml f1v-service-data-ingestion/
COPY f1v-service-telemetry/pom.xml f1v-service-telemetry/
COPY f1v-service-user/pom.xml f1v-service-user/

ARG MODULE
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -pl ${MODULE} -am dependency:go-offline -DskipTests

COPY . .

RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B clean package -pl ${MODULE} -am -DskipTests

# Extract the JAR layers
# jarmode=tools, not layertools: Boot 4 removed the layertools jarmode.
WORKDIR /app/${MODULE}
RUN java -Djarmode=tools -jar target/*.jar extract --layers --launcher --destination .

# ==========================================
# STAGE 2: Run in Distroless (Production)
# ==========================================
# The :nonroot variant runs as uid 65532 instead of root. Nothing here writes to
# the filesystem, so there is no reason for the runtime to be able to (S8).
FROM ${RUNTIME_IMAGE}

WORKDIR /app

ARG MODULE

# 1. Copy the extracted layers
COPY --from=builder /app/${MODULE}/dependencies/ ./
COPY --from=builder /app/${MODULE}/spring-boot-loader/ ./
COPY --from=builder /app/${MODULE}/snapshot-dependencies/ ./
COPY --from=builder /app/${MODULE}/application/ ./

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

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
