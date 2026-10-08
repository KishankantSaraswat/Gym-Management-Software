# scaling

## 1. Scalability Milestone Architecture

```text
                 100M+ USERS
                      │
                      ▼
             CDN / CLOUDFLARE WAF
                      │
                      ▼
               LOAD BALANCER
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
   API CLUSTER (Node.js)       API CLUSTER (Node.js)
   (Stateless, Horizontal)     (Stateless, Horizontal)
        │                           │
        └─────────────┬─────────────┘
                      │
               REDIS CLUSTER
        (Auth Cache + Rate Limiting)
                      │
                      ▼
           POSTGRESQL CLUSTER (PgBouncer)
             ┌────────┴────────┐
             ▼                 ▼
          PRIMARY          READ REPLICAS
        (Write Master)    (Analytics & Read Queries)
```

---

## 2. Key Scaling Strategies

### A. Stateless API Scaling
- Node.js API instances store zero session state in local memory.
- Every node accesses Redis Cluster for authorization contexts and sessions.
- Horizontal autoscaling based on CPU utilization and request throughput.

### B. High-Volume Table Partitioning
For high-volume tables that grow to tens of millions of rows:
- `user_gym_logs` (Attendance): Partitioned by range on `startingDate` (Monthly partitions).
- `wallet_transactions` & `payments`: Partitioned by range on `transactionDate` (Monthly partitions).
- `audit_log`: Partitioned by range on `created_at` (Monthly partitions).
- **Rule:** Do NOT blindly partition `users` / `user_master`—use indexed B-trees on `id`, `phone`, and `email`.

### C. Database Connection Pooling (PgBouncer)
- Connection pooling with transaction-level pooling prevents PostgreSQL connection exhaustion.
- Primary instance handles writes (INSERT/UPDATE/DELETE).
- Read replicas handle read-heavy analytics (`GET /dashboard/revenue`, `GET /admin/stats`).

### D. Asynchronous Background Queues (BullMQ / Redis Streams)
- Push notifications, Brevo/Nodemailer transactional emails, and Razorpay webhook processing are offloaded to background worker queues.
- API response times remain strictly under 50ms.