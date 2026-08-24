# Firestore cost postmortem — how we blew the free tier with 18 users

In August 2026 this app exhausted the Firebase **Spark** free tier (50,000 reads/day,
20,000 writes/day) with roughly 18 registered users. Signups started failing because
the quota was already spent.

The usage was **not** real traffic. Two bugs made a Firestore *write* trigger a
snapshot listener that triggered *the same write again*, looping as fast as the
network allowed. A single browser tab on the wrong page could burn the entire daily
quota in minutes.

This document exists so nobody re-introduces them. Read the two root causes first —
everything else in here is a variation on the same theme.

---

## The one idea behind almost every bug on this list

```js
// src/context/AuthContext.jsx
onSnapshot(doc(db, "users", user.uid), (snap) => {
  setProfile({ id: snap.id, ...snap.data() });   // ← NEW OBJECT every time
});
```

`profile` is a **brand-new object on every snapshot**. React compares dependencies
with `Object.is`, so *any* `useEffect` listing `profile` re-runs on every single
user-document change.

That's harmless on its own. It becomes a catastrophe when the effect **also writes
to the user document**, because then:

```
write → snapshot fires → new profile object → effect re-runs → write → ...
```

There is no natural stopping point. Firestore bills every iteration.

**Rule:** an effect that writes to a document must never depend, directly or
indirectly, on that same document's data.

---

## Root cause 1 — unstable callback identity (the fast one)

**Files:** `src/hooks/useStaffChatUnread.js`, `src/pages/StaffChat.jsx`

```js
// useStaffChatUnread.js — a plain function declaration
async function markStaffChatRead() {
  await setDoc(doc(db, "users", user.uid),
    { staffChatLastReadAt: serverTimestamp() }, { merge: true });
}

// StaffChat.jsx
useEffect(() => {
  markStaffChatRead?.();
}, [markStaffChatRead]);        // ← new identity on EVERY render
```

A function declared in a hook body is a new reference on every render. So: render →
effect fires → write → snapshot → re-render → new identity → effect fires → write →
forever.

It got worse. The same hook did this:

```js
}, [user?.uid, profile?.staffChatLastReadAt]);
```

A Firestore `Timestamp` is a **class instance rebuilt by every `snap.data()` call**.
It is never reference-equal, even when the value is identical. So this effect also
re-ran on every profile change, tearing down and re-attaching an
`orderBy(createdAt).limit(80)` listener — and **re-attaching a listener re-bills its
entire result set**.

Per loop iteration: 1 write + 1 user-doc read + up to 80 message reads, at roughly
3–6 iterations *per second*.

**Fixed by:** wrapping `markStaffChatRead` in `useCallback([user?.uid])`, keying the
mark-read effect on `user?.uid` instead of the callback, and comparing the timestamp
via `.toMillis()` instead of by object identity.

### Rules
- Any function returned from a hook that callers might put in a dependency array
  **must** be wrapped in `useCallback`.
- **Never** put a Firestore `Timestamp`, `DocumentReference`, `GeoPoint`, or an
  object/array built from `snap.data()` in a dependency array. Depend on a
  primitive: `ts?.toMillis() ?? 0`, `doc.id`, `list.length`.

---

## Root cause 2 — `serverTimestamp()` in a repeated write

**Files:** `src/context/AuthContext.jsx`, `src/lib/fcm.js`

```js
useEffect(() => {
  if (isStudent) registerFcmToken(user.uid);   // writes users/{uid}
  ...
}, [user, profile, profileReady]);             // ← profile: new object each snapshot
```

`registerFcmToken` wrote `fcmTokens.<token>.updatedAt = serverTimestamp()`. Because
`serverTimestamp()` resolves to a genuinely new value each time, the document
*really did* change on every write, so the snapshot always fired and the loop never
settled. ~150–300 writes/minute per affected tab.

**Fixed by:** dropping `profile` from the deps (using `profile?.role` and
`user?.uid`), guarding with a `useRef` so registration happens once per uid, and
adding a module-level `Set` in `fcm.js` so the same token is never written twice.

