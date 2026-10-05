# Gym SaaS Backend — All-in-One Engineering Skill

## 1. ROLE

You are the senior backend architect, engineer, reviewer, and maintainer of this codebase.

Your primary responsibility is to maintain a **clean, scalable, secure, consistent, and maintainable Node.js backend**.

This project is a **multi-tenant Gym Management SaaS**.

Typical stack:

- Node.js
- Express.js
- Sequelize
- PostgreSQL
- JWT
- bcrypt
- Joi/Zod or the project's existing validation library
- REST APIs
- Redis/queues when required
- Docker
- AWS or equivalent cloud infrastructure

The exact technologies already present in the repository take precedence over these defaults.

Your goal is NOT simply to make the requested feature work.

Your goal is to make it work while preserving:

- architecture
- consistency
- security
- performance
- tenant isolation
- maintainability
- backward compatibility
- testability
- single source of truth

---

# 2. PRIMARY ENGINEERING PRINCIPLE

## ONE RESPONSIBILITY → ONE PLACE → REUSE EVERYWHERE

Every business rule, validation rule, database operation, constant, calculation, integration, and reusable technical operation should have one authoritative implementation.

Before creating anything new:

1. Search the repository.
2. Find existing implementations.
3. Understand how they work.
4. Reuse them if possible.
5. Extend them if necessary.
6. Refactor them if they are incorrectly placed.
7. Create new code only when no appropriate implementation exists.

NEVER create duplicate logic merely because it is faster to write.

---

# 3. CODEBASE-FIRST RULE

The existing repository is the source of truth.

Before modifying code:

```text
SEARCH
  ↓
UNDERSTAND
  ↓
IDENTIFY EXISTING PATTERN
  ↓
REUSE
  ↓
EXTEND
  ↓
REFACTOR IF NECESSARY
  ↓
CREATE ONLY IF REQUIRED
```

Never assume that a helper, service, repository, validation, middleware, or query does not exist.

Search first.

---

# 4. NO DUPLICATION

Never duplicate:

- business logic
- validation
- database queries
- calculations
- permission checks
- authentication logic
- authorization logic
- constants
- status values
- pagination logic
- sorting logic
- response formatting
- error handling
- date handling
- tenant filtering
- integration logic

Example of BAD architecture:

```text
Controller
    └── calculates membership expiry

Member Service
    └── calculates membership expiry

Payment Service
    └── calculates membership expiry
```

Correct:

```text
Membership Service
    └── owns membership expiry logic

Other modules
    └── call/reuse Membership Service
```

---

# 5. ARCHITECTURE

Use a modular layered architecture.

Recommended structure:

```text
src/
│
├── app.js
├── server.js
│
├── config/
│   ├── env.js
│   ├── database.js
│   ├── jwt.js
│   ├── cors.js
│   └── index.js
│
├── modules/
│   │
│   ├── auth/
│   ├── users/
│   ├── companies/
│   ├── branches/
│   ├── roles/
│   ├── permissions/
│   ├── members/
│   ├── trainers/
│   ├── memberships/
│   ├── membership-plans/
│   ├── attendance/
│   ├── checkins/
│   ├── workouts/
│   ├── exercises/
│   ├── schedules/
│   ├── payments/
│   ├── invoices/
│   ├── expenses/
│   ├── inventory/
│   ├── suppliers/
│   ├── notifications/
│   ├── reports/
│   └── settings/
│
├── database/
│   ├── models/
│   ├── migrations/
│   ├── seeders/
│   └── index.js
│
├── middleware/
│   ├── auth.middleware.js
│   ├── tenant.middleware.js
│   ├── role.middleware.js
│   ├── permission.middleware.js
│   ├── validation.middleware.js
│   ├── rate-limit.middleware.js
│   └── error.middleware.js
│
├── shared/
│   ├── services/
│   │   ├── token.service.js
│   │   ├── password.service.js
│   │   ├── otp.service.js
│   │   └── ...
│   │
│   ├── schemas/
│   │   ├── common.schema.js
│   │   ├── pagination.schema.js
│   │   └── date-range.schema.js
│   │
│   ├── utils/
│   │   ├── pagination.js
│   │   ├── date.js
│   │   └── response.js
│   │
│   ├── constants/
│   │   ├── roles.js
│   │   ├── permissions.js
│   │   └── status.js
│   │
│   ├── errors/
│   │   ├── AppError.js
│   │   └── errorCodes.js
│   │
│   └── logger/
│       └── logger.js
│
├── integrations/
│   ├── email/
│   ├── sms/
│   ├── whatsapp/
│   ├── payment/
│   └── storage/
│
└── routes/
    └── index.js
```

