# Nova Loan Agent (TypeScript)

TypeScript implementation of the Nova Loan Agent — a drop-in replacement for the Python version with Netra JS SDK integration.

## Getting Started

### 1. Create the `.env` file

```bash
cp .env.example .env
```

Update the following values:

| Variable               | Description                                      | Required |
|------------------------|--------------------------------------------------|----------|
| `NETRA_API_KEY`        | Your Netra API key                               | Yes      |
| `NETRA_OTLP_ENDPOINT`  | Netra telemetry endpoint                         | Yes      |
| `OPENAI_API_KEY`       | Your OpenAI API key (or use LiteLLM instead)     | Yes*     |
| `LITELLM_API_KEY`      | Your LiteLLM API key (alternative to OpenAI)     | Yes*     |

> \* Provide at least one of `OPENAI_API_KEY` or `LITELLM_API_KEY`.

### 2. Run with Docker

```bash
docker compose up -d
```

Services:

- **Backend** — TypeScript/Hono server on [http://localhost:8001](http://localhost:8001)
- **Frontend** — Next.js app on [http://localhost:3001](http://localhost:3001)

### 3. Run Locally (Development)

**Backend:**

```bash
cd backend
npm install
npm run dev
```

The backend runs on port **8001**.

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on port **3001** (or default Next.js port 3000).

### Stopping

```bash
docker compose down
```

```bash
# Run a simulation
npm run simulation <dataset-id>

# Run an evaluation
npm run evaluation <dataset-id>
```

## Ports

This implementation uses different ports so it can run alongside the Python version:

| Service  | Python Version | TypeScript Version |
|----------|---------------|-------------------|
| Backend  | 8000          | 8001              |
| Frontend | 3000          | 3001              |
