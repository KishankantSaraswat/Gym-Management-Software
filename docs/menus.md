# menus

## 1. Menus Are UI Navigation, Not Security

In AI Gym OS:
- **Menus** govern what navigation links, icons, and sections are displayed in the frontend UI.
- **Permissions** govern backend API authorization and data access.
- A user cannot perform an action simply by inspecting or unhiding a button; backend route guards verify the underlying permission on every request.

---

## 2. Dynamic Menu Tree Schema

Table: `client_menu_master`
- `id` (PK, INTEGER)
- `parent_id` (Self-referencing for hierarchical dropdown menus)
- `menu_code`: Unique code (e.g., `DASHBOARD`, `MEMBERS`, `ATTENDANCE`, `PLANS`, `AI_COACH`, `BRANCHES`)
- `menu_name`: Display title
- `route`: Frontend URL route path
- `icon`: FontAwesome / Lucide icon identifier
- `menu_type`: `sidebar`, `header`, or `quick_action`
- `sort_order`: Ordering sequence
- `platform`: `web`, `mobile`, or `both`

---

## 3. Menu to Permission Mapping (`client_menu_permission`)

A menu item is dynamically rendered in the response of `GET /api/v1/auth/me` if:
1. The menu has no associated permissions (e.g., public overview dashboard).
2. OR the user possesses at least one permission associated with that menu.

Example:
```text
Members Menu ('MEMBERS')
  └── Linked Permissions: 'MEMBER_VIEW'
If User Role possesses 'MEMBER_VIEW' -> Render Members Menu in Sidebar
If User Role lacks 'MEMBER_VIEW'     -> Omit Members Menu from Sidebar
```