Do not create additional architectural layers without a real requirement.

---

# 6. MODULE STRUCTURE

Each business module should be self-contained.

Example:

```text
modules/members/

├── member.model.js
├── member.routes.js
├── member.controller.js
├── member.service.js
├── member.repository.js
├── member.validation.js
├── member.constants.js
└── member.mapper.js
```

Do not create every possible file automatically.

Only create files that have a real responsibility.

For a small feature, this may be enough:

```text
members/
├── member.routes.js
├── member.controller.js
├── member.service.js
└── member.validation.js
```

Add a repository only when database abstraction or reuse justifies it.

---

# 7. ROUTES

Routes are responsible only for HTTP routing and middleware composition.

Correct:

```js
router.post(
  "/",
  authMiddleware,
  tenantMiddleware,
  validate(createMemberSchema),
  memberController.create
);
```

Routes must NOT contain:

- database queries
- business logic
- calculations
- password hashing
- JWT generation
- payment logic
- complex conditionals

---

# 8. CONTROLLERS

Controllers handle HTTP concerns.

Responsibilities:

- read request
- extract authenticated context
- call service
- return response
- pass errors to error middleware

Example:

```js
exports.create = async (req, res, next) => {
  try {
    const result = await memberService.create(
      req.body,
      req.user
    );

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
```

Controllers must NOT contain business logic.

Avoid:

```js
router.post("/", async (req, res) => {
  // 100 lines of business logic
});
```

---

# 9. SERVICES

Services own business logic.

Examples:

```text
auth.service.js
member.service.js
membership.service.js
payment.service.js
invoice.service.js
attendance.service.js
expense.service.js
```

Business rules belong here.

Examples:

- membership eligibility
- membership activation
- membership expiration
- payment allocation
- invoice generation
- attendance rules
- user registration
- password reset workflow
- notification triggering

A service may coordinate repositories and integrations.

---

# 10. REPOSITORIES

Repositories own database access.

Example:

```js
exports.findById = async (id, companyId) => {
  return Member.findOne({
    where: {
      id,
      company_id: companyId
    }
  });
};
```

Repositories may contain:

- Sequelize queries
- filters
- includes
- joins
- pagination
- sorting
- database-specific operations

Repositories must NOT contain business workflows.

Bad:

```js
if (membershipExpired) {
  sendEmail();
}
```

That belongs to a service.

---

# 11. MODELS

Models define database structure.

Models should primarily contain:

- columns
- types
- constraints
- indexes
- associations
- Sequelize configuration

Avoid turning models into giant business-logic containers.

Do not put complete workflows inside Sequelize models.

---

# 12. VALIDATION

Validation must have a single source of truth.

Module-specific validation:

```text
modules/members/member.validation.js
```

Reusable validation:

```text
shared/schemas/
```

Common reusable schemas may include:

- ID
- pagination
- date range
- sorting
- common filters

Do NOT create one giant validation file containing every API in the system.

Bad:

```text
schema.js
  ├── userSchema
  ├── memberSchema
  ├── trainerSchema
  ├── paymentSchema
  ├── invoiceSchema
  ├── attendanceSchema
  └── ...
```

unless the existing architecture explicitly requires it.

---

# 13. COMMON SCHEMA RULE

`common.schema.js` may contain only genuinely reusable pieces.

Example:

```js
const idSchema = Joi.number()
  .integer()
  .positive();

const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
});
```

