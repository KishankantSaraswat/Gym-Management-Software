# permissions

## 1. System Roles (`user_group_master`)

- `SUPER_ADMIN`: Unrestricted global platform control.
- `GYM_OWNER`: Full administrative control over tenant gym and all associated branches.
- `GYM_ADMIN`: Tenant administrator with management access across assigned branches.
- `BRANCH_MANAGER`: Operational manager overseeing single branch daily operations.
- `TRAINER`: Fitness trainer managing member workouts and attendance.
- `RECEPTIONIST`: Front desk staff managing QR check-ins, member enrollment, and payments.
- `ACCOUNTANT`: Financial officer managing transaction history and settlements.
- `NUTRITIONIST`: Diet specialist managing member nutrition profiles.
- `MEMBER`: Gym member checking in and tracking workouts.

---

## 2. Granular Permissions (`user_permission_master`)

| Permission Code | Module | Action | Description |
|---|---|---|---|
| `MEMBER_VIEW` | MEMBERS | VIEW | View member list and profiles |
| `MEMBER_CREATE` | MEMBERS | CREATE | Register new member |
| `MEMBER_UPDATE` | MEMBERS | UPDATE | Edit member details and plans |
| `MEMBER_DELETE` | MEMBERS | DELETE | Deactivate member account |
| `MEMBER_EXPORT` | MEMBERS | EXPORT | Export member data to CSV |
| `ATTENDANCE_VIEW` | ATTENDANCE | VIEW | View live and past attendance |
| `ATTENDANCE_CREATE`| ATTENDANCE | CREATE | Perform QR or manual check-in |
| `ATTENDANCE_UPDATE`| ATTENDANCE | UPDATE | Modify check-out logs |
| `PLAN_VIEW` | PLANS | VIEW | View membership plans |
| `PLAN_CREATE` | PLANS | CREATE | Create membership plans |
| `PLAN_UPDATE` | PLANS | UPDATE | Edit membership plans |
| `PLAN_DELETE` | PLANS | DELETE | Disable membership plans |
| `PAYMENT_VIEW` | PAYMENTS | VIEW | View transaction history |
| `PAYMENT_CREATE` | PAYMENTS | CREATE | Process member payments |
| `PAYMENT_APPROVE` | PAYMENTS | UPDATE | Approve cash payment requests |
| `PAYMENT_REFUND` | PAYMENTS | DELETE | Issue member payment refunds |
| `TRAINER_VIEW` | TRAINERS | VIEW | View trainer directory |
| `TRAINER_CREATE` | TRAINERS | CREATE | Assign trainers to branches |
| `TRAINER_UPDATE` | TRAINERS | UPDATE | Edit trainer schedules |
| `TRAINER_DELETE` | TRAINERS | DELETE | Remove trainer access |
| `WORKOUT_VIEW` | WORKOUT | VIEW | View workout regimens |
| `WORKOUT_CREATE` | WORKOUT | CREATE | Design workout programs |
| `WORKOUT_UPDATE` | WORKOUT | UPDATE | Modify workout programs |
| `REPORT_VIEW` | REPORTS | VIEW | View revenue & member analytics |
| `REPORT_EXPORT` | REPORTS | EXPORT | Export financial summaries |
| `AI_COACH_VIEW` | AI | VIEW | View AI coaching dashboard |
| `AI_COACH_USE` | AI | USE | Generate AI workouts & diets |
| `AI_ANALYTICS_VIEW`| AI | VIEW | View member churn & lead scores |
| `GYM_SETTINGS_VIEW`| SETTINGS | VIEW | View gym profile & KYC docs |
| `GYM_SETTINGS_UPDATE`|SETTINGS| UPDATE | Modify gym operating hours & media |
| `BRANCH_MANAGE` | SETTINGS | UPDATE | Add and configure gym branches |