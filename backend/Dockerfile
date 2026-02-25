# ==========================================
# STAGE 1: Build & Layer Extraction
# ==========================================
# Use the floating tag for Java 25
FROM eclipse-temurin:25-jdk AS builder

WORKDIR /app

# 1. Install Maven manually (since mvnw might be missing)
RUN apt-get update && apt-get install -y maven

# 2. Copy the entire build context
COPY . .

# 3. Build the specific module passed via build-arg
# Note: We use 'mvn' instead of './mvnw'
ARG MODULE
RUN mvn clean package -pl ${MODULE} -am -DskipTests

# 4. Extract the JAR layers
WORKDIR /app/${MODULE}
RUN java -Djarmode=layertools -jar target/*.jar extract

# ==========================================
# STAGE 2: Run in Distroless (Production)
# ==========================================
# FIX: Java 25 is only available on Debian 13 in Distroless
FROM gcr.io/distroless/java25-debian13

WORKDIR /app

# FIX: Re-declare ARG so it's visible in this stage
ARG MODULE

# 1. Copy the extracted layers
COPY --from=builder /app/${MODULE}/dependencies/ ./
COPY --from=builder /app/${MODULE}/spring-boot-loader/ ./
COPY --from=builder /app/${MODULE}/snapshot-dependencies/ ./
COPY --from=builder /app/${MODULE}/application/ ./

# 2. Default port
EXPOSE 8080

# 3. Launch
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]