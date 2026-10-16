# Helix/Lab — DNA Sequence Similarity Analyzer

Spring Boot / Java 17+ application for a Design and Analysis of Algorithms project. It calculates LCS and unit-cost Levenshtein edit distance using memoized, full-table, and rolling-row dynamic programming implementations.

## Run

```powershell
$mvn = Join-Path $env:TEMP 'apache-maven-3.9.11\bin\mvn.cmd'
& $mvn spring-boot:run
```

The application serves both the frontend and API at `http://localhost:5173`. The command above uses the local Maven distribution used to build this workspace; if Maven is installed on your machine, `mvn spring-boot:run` works as well.

## Online deployment

The project includes a Dockerfile and Render Blueprint. Push this folder to a Git repository you control, connect that repository in Render, and create a new Blueprint from `render.yaml`. Render builds the Java service and serves the frontend and API from the same public URL. The service listens on Render's `PORT` value and defaults to port 5173 locally.

### Vercel frontend + Java backend

Vercel serves the static frontend and a small Node.js API proxy; the Spring Boot Java service remains the algorithm backend on Render. Vercel's official function runtimes do not include Java, so the Spring Boot process itself is not deployed to Vercel.

1. Deploy the Render Blueprint above and copy the backend's public HTTPS origin (for example, `https://your-service.onrender.com`).
2. Import this repository into Vercel. The root `vercel.json` publishes `src/main/resources/static` and deploys `api/[...path].js` as the API proxy.
3. In Vercel project settings, add the environment variable `BACKEND_URL` with the backend origin only (no trailing slash and no `/api`).
4. Redeploy Vercel. The frontend continues calling `/api/*`; Vercel forwards those requests to the Java backend.

The local Spring Boot app remains self-contained and does not use the Vercel proxy. If `BACKEND_URL` is not set in Vercel, API calls return a clear 503 response until the backend is configured.

The Blueprint selects Render's free plan in Singapore. Free services can have provider-specific availability and startup limitations; see the [Render web service documentation](https://render.com/docs/web-services) before relying on it for continuous availability.

## Features

- Real API-driven analysis, traceback reconstruction, position mapping, edit scripts, and defined similarity metrics.
- Validation of IUPAC DNA input; whitespace normalization; FASTA endpoint (`POST /api/fasta` with `{"content":"..."}`).
- Animated, bounded DP traces for sequences of 30 bases or fewer; full tables remain inspectable.
- Real Java benchmark measurements with warm-up and CSV export.
- Tests for algorithm agreement, empty input, validation, normalization and trace construction.

See [project report](docs/project-report.md), [presentation outline](docs/presentation-outline.md), and [test data](test-data/example.fasta).