### Rules
- `serverTimestamp()` / `increment()` make a write **always** mutate the document.
  A "no-op" write with them in it is not a no-op — it costs money and wakes every
  listener.
- Before writing, ask whether the value is already what you're about to write. If
  it is, skip.
- Registration/initialisation side effects belong behind a `useRef` guard or in a
  once-per-session module flag.

---

## The other bugs found in the same audit

### 3. Listeners created inside an `onSnapshot` error callback leak forever

**Files:** `useUserDashboardData`, `useAdminUsers`, `StaffChat`, `StudentReference`

```js
onSnapshot(q, onNext, (err) => {
  return onSnapshot(fallbackQ, onNext);   // ← Firestore DISCARDS this return value
});
```

Firestore ignores whatever an error callback returns. Each of these leaked a
permanently-live listener **per mount**. Navigating away and back ten times left ten
live listeners on the same query, all billing on every change. Two of them were on
*entire collections* with no `limit()`.

These paths were live, not theoretical: `firestore.indexes.json` was empty, so every
`where(...) + orderBy(...)` query failed with `failed-precondition` and fell straight
into the fallback.

**Fixed by:** holding the fallback unsubscribe in a variable the cleanup closes over,
and committing the real composite indexes.

```js
let fallbackUnsub = null;
const unsub = onSnapshot(q, onNext, () => {
  fallbackUnsub?.();
  fallbackUnsub = onSnapshot(fallbackQ, onNext);
});
return () => { unsub(); fallbackUnsub?.(); };
```

**Rule:** every `onSnapshot` must have exactly one path to an `unsubscribe()` that
the effect cleanup can reach. If you can't point at it, it leaks.

### 4. Committing an empty `firestore.indexes.json`

`{"indexes": [], "fieldOverrides": []}` meant no composite index was managed by the
repo. Every `where + orderBy` query in the app failed and silently degraded into a
broader, unbounded fallback query. The app "worked", just at many times the cost.

**Rule:** when you add a `where + orderBy` query, add the index to
`firestore.indexes.json` and run `firebase deploy --only firestore:indexes`. Creating
it by clicking the console error link leaves the repo out of sync with reality.

### 5. The same data hook mounted twice

`useUserDashboardData()` was called in **both** `UserLayout` and `UserDashboard`. It
held no shared cache, so that was two independent sets of four listeners — every
student dashboard read billed twice.

**Fixed by:** converting it into `<UserDashboardDataProvider>` (mounted once in
`UserLayout`) plus a `useUserDashboardData()` that reads context.

**Rule:** a hook that opens listeners should be mounted in exactly one place. If two
components need the data, put it behind a context provider or a shared ref-counted
store.

### 6. Streaming a whole collection nine pages wide

`useCbtData` opened an unbounded live listener on `cbtQuestions` — the entire
question bank — and was imported by nine pages. Five of them only ever read
`courses` and still paid for the bank. On a 2,000-question bank that's **2,000 reads
per page view**.

**Fixed by:** making questions opt-in (`useCbtData({ withQuestions: true })`),
fetching them once per session with `getDocs` instead of streaming, and sharing the
`courses` listener across all mounts via a ref-counted store with a teardown grace
period so route changes don't re-attach (and re-bill) it.

Because the bank is now cached, anything writing to `cbtQuestions` must call
`refreshCbtQuestions()` afterwards.

**Rules:**
- Real-time is a feature, not a default. A question bank, a course catalogue, a
  settings document — these do not need `onSnapshot`. Use `getDocs` and cache.
- Don't make a shared hook fetch the union of what all its callers need. Make the
  expensive parts opt-in.

### 7. Queries with no `limit()`

The audit found 58 `onSnapshot` calls and only 11 `limit()` calls. Unbounded
listeners on `users`, `documents`, `questions`, `notifications`, `announcements`,
`announcementReads`, `requests`, `classEvents`, `staffChat`. Several were mounted in
`Topbar` / `UserSidebar`, i.e. on **every page**.

