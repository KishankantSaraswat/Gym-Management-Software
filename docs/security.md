# security

## 1. Security Checklist

- [x] **Password Hashing:** Argon2 / Bcrypt with salt rounds = 10.
- [x] **Rate Limiting:** IP and user-based limits on login, OTP, and registration endpoints.
- [x] **Compact JWT Validation:** Cryptographic verification, expiration check, signature tampering checks.
- [x] **Session Revocation:** Server-side revocation support via `user_session`.
- [x] **IDOR Prevention:** Tenant and resource ownership checks on all parameterized endpoints (`assertTenantOwnership`, `assertBranchAccess`).
- [x] **Tenant Boundary Isolation:** Scoped queries with `WHERE gym_id = :gymId`.
- [x] **RBAC Guards:** Action-level permissions enforcement (`requirePermissions`).
- [x] **Subscription Feature Gating:** Features verified against tenant subscription plan before execution.
- [x] **SQL Injection Prevention:** Parameterized SQL queries via Sequelize replacements.
- [x] **Audit Logging:** Structured audit trails for logins, logouts, role changes, cash approvals, branch creations.
- [x] **Secrets Management:** Secrets loaded from environment variables, never committed to repository.
- [x] **CORS Configuration:** Explicit origin whitelisting with `credentials: true`.

---

## 2. PostgreSQL Row-Level Security (RLS) Defense-in-Depth

For enterprise-grade tenant isolation, database-level RLS can be enabled on sensitive tables:

```sql
-- Enable RLS on user_plans
ALTER TABLE "user_plans" ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant isolation
CREATE POLICY tenant_isolation_policy ON "user_plans"
  FOR ALL
  USING (gym_id = current_setting('app.current_gym_id')::INTEGER);
```
RLS acts as an additional defense layer beneath application-level authorization.