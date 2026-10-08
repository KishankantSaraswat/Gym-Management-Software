# authentication

## 1. Authentication Flow

Clients authenticate using Email + Password or Phone Number or Google OAuth:

```text
Credentials (Email/Phone + Password/OTP)
   │
   ▼
users (Identity Check)
   │
   ▼
gym_user (Tenant Memberships Lookup)
   │
   ├── If 1 Gym: Auto-select gym & primary branch
   └── If >1 Gyms: Return gym selection list
   │
   ▼
user_session (Generate UUID session_id)
   │
   ▼
Compact JWT Token Generation (Expires in 7 days)
```

---

## 2. Compact JWT Specification

Unlike unscalable architectures that bloat JWTs with hundreds of permissions, AI Gym OS uses a **compact, high-performance JWT**:

```json
{
  "sub": "100001",
  "gym_id": "501",
  "branch_id": "5001",
  "session_id": "b6339e28-5414-447d-9abc-f51f8255560c",
  "authz_version": 1,
  "iat": 1728345600,
  "exp": 1728950400
}
```

### Why Compact JWT?
- **Small Header Size:** Under 300 bytes, minimizing mobile network overhead.
- **Fast Parsing:** Microseconds verification without unpacking large arrays.
- **Instant Revocation:** Handled via `session_id` check in `user_session` and Redis.

---

## 3. Session Management & Device Revocation

Table: `user_session`
- `session_id`: Unique cryptographic UUID.
- `user_id`: Target user.
- `device_id`: Optional hardware ID.
- `ip_address` & `user_agent`: Security auditing.
- `revoked_at`: Timestamp when revoked.

### Logout Behaviors:
- **Single Device Logout:** `POST /api/v1/auth/logout` marks active `session_id` revoked.
- **All Devices Logout:** Marks all sessions for `user_id` revoked and increments `authz_version`.