FROM maven:3.9.11-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -B package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /workspace/target/dna-sequence-analyzer-1.0.0.jar /app/app.jar
ENV PORT=5173
EXPOSE 5173
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
