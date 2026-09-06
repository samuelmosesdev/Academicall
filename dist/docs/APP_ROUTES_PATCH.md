# Wire routes into App.jsx + sidebars

## 1. Imports (add to App.jsx)

```js
import AdminRequests from "./pages/AdminRequests";
import AdminActivityLog from "./pages/AdminActivityLog";
import CourseRepPanel from "./pages/CourseRepPanel";
import StudentReference from "./pages/StudentReference";
```

## 2. Admin child routes (inside `/admin`)

```jsx
<Route path="requests" element={<AdminRequests />} />
<Route path="activity-log" element={<AdminActivityLog />} />
```

## 3. Agent child routes (Alpha uses same agent shell — open requests)

```jsx
<Route path="requests" element={<AdminRequests />} />
```

Update `ProtectedRoute` so `requiredRole="agent"` also allows `alphaAgent`
(see `src/components/ProtectedRoute.roles.jsx`).

## 4. Student child routes (inside `/dashboard`)

```jsx
<Route path="course-rep" element={<CourseRepPanel />} />
<Route path="reference" element={<StudentReference />} />
```

## 5. Sidebar.jsx (Admin) — add nav items

```js
{ label: "Requests", icon: ClipboardCheck, to: "/admin/requests" },
{ label: "Activity log", icon: ScrollText, to: "/admin/activity-log" },
```

Import `ClipboardCheck, ScrollText` from lucide-react.

## 6. UserSidebar.jsx (Student)

```js
{ label: "Reference", icon: BookMarked, to: "/dashboard/reference" },
// Show Course Rep only if role is courseRep — filter in component:
```

Example filter:

```js
import { isCourseRep } from "../lib/roles";
import { useAuth } from "../context/AuthContext";

const { profile } = useAuth();
const items = NAV_ITEMS.filter((item) => {
  if (item.to === "/dashboard/course-rep") return isCourseRep(profile);
  return true;
});
```

Add nav entry:

```js
{ label: "Course Rep", icon: CalendarPlus, to: "/dashboard/course-rep" },
```

## 7. Deploy rules

```bash
cp firestore.rules ./firestore.rules   # from this pack root
firebase deploy --only firestore:rules
```

## 8. First admin

Firestore → `users/{yourUid}` → field `role` = `admin`
