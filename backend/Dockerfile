# Multi-stage build for Newtonite Spring Boot Backend
# Stage 1: Build
FROM eclipse-temurin:25-jdk-noble AS builder
WORKDIR /workspace/app

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

COPY src/ src/
RUN ./mvnw clean package -DskipTests

# Stage 2: Production JRE
FROM eclipse-temurin:25-jre-noble
WORKDIR /app

RUN groupadd -r spring && useradd -r -g spring spring
USER spring:spring

COPY --from=builder /workspace/app/target/*.jar app.jar

ENV SERVER_PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseZGC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