`announcementReads` was the worst shape: it grows by one document per announcement
per user, forever, and was read unbounded on every notifications view.

**Rule:** every collection query gets a `limit()`. If you genuinely need "all of
them", you need pagination, not a bigger listener.

### 8. Streaming documents just to count them

```js
onSnapshot(collection(db, "documents"), (snap) => setDocumentsCount(snap.size));
```

One read per document, per dashboard view, to display a single number.

**Fixed by:** `getCountFromServer()`, which bills 1 read per 1,000 index entries.

**Rule:** if you only need `.size`, use an aggregation query.

### 9. Debug instrumentation left in the registration path

`completeProfile()` wrote two `profileCompletionAudit` documents per signup — one
"attempt", one outcome — added to trace a past bug. Nothing ever read them. That was
2 of the ~7 writes each registration cost.

One registration was doing ~7 writes plus a full department scan. It needs 2.

**Rule:** temporary diagnostics get removed when the bug is fixed, or gated behind
`import.meta.env.DEV`.

### 10. Polling that re-writes an unchanged value

`VerifyEmail` polls `refreshEmailVerified()` every 4 seconds; that function wrote
`{ emailVerified: true }` to the user document on **every tick** once verified — a
write that changed nothing, still billed, and woke every listener on the doc.

The same file also called `navigate()` during render and returned early *above* its
hooks, so it rendered a different number of hooks on the verifying render. That's a
crash waiting to happen, and oxlint was already flagging it.

**Rules:**
- Guard writes behind "is it already this value?".
- Never `return` before a hook. Redirect from an effect, not during render.
- Don't ignore `react-hooks/rules-of-hooks` errors from the linter.

### 11. No cache, so every reload re-read everything

`src/firebase/config.js` used bare `getFirestore(app)` — memory-only cache. Every
page reload re-fetched every listener's full result set from the server at full
price. `src/native/enableFirestoreOffline.js` existed to fix this and was **never
imported anywhere**.

**Fixed by:** `initializeFirestore(app, { localCache: persistentLocalCache({ ... }) })`.

### 12. One Firebase project for dev and production

`.firebaserc` declared a single project (`uofa-reader`). No staging alias, no
emulator config, no `.env.development` / `.env.production` split. **Two months of
local development billed against the live quota** — and with bugs 1 and 2 running on
the dev machine too, one `npm run dev` session could consume the whole day's quota
for all 18 real users.

React `StrictMode` (correctly kept, in `src/main.jsx`) double-invokes effects in
development, doubling local listener-attach reads on top of that. Harmless in
production; not harmless when dev points at production.

**Fixed by:** emulator support (`VITE_USE_FIREBASE_EMULATOR=true`) and a loud console
warning when a dev build connects to the production project.

**Rule:** dev never touches the production project. Use the emulator suite, or a
separate Firebase project, and keep the credentials in `.env.development`.

---

## Checklist before you merge anything touching Firestore

- [ ] Every `onSnapshot` has an `unsubscribe()` the effect cleanup actually reaches —
      including any created inside an error callback.
- [ ] No dependency array contains an object or array derived from `snap.data()`
      (this includes `Timestamp`). Primitives only.
- [ ] No effect writes to a document it also reads via a listener.
- [ ] Every function returned from a hook is `useCallback`-wrapped.
- [ ] Every collection query has a `limit()`.
- [ ] New `where + orderBy` queries have an entry in `firestore.indexes.json`.
- [ ] Counting uses `getCountFromServer`, not `snap.size` over a streamed collection.
- [ ] Repeated writes are guarded by a value check; `serverTimestamp()` is not used
      in something that runs more than once.
- [ ] Listener-opening hooks are mounted in exactly one place.
- [ ] `npm run lint` reports no **errors** in `src/`.

## How to verify a fix

Open the Firebase console → Firestore → Usage. Load the page you changed, leave it
idle for 60 seconds, and watch the read and write counters. **They should be flat.**
A counter that climbs while nothing is happening is a loop, every time.