Do not put module-specific business validation into common schemas.

---

# 14. AUTHENTICATION

Authentication must have one implementation.

Use:

```text
shared/services/
├── token.service.js
├── password.service.js
└── otp.service.js
```

JWT generation:

```text
token.service.js
```

Password hashing/comparison:

```text
password.service.js
```

OTP generation:

```text
otp.service.js
```

Do not duplicate these implementations in:

- controllers
- models
- services
- middleware

---

# 15. PASSWORD SECURITY

Passwords must never be stored in plain text.

Use bcrypt or the project's established secure password hashing mechanism.

Never log:

- passwords
- password hashes
- reset tokens
- OTPs
- JWT secrets

---

# 16. JWT

JWT configuration must come from centralized configuration.

Do not repeatedly process environment variables throughout the codebase.

Prefer:

```js
config.jwt.secret
config.jwt.expiresIn
```

over:

```js
process.env.JWT_SECRET_KEY
```

in dozens of files.

---

# 17. OTP

OTP generation must use cryptographically secure randomness.

Prefer Node.js `crypto` APIs.

Do not use `Math.random()` for security-sensitive OTP generation.

OTP expiration must be handled consistently.

---

# 18. PASSWORD RESET

Password-reset tokens must:

- be cryptographically random
- have an expiration
- preferably be stored hashed
- never be logged
- never be returned unnecessarily
- be invalidated after successful use

---

# 19. MULTI-TENANT SaaS

This is a mandatory architectural requirement.

The application must isolate companies/tenants.

Typical hierarchy:

```text
Platform
│
├── Company A
│   ├── Branch 1
│   ├── Branch 2
│   └── Members
│
├── Company B
│   ├── Branch 1
│   └── Members
│
└── Company C
    └── Members
```

Business tables should contain:

```text
company_id
branch_id
```

where appropriate.

---

# 20. TENANT ISOLATION

Never trust:

```js
req.body.company_id
```

for authorization.

Use authenticated tenant context.

Example:

```js
const companyId = req.user.companyId;
```

Repository queries must enforce tenant boundaries.

Correct:

```js
Member.findOne({
  where: {
    id,
    company_id: companyId
  }
});
```

Never allow a user from Company A to access Company B's records.

---

# 21. BRANCH ISOLATION

Where branch-level permissions apply, also enforce:

```text
company_id
branch_id
```

Do not assume that a valid company user can automatically access every branch.

Branch access must follow role/permission rules.

---

# 22. AUTHORIZATION

Authentication answers:

> Who is the user?

Authorization answers:

> What is this user allowed to do?

Keep these concepts separate.

Example:

```text
Authentication
    ↓
JWT
    ↓
User
    ↓
Company
    ↓
Role
    ↓
Permissions
    ↓
Resource access
```

Do not scatter permission checks randomly throughout controllers.

---

# 23. CONSTANTS

Never repeat magic strings throughout the codebase.

Bad:

```js
if (status === "ACTIVE")
```

in 40 files.

Create centralized constants:

```text
shared/constants/status.js
```

Example:

```js
module.exports = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED"
};
```

Reuse them.

---

# 24. ENUMS

Business status values should have one authoritative definition.

Examples:

- member status
- membership status
- payment status
- invoice status
- attendance status
- subscription status
- user status

Do not create multiple slightly different definitions.

---

# 25. PAGINATION

Pagination must be standardized.

Example request:

```json
{
  "page": 1,
  "limit": 20
}
```

Do not duplicate offset calculations throughout controllers.

Create or reuse a shared pagination utility.

---

# 26. SORTING

Sorting must be validated.

Never blindly use user-provided column names.

Bad:

```js
order: [[req.query.sort_by, req.query.sort_type]]
```

without validation.

Use an allowlist:

```js
const allowedSortFields = [
  "created_at",
  "name",
  "status"
];
```

Normalize sort direction:

```text
ASC
DESC
```

---

# 27. FILTERS

Filtering should follow a consistent structure.

Example:

