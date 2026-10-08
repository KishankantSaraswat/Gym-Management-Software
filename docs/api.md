# api

This document provides a comprehensive specification of all REST endpoints exposed by the AI Gym OS backend (`v1` and modular services).

---

## 1. Global Headers & Conventions

All secured requests must include the following headers:

| Header | Type | Description |
|---|---|---|
| `Authorization` | String | `Bearer <JWT_TOKEN>` issued upon login |
| `x-gym-id` | Integer | (Optional) Active gym tenant context. If omitted, defaults to token's primary gym |
| `x-branch-id` | Integer | (Optional) Active branch context |
| `Content-Type` | String | `application/json` |

### Standard Error Response Format
```json
{
  "success": false,
  "message": "Human-readable error description",
  "error_code": "TENANT_ACCESS_DENIED" // (when applicable)
}
```

### Standard Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource created.
- `400 Bad Request`: Validation failure or malformed payload.
- `401 Unauthorized`: Missing, expired, or invalid session token.
- `403 Forbidden`: Insufficient RBAC permission, branch mismatch, or subscription paywall.
- `404 Not Found`: Entity not found or tenant isolated.
- `429 Too Many Requests`: Rate limit exceeded.
- `500 Internal Server Error`: Unhandled server exception.

---

## 2. Authentication & Session Endpoints (`/api/v1/auth`)

### 2.1 User Login
- **Method / Route**: `POST /api/v1/auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "owner@example.com",
    "password": "SecretPassword123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Jane Doe",
      "email": "owner@example.com",
      "role": "Owner"
    },
    "gym_id": 10,
    "branch_id": 1,
    "permissions": ["MEMBER_VIEW", "MEMBER_CREATE", "PLAN_CREATE", "AI_COACH_USE"],
    "roles": ["GYM_OWNER"]
  }
  ```

### 2.2 Dynamic User & Authorization Context (`/me`)
Retrieves the real-time authorization state, accessible branches, accessible gyms, active permissions, and navigation menus.
- **Method / Route**: `GET /api/v1/auth/me`
- **Access**: Authenticated (`Bearer <JWT>`)
- **Headers**: Supports optional `x-gym-id` and `x-branch-id` overrides.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "name": "Jane Doe",
      "email": "owner@example.com",
      "isSuperAdmin": false
    },
    "authz": {
      "user_id": 1,
      "gym_id": 10,
      "branch_id": 1,
      "gym_name": "Olympus Prime Fitness",
      "roles": ["GYM_OWNER"],
      "permissions": ["MEMBER_VIEW", "MEMBER_CREATE", "REPORT_VIEW"],
      "menus": [
        {
          "menu_code": "MENU_MEMBERS",
          "menu_name": "Members",
          "route": "/dashboard/members",
          "icon": "Users",
          "sort_order": 20
        }
      ],
      "accessible_branches": [
        { "id": 1, "branch_name": "Main Downtown", "branch_code": "BR-001" },
        { "id": 2, "branch_name": "West Coast Express", "branch_code": "BR-002" }
      ],
      "accessible_gyms": [
        { "id": 10, "gym_name": "Olympus Prime Fitness", "user_type": "OWNER" }
      ]
    }
  }
  ```

### 2.3 Switch Gym Context
Switches the user's active tenant and issues an updated JWT session without re-authenticating.
- **Method / Route**: `POST /api/v1/auth/switch-gym`
- **Access**: Authenticated
- **Request Body**:
  ```json
  {
    "gym_id": 12,
    "branch_id": 5
  }
  ```
- **Response `200 OK`**: Returns new compact JWT scoped to `gym_id: 12`.

### 2.4 Logout & Session Revocation
- **Method / Route**: `GET /api/v1/auth/logout`
- **Access**: Authenticated
- **Description**: Invalidates the Redis session cache and flags the PostgreSQL session record as revoked.

---

## 3. Tenant & Branch Management Endpoints (`/api/v1/tenants`, `/api/v1/branches`)

### 3.1 Get Tenant Profile
- **Method / Route**: `GET /api/v1/tenants/:gymId`
- **Access**: Authenticated (`GYM_SETTINGS_VIEW`)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "gym": {
      "id": 10,
      "gym_code": "OLYMPUS-10",
      "gym_name": "Olympus Prime Fitness",
      "status": "ACTIVE",
      "subscription": {
        "plan_code": "PRO",
        "name": "Professional Plan",
        "max_branches": 5,
        "max_members": 2000
      }
    }
  }
  ```

