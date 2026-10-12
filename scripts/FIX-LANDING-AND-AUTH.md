# Fix: localhost goes to /login + session security

## Why you land on /login

Your **local** `src/App.jsx` is still the old version:

```js
<Route path="/" element={<Navigate to="/dashboard" replace />} />
```

Flow:
1. `/` redirects → `/dashboard`
2. `/dashboard` is protected
3. You’re not logged in → forced to `/login`

## Fix (required)

In **your** project `src/App.jsx`, the root route must be:

```js
import Landing from "./pages/Landing";

// ...
<Route path="/" element={<Landing />} />
```

NOT `Navigate to="/dashboard"`.

Also copy these files from the zip into your project:

- `src/pages/Landing.jsx`
- `src/App.jsx` (or merge the route above)
- `src/firebase/config.js`  ← session security
- `src/context/AuthContext.jsx` ← cleaner logout

Then:

```bash
# stop server (Ctrl+C)
npm run dev
```

Open **exactly**: http://localhost:5173/  
Hard refresh: Ctrl+Shift+R

---

## Session security (what we changed)

Firebase used to keep you logged in **forever** in that browser (local persistence).

Now `src/firebase/config.js` uses **session persistence**:

- You stay logged in while the browser session is open
- Closing the browser ends the login (safer on shared PCs)
- Log out still works instantly via the Log out button

This is **not** classic HTTP cookies. Firebase Auth on the web stores the session in the browser (IndexedDB / session storage). Session persistence is the secure default for student lab / café machines.

If you later want “remember me for 30 days”, we can switch back to `browserLocalPersistence` and add an optional “Remember me” checkbox.