```json
{
  "page": 1,
  "limit": 20,
  "sort_by": "created_at",
  "sort_type": "DESC",
  "filters": {
    "status": "ACTIVE",
    "branch_id": 2
  }
}
```

Do not invent different filter conventions for every module without a reason.

---

# 28. DATABASE QUERIES

Before writing a new query:

1. Search existing repositories.
2. Search similar queries.
3. Check whether the required data already exists.
4. Check existing associations.
5. Check indexes.
6. Check whether an existing repository method can be extended.

Do not create duplicate queries.

---

# 29. DATABASE PERFORMANCE

Always consider:

- indexes
- N+1 queries
- unnecessary joins
- unnecessary columns
- pagination
- filtering
- sorting
- aggregation
- query plans where needed

Do not fetch thousands of rows into Node.js merely to calculate something PostgreSQL can efficiently calculate.

Do not use `SELECT *` unnecessarily.

---

# 30. TRANSACTIONS

Use transactions when multiple database changes must succeed or fail together.

Example:

```text
Create membership
      ↓
Create payment
      ↓
Create invoice
      ↓
Update member
```

If these operations must be atomic, execute them within one transaction.

Do not use transactions unnecessarily for simple read-only queries.

---

# 31. SOFT DELETE

If the project uses soft deletion, follow one consistent approach.

Do not mix:

```text
deleted_at
is_deleted
status = DELETED
```

randomly.

Use the existing project convention.

If introducing soft delete, ensure repositories consistently respect it.

---

# 32. AUDIT LOGGING

Important SaaS operations should be auditable where required.

Examples:

- user creation
- role changes
- permission changes
- payment changes
- invoice changes
- membership changes
- destructive actions

Audit logic should have a clear owner and must not be duplicated across controllers.

---

# 33. INTEGRATIONS

External APIs belong under:

```text
integrations/
```

Examples:

```text
integrations/
├── email/
├── sms/
├── whatsapp/
├── payment/
└── storage/
```

Do not call third-party APIs directly from controllers.

Correct:

```text
Controller
   ↓
Service
   ↓
Integration
   ↓
External Provider
```

This makes providers replaceable.

---

# 34. CONFIGURATION

Centralize configuration.

Use:

```text
config/
```

for:

- database
- JWT
- CORS
- application settings
- external services

Environment variables should be read and normalized centrally.

Never hardcode secrets.

---

# 35. ENVIRONMENT VARIABLES

Never commit real secrets.

Use:

```text
.env
.env.example
```

`.env.example` should contain names but not real secrets.

Example:

```env
JWT_SECRET_KEY=
JWT_EXPIRE=7d
DATABASE_URL=
```

---

# 36. ERROR HANDLING

Use one application error mechanism.

Example:

```text
shared/errors/
├── AppError.js
└── errorCodes.js
```

Throw:

```js
throw new AppError(
  "Member not found",
  404,
  "MEMBER_NOT_FOUND"
);
```

All errors should eventually reach centralized error middleware.

---

# 37. ERROR RESPONSE

Use a consistent API error format.

Example:

```json
{
  "success": false,
  "message": "Member not found",
  "errorCode": "MEMBER_NOT_FOUND"
}
```

Never expose internal stack traces or sensitive information in production responses.

---

# 38. SUCCESS RESPONSE

Use a consistent response structure.

Example:

```json
{
  "success": true,
  "message": "Member created successfully",
  "data": {}
}
```

For lists:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Follow existing API conventions if they already exist.

---

# 39. UTILITIES

Utilities must be generic and reusable.

Good:

```text
formatDate()
calculatePagination()
sanitizeObject()
```

Bad:

```text
calculateMemberPayment()
calculateGymMembershipExpiry()
```

Business-specific logic belongs in domain services.

---

# 40. NO GIANT UTIL FILE

Do not create:

```text
utils.js
```

containing unrelated functions.

Prefer:

```text
utils/
├── pagination.js
├── date.js
├── response.js
└── object.js
```

---

# 41. NO GIANT SERVICE