### 3.2 List Branches of a Gym
- **Method / Route**: `GET /api/v1/tenants/:gymId/branches`
- **Access**: Authenticated (`BRANCH_VIEW`)
- **Response `200 OK`**: List of branches with address, phone, capacity, and active members.

### 3.3 Create Branch (Quota Protected)
Enforces multi-branch subscription constraints.
- **Method / Route**: `POST /api/v1/tenants/:gymId/branches`
- **Access**: Authenticated (`BRANCH_CREATE`)
- **Request Body**:
  ```json
  {
    "branch_name": "Eastside Hub",
    "branch_code": "BR-003",
    "address": "452 Silicon Ave",
    "phone": "+919876543210"
  }
  ```
- **Response `201 Created`**: Returns created `gym_branch_master` entity.
- **Response `403 Forbidden`**: If branch count exceeds subscription tier limit (`max_branches`).

---

## 4. Dynamic Client Menu Endpoints (`/api/v1/menus`)

### 4.1 Get Permitted Navigation Menus
- **Method / Route**: `GET /api/v1/menus`
- **Access**: Authenticated
- **Headers**: `x-gym-id: 10`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "menus": [
      {
        "menu_code": "MENU_DASHBOARD",
        "menu_name": "Dashboard",
        "route": "/dashboard",
        "icon": "LayoutDashboard",
        "children": []
      },
      {
        "menu_code": "MENU_MEMBERS",
        "menu_name": "Members",
        "route": "/dashboard/members",
        "icon": "Users",
        "children": []
      }
    ]
  }
  ```

---

## 5. Plan & Membership Endpoints (`/gymdb/plan`)

### 5.1 Create Gym Plan
- **Method / Route**: `POST /gymdb/plan/create/:gymId`
- **Access**: Authenticated (`PLAN_CREATE`)
- **Tenant Scope**: Verifies caller belongs to `gymId`.
- **Request Body**:
  ```json
  {
    "name": "Platinum Annual Pass",
    "validity": 12,
    "price": 14999,
    "discountPercent": 10,
    "features": ["Gym Floor", "Sauna", "CrossFit Area"],
    "planType": "Annual",
    "isTrainerIncluded": true,
    "duration": 365
  }
  ```

### 5.2 List Active Plans for Members
- **Method / Route**: `GET /gymdb/plan/gym/:gymId`
- **Access**: Public / Authenticated

### 5.3 List All Plans for Management (Admin View)
- **Method / Route**: `GET /gymdb/plan/admin/:gymId`
- **Access**: Authenticated (`assertTenantOwnership`)
- **Response `200 OK`**: Includes both active and archived plans.

---

## 6. Attendance & QR Check-In Endpoints (`/gymdb/user-gym-entry`)

### 6.1 Member QR Code Check-In
- **Method / Route**: `POST /gymdb/user-gym-entry/check-in`
- **Access**: Authenticated (Member)
- **Request Body**:
  ```json
  {
    "userPlanId": 45
  }
  ```
- **Response `200 OK`**: Check-in confirmation, expiry date, remaining days.

### 6.2 Get Daily Gym Attendance Register
- **Method / Route**: `POST /gymdb/user-gym-entry/register/:gymId`
- **Access**: Authenticated (`assertTenantOwnership`)
- **Request Body**:
  ```json
  {
    "date": "2026-10-08"
  }
  ```
- **Response `200 OK`**: List of member entries with timestamps, workout durations, and profile IDs.

### 6.3 Real-time Live Capacity
- **Method / Route**: `GET /gymdb/user-gym-entry/capacity/:gymId`
- **Access**: Authenticated (`assertTenantOwnership`)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "isOpen": true,
    "activeCount": 42,
    "capacity": 150,
    "shiftInfo": { "shift": "Evening", "closeTime": "22:00" }
  }
  ```

---

## 7. Dashboard Analytics Endpoints (`/gymdb/dashboard`)

All dashboard metrics are protected by tenant ownership assertions:
- `GET /gymdb/dashboard/metrics/:gymId` (`DASHBOARD_VIEW`)
- `GET /gymdb/dashboard/revenue/:gymId` (`REPORT_VIEW`)
- `GET /gymdb/dashboard/active-users/:gymId` (`ATTENDANCE_VIEW`)
- `GET /gymdb/dashboard/peak-hours/:gymId` (`REPORT_VIEW`)