# deployment

This guide describes the production deployment topology, container configuration, connection pooling, Redis caching, zero-downtime release pipeline, and disaster recovery strategies for scaling GymOS to 100M+ users.

---

## 1. High-Level Production Topology

```text
               [ Cloudflare Edge / WAF / DDoS Protection ]
                                    │
                                    ▼
                 [ AWS ALB / Nginx Reverse Proxy ]
               SSL Termination / Global Rate Limiting
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
[ Node.js API Pod 1 ]      [ Node.js API Pod 2 ]      [ Node.js API Pod N ]
(Horizontally Scaled via Kubernetes / AWS ECS / PM2 Cluster)
         │                          │                          │
         ├──────────────────────────┴──────────────────────────┤
         │                                                     │
         ▼                                                     ▼
[ Redis Cluster / ElastiCache ]                        [ PgBouncer Pool ]
- Master / Replica Sentinel                            - Transaction pooling
- In-memory Authz & Session cache                      - 10,000 backend conn max
- <2ms latency target                                          │
                                                               ▼
                                                  [ AWS Aurora PostgreSQL ]
                                                  - Primary (Writes)
                                                  - Read Replicas (Reports & Analytics)
```

---

## 2. Docker Containerization

### 2.1 Production `Dockerfile`
```dockerfile
# Multi-stage build for minimal attack surface
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

FROM node:20-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=5000

# Non-root security user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /usr/src/app ./
USER appuser

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/ping || exit 1

CMD ["node", "server.js"]
```

### 2.2 Docker Compose (`docker-compose.prod.yml`)
```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DB_HOST=pgbouncer
      - DB_PORT=6432
      - DB_NAME=gymhood
      - DB_USER=gym_app
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "5000:5000"
    depends_on:
      - pgbouncer
      - redis

  pgbouncer:
    image: edoburu/pgbouncer:latest
    restart: always
    environment:
      - DB_USER=gym_app
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=gymhood
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=5000
      - DEFAULT_POOL_SIZE=50
    ports:
      - "6432:6432"
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      - POSTGRES_DB=gymhood
      - POSTGRES_USER=gym_app
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --maxmemory 4gb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

---

## 3. Database & Connection Sizing (PgBouncer)

For high-scale concurrent traffic (100M registered users, 50,000+ active gyms):

1. **Pool Mode**: `transaction`
   - Connections are returned to the pool immediately upon completion of each SQL transaction.
2. **Server Connection Allocation**:
   - `max_client_conn = 10000` (Handles 10,000 incoming HTTP worker connections).
   - `default_pool_size = 60` (Limits direct PostgreSQL connections to prevent CPU saturation).
   - `reserve_pool_size = 10`
   - `server_idle_timeout = 600`
3. **Read / Write Splitting**:
   - Write traffic routes to the PostgreSQL Primary database.
   - Read-heavy queries (e.g. member lookups, attendance history, reporting) route to Aurora Read Replicas using Sequelize replication options:
     ```javascript
     replication: {
       read: [{ host: process.env.DB_READ_HOST, ... }],
       write: { host: process.env.DB_WRITE_HOST, ... }
     }
     ```

---

## 4. Redis Cluster Architecture

1. **Authentication & Session Cache**:
   - Key: `session:<session_id>` (TTL 7 days).
   - Key: `authz:<user_id>:<gym_id>:<branch_id>` (TTL 15 minutes, invalidated instantly via `authz_version` bump).
2. **High Availability Configuration**:
   - Multi-AZ replication with Redis Sentinel or AWS ElastiCache Cluster mode.
   - Fallback protection: If Redis encounters transient network partitions, the Node.js `redisService.js` gracefully degrades to an in-memory `LRU` cache to prevent service interruption.

---

## 5. Zero-Downtime Deployment & Migration Pipeline

```text
Git Commit → CI Tests (Lint + Unit + Integration) → Pre-deployment Migration Script → Container Build → Canary Deployment → Health Check Verification → Full Traffic Switch
```

### Golden Migration Rules:
1. **Never use `sequelize.sync({ alter: true })` in production**: Table altering during live traffic risks table locks and data corruption.
2. **Additive-Only Migrations**:
   - Step 1: Add new nullable columns or tables (`database/migrations/...`).
   - Step 2: Deploy new backend code that writes to both old and new columns.
   - Step 3: Run data backfill script in batches of 5,000 records.
   - Step 4: Apply `NOT NULL` constraints and default values.
   - Step 5: Remove legacy fallback code in subsequent release.

---

## 6. Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | Port to listen on (e.g. `5000`) |
| `FRONTEND_URL` | Yes | Allowed CORS origin (e.g. `https://app.gymhood.com`) |
| `DB_HOST` | Yes | PostgreSQL / PgBouncer host |
| `DB_PORT` | Yes | Database port (e.g. `5432` or `6432`) |
| `DB_NAME` | Yes | Target database name (`gymhood`) |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `REDIS_HOST` | No | Redis host (default: `localhost`) |
| `REDIS_PORT` | No | Redis port (default: `6379`) |
| `REDIS_PASSWORD` | No | Redis auth password |
| `JWT_SECRET` | Yes | Cryptographic secret for signing session JWTs |
| `JWT_EXPIRES_IN`| No | Token expiry (default: `7d`) |
| `RAZORPAY_KEY_ID`| Optional | Payment gateway credentials |
| `RAZORPAY_KEY_SECRET`| Optional| Payment gateway secret |

---

## 7. Monitoring, Alerts & Health Checks

- **Liveness & Readiness**:
  - `GET /ping` checks process responsiveness.
  - Periodic background health check verifying DB connectivity and Redis ping.
- **Key Metrics (Prometheus / Datadog)**:
  - `http_request_duration_ms`: p95 < 50ms, p99 < 150ms.
  - `redis_cache_hit_rate`: Target > 95%.
  - `pgbouncer_used_pool_percentage`: Alert if > 80%.
  - `unauthorized_attempts_total`: Spike triggers automated IP rate-limiting.