# GymHood Backend API Endpoints

This document maps the major API endpoints for the GymHood Backend, and serves as a reference for K6 load testing.

## Base URL
Live Backend URL: `https://api.gymshood.com`

## 1. Authentication (`/auth`)
*   `POST /auth/register` - Register a new user.
*   `POST /auth/login` - Login an existing user.
*   `GET /auth/profile` - (Requires Auth) Get the authenticated user's profile.
*   `PUT /auth/profile` - (Requires Auth) Update the authenticated user's profile.
*   `POST /auth/google-login` - Login via Google OAuth.
*   `POST /auth/password/forgot` - Forgot password request.
*   `PUT /auth/password/reset` - Reset password.

## 2. Gyms (`/gymdb`)
*   `GET /gymdb/gyms` - Retrieve all gyms.
*   `GET /gymdb/gym/:id` - Retrieve details of a specific gym.
*   `POST /gymdb/gym/register` - (Requires Auth & Owner) Register a new gym.
*   `PUT /gymdb/gym/:id` - (Requires Auth & Owner) Update details of a specific gym.
*   `GET /gymdb/me` - (Requires Auth) Get gym owner profile/details.

## 3. Payments (`/payment`)
*   `GET /payment/gym-balance/:gymId?` - Get gym balance.
*   `POST /payment/pay-to-gym` - Make a payment to a gym.
*   `POST /payment/request-settlement` - Request a settlement payout.
*   `GET /payment/my-settlement-requests` - View user's settlement requests.

## 4. Admin (`/admin`)
*   `GET /admin/stats` - (Requires Auth & Admin) Get admin dashboard statistics.
*   `GET /admin/users` - (Requires Auth & Admin) Get all registered users.
*   `GET /admin/gyms` - (Requires Auth & Admin) Get all registered gyms.
*   `PUT /admin/gym/:gymId/toggle-verify` - (Requires Auth & Admin) Verify a gym.

## 5. User Data (`/user-data`)
*   `GET /user-data/:userId` - Get user-specific data.
*   `POST /user-data/:userId` - Create user-specific data.

## 6. General / System
*   `GET /ping` - Simple health check.
*   `POST /upload` - Upload media files.
*   `GET /debug-files` - Check if files are accessible.

---

## Testing with k6
We have provided a sample `k6_test.js` script to test server capability.
To test and generate a report, run:

```bash
k6 run k6_test.js
```

### Saved Reports
After running the command, the following files will be automatically generated in the same directory:
- `report.html`: A visual dashboard testing report.
- `summary.json`: A full JSON breakdown of all metrics and details.

> **Note**: For endpoints that require authentication, the script already handles login for `krishnkantsaraswat830@gmail.com` automatically in the `setup()` function.