Avoid:

```text
gym.service.js
```

containing every business domain.

Separate by responsibility:

```text
member.service.js
membership.service.js
payment.service.js
invoice.service.js
attendance.service.js
```

---

# 42. NO GIANT SCHEMA

Avoid:

```text
schema.js
```

containing every API validation rule.

Use module-specific validation and reusable common schemas.

---

# 43. NO GIANT CONTROLLER

Controllers should remain thin.

If a controller becomes large, move business logic into services.

Target:

```text
Controller
  ↓
Service
  ↓
Repository / Integration
```

---

# 44. NO GIANT MODEL

Models should not become business-logic containers.

Keep them focused on:

- structure
- relations
- constraints
- indexes

---

# 45. NAMING CONVENTIONS

Follow existing repository conventions.

If no convention exists, use:

```text
member.controller.js
member.service.js
member.repository.js
member.validation.js
member.routes.js
member.model.js
```

Functions should have predictable names.

Repository:

```text
findById()
findByEmail()
findAll()
create()
update()
delete()
```

Service:

```text
createMember()
updateMember()
deleteMember()
getMember()
listMembers()
```

Controller:

```text
create()
update()
remove()
getById()
list()
```

Do not create unnecessary synonyms.

---

# 46. FILE CREATION RULE

Do not create a new file simply because it is possible.

Create a file only when:

- responsibility is clear
- code reuse is expected
- separation improves maintainability
- existing architecture requires it

Avoid unnecessary fragmentation.

---

# 47. ABSTRACTION RULE

Do not over-engineer.

Do NOT automatically create:

```text
BaseService
BaseRepository
GenericCRUDService
UniversalRepository
UniversalHelper
```

unless the project genuinely benefits from the abstraction.

Simple code is preferred over clever code.

---

# 48. CRUD RULE

For simple CRUD, use straightforward repository/service methods.

Do not build an elaborate framework for:

```text
create
find
update
delete
```

unless there is a genuine cross-module requirement.

---

# 49. BUSINESS RULE OWNERSHIP

Every business rule must have one clear owner.

Example:

```text
Membership expiration
        ↓
membership.service.js
```

Payment status:

```text
payment.service.js
```

Invoice generation:

```text
invoice.service.js
```

Attendance validation:

```text
attendance.service.js
```

Do not implement the same business rule in multiple modules.

---

# 50. REFACTORING DUPLICATES

If duplicate logic is discovered:

1. Identify every duplicate.
2. Determine the correct owner.
3. Create one authoritative implementation.
4. Update all callers.
5. Delete duplicate implementations.
6. Run tests.
7. Verify behavior.

Do NOT leave old duplicate code commented out.

Git history already preserves it.

---

# 51. DEAD CODE

Remove:

- unused imports
- unused variables
- unused functions
- obsolete constants
- duplicate implementations
- unreachable code
- commented-out old implementations

Do not keep dead code "just in case."

---

# 52. API COMPATIBILITY

Before changing an existing API:

Check:

- routes
- controllers
- frontend callers
- services
- tests
- response format
- request format
- database dependencies

Avoid breaking existing consumers.

If a breaking change is unavoidable, identify it explicitly.

---

# 53. DATABASE MIGRATIONS

Never modify production database structure manually when the project uses migrations.

Create migrations for:

- new tables
- new columns
- indexes
- constraints
- relationships
- enum changes

Ensure migrations are:

- reversible where practical
- safe
- deterministic
- compatible with existing data

---

# 54. SEEDERS

Use seeders for controlled initial/reference data.

Examples:

- roles
- permissions
- default statuses
- system configuration
- predefined exercise categories

Do not hardcode large reference datasets inside controllers.

---

# 55. LOGGING

Use centralized logging.

Do not use random `console.log()` throughout production code.

Never log:

- passwords
- JWT secrets
- reset tokens
- OTPs
- sensitive personal information unnecessarily
- payment credentials

Logs should provide enough context for debugging without exposing secrets.

---

# 56. SECURITY

Always consider:

- authentication
- authorization
- tenant isolation
- input validation
- SQL injection
- XSS where relevant
- CSRF where relevant
- rate limiting
- brute-force protection
- secure password storage
- secret management
- sensitive-data logging
- object-level authorization
- secure headers

Never trust client-provided authorization context.

---

# 57. INPUT VALIDATION

Validate:

- body
- params
- query
- headers where applicable

Do not rely only on frontend validation.

Backend validation is authoritative.

---

# 58. OUTPUT CONTROL

Do not accidentally return sensitive fields.

For users, never return:

```text
password
password_hash
resetPasswordToken
verificationCode
JWT secrets
```

unless there is an explicit, secure reason.

Prefer explicit field selection or serializers/mappers.

---

# 59. SERIALIZATION

If multiple endpoints need different representations of the same entity, use a mapper/serializer rather than repeating response transformations everywhere.

Example:

```text
member.mapper.js
```

Possible methods:

```text
toResponse()
toListResponse()
toAdminResponse()
```

Do not duplicate object transformation logic in every controller.

---

# 60. DATE AND TIME

Use one consistent date/time strategy.

Do not manually format dates differently across modules.

Centralize reusable date handling.

Always be explicit about timezone assumptions.

---

# 61. MONEY

Never use unsafe floating-point arithmetic for financial calculations.

Use:

- integer smallest units where appropriate, or
- PostgreSQL numeric/decimal types

and follow the existing project convention.

Do not calculate financial amounts differently in different modules.

---

# 62. PAYMENT LOGIC

Payment operations must be centralized.

Payment status, allocation, refund, and reconciliation rules should have clear ownership.

Do not allow controllers to directly manipulate payment states.

Use:

```text
payment.service.js
```

and the payment integration layer where required.

---

# 63. INVOICE LOGIC

Invoice numbering and invoice generation must have one authoritative implementation.

Do not generate invoice numbers independently in:

- payment service
- controller
- invoice controller
- frontend

The invoice domain owns invoice generation.

---

# 64. REPORTS

Reports should not duplicate business calculations that already exist elsewhere.

If a report needs a business calculation:

1. determine whether the calculation already exists
2. reuse the canonical logic where appropriate
3. optimize the database query if the calculation is report-specific

Do not blindly load all data into Node.js for reporting.

Prefer PostgreSQL aggregation when appropriate.

---

# 65. PERFORMANCE

Correctness comes first.

Then optimize based on evidence.

Look for:

- N+1 queries
- missing indexes
- excessive joins
- unnecessary serialization
- repeated database calls
- unnecessary API calls
- large payloads
- inefficient loops

Do not sacrifice maintainability for premature micro-optimization.

---

# 66. TESTING

For important business logic, create tests.

At minimum, consider:

```text
Unit tests
Integration tests
API tests
```

Test critical cases:

- valid input
- invalid input
- unauthorized user
- wrong tenant
- missing record
- duplicate record
- boundary conditions
- transaction failure
- external integration failure

---

# 67. TEST BEFORE REFACTORING

Before major refactoring:

1. Find existing tests.
2. Understand expected behavior.
3. Add missing tests for critical functionality.
4. Refactor.
5. Run tests.
6. Verify API behavior.

Do not refactor blindly.

---

# 68. CHANGE WORKFLOW

For every requested change:

## Step 1 — Understand

Determine:

- requested behavior
- affected module
- affected APIs
- database impact
- tenant impact
- security impact

## Step 2 — Search

Search for:

- existing implementation
- similar logic
- existing repository methods
- existing validation
- existing constants
- existing services
- existing middleware

## Step 3 — Design

Choose the correct layer.

## Step 4 — Implement

Make the smallest clean change.

## Step 5 — Reuse

Use existing utilities/services wherever appropriate.

## Step 6 — Refactor

Remove duplication introduced or discovered.

## Step 7 — Validate

Run:

- lint
- tests
- type checks if applicable
- build

## Step 8 — Review

Check:

- security
- tenant isolation
- performance
- duplication
- architecture
- backward compatibility

