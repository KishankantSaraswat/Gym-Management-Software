# subscription

## 1. Subscription Plans (`subscription_plan`)

| Plan Code | Plan Name | Price (INR) | Max Branches | Max Members | Included Features |
|---|---|---|---|---|---|
| `FREE` | Free Starter | ₹0 | 1 | 50 | Basic Check-ins, Attendance |
| `BASIC` | Basic Growth | ₹999 | 1 | 300 | Automated Billing, WhatsApp Notifications |
| `PRO` | Pro Multi-Branch | ₹2,499 | 5 | 2,000 | Multi-Branch, AI Gym Coach, Advanced Analytics |
| `ENTERPRISE`| Enterprise Franchise| ₹7,999 | 9,999 | Unlimited | Unlimited Branches, White-Label, API Access, Full AI OS |

---

## 2. Feature Gating Architecture

Features are NOT hardcoded with `if (plan === 'PRO')`. Instead, they are verified using `AuthorizationService.isFeatureEnabled(gymId, featureKey)`:

```javascript
// Gating an AI feature endpoint
if (!await authorizationService.isFeatureEnabled(req.gym.id, 'ai_coach')) {
  return res.status(403).json({
    success: false,
    error: {
      code: "FEATURE_LOCKED",
      message: "AI Coach feature requires an active PRO or ENTERPRISE subscription."
    }
  });
}
```

---

## 3. Gym-Level Feature Permissions (`gym_permission`)

When a gym subscribes to a plan:
1. `gym_permission` records are updated to enable or disable permissions corresponding to the plan features.
2. If `ai_coach` is false, `AI_COACH_USE` and `AI_COACH_VIEW` are marked `is_enabled = false` in `gym_permission`.
3. Even if a user role has `AI_COACH_USE`, the effective permission resolves to **DENIED**.