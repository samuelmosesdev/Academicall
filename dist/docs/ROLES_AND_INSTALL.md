# UofA Readers — Roles pack (install guide)

## Firebase roles to use

Set the field **`role`** on documents in collection **`users/{uid}`**.

| Role value (exact string) | Who | Access |
|---------------------------|-----|--------|
| `admin` | Platform owner | Full control, assign any role, all approvals, all logs |
| `alphaAgent` | Master / elevated agent | Approve requests, assign courseRep / agent / PRO (not admin), activity logs (not admin private), announcements |
| `agent` | Basic agent | Documents, courses, CBT (existing agent panel) |
| `courseRep` | Special student | Student app + schedule classes, propose materials/courses for their dept |
| `user` | Normal student | Student dashboard only |

### Optional fields on the same user doc

```
role: "courseRep" | "user" | "agent" | "alphaAgent" | "admin"
plan: "free" | "weekly" | "monthly" | "annual" | "pro"
status: "active" | "suspended"
courseRepMeta: {
  courseCodes: ["CSC101", "CSC102"],   // courses they represent
  faculty: "...",
  department: "..."
}
assignedBy: "<adminUid>"
assignedAt: <timestamp>
```

### How to assign in Firebase Console (first admin)

1. Authentication → find your user → copy UID  
2. Firestore → `users` → open that UID document  
3. Set `role` = `admin`  
4. Save  

### How to assign later (in app)

Use **Admin → Users** (updated UI in this pack) or Admin → Requests tools.

Alpha Agents can be assigned **only by Admin**.

---

## New Firestore collections

| Collection | Purpose |
|------------|---------|
| `requests` | Course / material / profile / course-update / role requests |
| `activityLog` | Audit trail (already existed; expanded usage) |
| `classEvents` | Course Rep scheduled lectures/classes (visible to course mates) |
| `referenceItems` | Reference page entries linked to courses/events |

---

## Files in this zip

Copy into your project root, preserving paths under `src/`.

```
src/lib/roles.js
src/lib/activityLog.js
src/hooks/useRequests.js
src/hooks/useClassEvents.js
src/pages/AdminRequests.jsx
src/pages/AdminActivityLog.jsx
src/pages/CourseRepPanel.jsx
src/pages/StudentReference.jsx
src/components/ProtectedRoute.roles.jsx   # merge into ProtectedRoute
firestore.rules                           # replace existing
docs/APP_ROUTES_PATCH.md
docs/ROLES_AND_INSTALL.md
```

---

## Deploy rules

```bash
firebase deploy --only firestore:rules
```

---

## Priority after paste

1. Set your user `role: "admin"` in Firestore  
2. Deploy rules  
3. Wire routes from `APP_ROUTES_PATCH.md`  
4. Open Admin → Requests / Activity Log / Users role dropdown  
5. Assign one `courseRep` and test Course Rep panel  