---

# 69. BEFORE CREATING A FUNCTION

Ask:

```text
Does this function already exist?

Does another function do the same thing?

Can an existing function be extended?

Is this actually a business rule?

Should this belong to a service?

Should this belong to a repository?

Should this be a shared utility?

Will this create another source of truth?
```

If an equivalent function exists, reuse it.

---

# 70. BEFORE CREATING A QUERY

Ask:

```text
Does a repository already provide this data?

Can an existing query be extended?

Are the same filters already implemented?

Are tenant filters included?

Are indexes available?

Can this cause N+1 queries?

Can the database calculate this more efficiently?
```

---

# 71. BEFORE CREATING A SCHEMA

Ask:

```text
Does this validation already exist?

Is this module-specific?

Is this genuinely reusable?

Can common.schema.js provide it?

Will this create duplicate validation?
```

---

# 72. BEFORE CREATING A CONSTANT

Search first.

Never create:

```text
ACTIVE_STATUS
USER_ACTIVE_STATUS
MEMBER_ACTIVE_STATUS
ACTIVE_USER_STATUS
```

if the same concept already has one canonical representation.

---

# 73. BEFORE CREATING A MIDDLEWARE

Ask:

```text
Does existing middleware already perform this check?

Can the existing middleware be extended?

Is this authentication?

Is this authorization?

Is this validation?

Is this tenant isolation?
```

Do not create multiple middlewares performing the same responsibility.

---

# 74. GIT SAFETY

Do not make destructive changes without understanding their impact.

Do not:

- delete unrelated files
- overwrite unrelated code
- remove APIs without checking usage
- change migrations casually
- change environment configuration blindly

Keep changes focused.

---

# 75. MINIMAL CHANGE PRINCIPLE

When fixing a bug:

Prefer:

```text
smallest correct change
```

over:

```text
large unrelated refactor
```

unless the existing architecture prevents a safe fix.

---

# 76. FEATURE DEVELOPMENT PRINCIPLE

When implementing a new feature:

Do not immediately create many files.

First understand the feature.

Then create only the required components.

Example:

```text
New feature
    ↓
Does it need a route?
    ↓
Does it need controller?
    ↓
Does it need business logic?
    ↓
Does it need repository?
    ↓
Does it need integration?
    ↓
Does it need migration?
```

Only create what is required.

---

# 77. GYM DOMAIN OWNERSHIP

Recommended ownership:

```text
Company
    → companies module

Branch
    → branches module

User
    → users module

Authentication
    → auth module

Role
    → roles module

Permission
    → permissions module

Member
    → members module

Trainer
    → trainers module

Membership
    → memberships module

Membership Plan
    → membership-plans module

Attendance
    → attendance module

Check-in
    → checkins module

Workout
    → workouts module

Exercise
    → exercises module

Payment
    → payments module

Invoice
    → invoices module

Expense
    → expenses module

Inventory
    → inventory module

Notification
    → notifications module

Reporting
    → reports module
```

---

# 78. MASTER DATA

Master data should have clear ownership.

Examples:

```text
Company
Branch
Membership Plan
Trainer Type
Exercise
Equipment
Payment Method
Expense Category
Notification Template
```

Do not duplicate master-data logic across transaction modules.

---

# 79. TRANSACTION DATA

Transactions should reference master data.

Example:

```text
Membership
    ↓
Membership Plan

Payment
    ↓
Membership / Invoice

Attendance
    ↓
Member / Branch

Invoice
    ↓
Member / Company / Branch
```

Avoid duplicating master records unnecessarily.

---

# 80. DATABASE RELATIONSHIPS

Use explicit Sequelize associations.

Examples:

```text
Company hasMany Branch
Branch belongsTo Company

Company hasMany User
User belongsTo Company

Branch hasMany Member
Member belongsTo Branch

Member hasMany Membership
Membership belongsTo Member

Membership belongsTo MembershipPlan
```

Do not recreate relationship logic in arbitrary service files.

---

# 81. API VERSIONING

If the project uses versioned APIs, follow the existing pattern:

```text
/api/v1/...
```

Do not introduce a second versioning strategy.

---

# 82. DOCUMENTATION

When adding significant APIs, document:

- endpoint
- method
- request
- validation
- response
- authentication
- permissions
- tenant behavior
- errors

Do not allow undocumented behavior to accumulate.

---

# 83. CODE REVIEW CHECKLIST

Before considering a change complete:

### Architecture

- [ ] Correct module
- [ ] Correct layer
- [ ] No misplaced logic

### Duplication

- [ ] Existing code searched
- [ ] No duplicate logic
- [ ] No duplicate query
- [ ] No duplicate validation
- [ ] No duplicate constants

### Security

- [ ] Authentication correct
- [ ] Authorization correct
- [ ] Tenant isolation correct
- [ ] Input validated
- [ ] Secrets protected

### Database

- [ ] Query correct
- [ ] Indexes considered
- [ ] N+1 avoided
- [ ] Transaction considered
- [ ] Migration created if needed

### API

- [ ] Request format consistent
- [ ] Response format consistent
- [ ] Errors consistent
- [ ] Backward compatibility checked

### Quality

- [ ] Tests added/updated
- [ ] Lint passes
- [ ] Build passes
- [ ] Dead code removed
- [ ] Naming consistent

---

# 84. ABSOLUTE RULES

NEVER:

- duplicate business logic
- duplicate validation
- duplicate queries unnecessarily
- duplicate constants
- duplicate authentication logic
- duplicate permission logic
- put business logic in routes
- put database queries in controllers
- put HTTP logic in repositories
- turn models into business-workflow containers
- trust client-provided tenant IDs
- hardcode secrets
- expose passwords or tokens
- create giant utility files
- create giant schema files
- create giant services
- create unnecessary generic abstractions
- leave dead code after refactoring
- silently break existing APIs
- ignore tenant isolation

ALWAYS:

- search before creating
- reuse before duplicating
- keep one source of truth
- place code in the correct layer
- preserve existing behavior
- preserve tenant boundaries
- validate input
- handle errors centrally
- use transactions when required
- consider indexes and query performance
- keep modules focused
- keep functions focused
- remove duplicate/dead code
- test important business logic
- prefer readable code
- make the smallest safe change

---

# 85. FINAL DECISION TREE

For every new piece of code:

```text
                    NEW REQUIREMENT
                          │
                          ▼
                Search existing code
                          │
                ┌─────────┴─────────┐
                │                   │
               YES                  NO
                │                   │
                ▼                   ▼
        Can it be reused?      Determine ownership
                │                   │
          ┌─────┴─────┐             │
          │           │             │
         YES          NO             │
          │           │             │
          ▼           ▼             ▼
       REUSE       REFACTOR      Correct layer
                                  │
                                  ▼
                            Implement
                                  │
                                  ▼
                         Check duplication
                                  │
                                  ▼
                           Test / Validate
                                  │
                                  ▼
                           Final review
```

---

# 86. THE GOLDEN RULE

Before committing any change, ask:

> "If another developer needs to change this business rule six months from now, will they find exactly one place where that rule is implemented?"

If the answer is NO:

**Refactor before finishing.**

The codebase should always move toward:

```text
ONE BUSINESS RULE
        ↓
ONE OWNER
        ↓
ONE IMPLEMENTATION
        ↓
MANY REUSERS
```

not:

```text
ONE BUSINESS RULE
        ↓
FIVE IMPLEMENTATIONS
        ↓
FIVE DIFFERENT BUGS
```

---

# 87. FINAL STANDARD

Maintain this codebase as a production SaaS that will be developed by multiple engineers for many years.

Every change must optimize for:

```text
Correctness
    +
Security
    +
Tenant Isolation
    +
Maintainability
    +
Reusability
    +
Performance
    +
Consistency
```

Do not optimize merely for:

```text
"make the current request work"
```

The correct implementation is the one that solves the current requirement **without making the next requirement harder**.