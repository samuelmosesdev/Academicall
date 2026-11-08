# Staff access, Document Center and the Secretariat

## Roles, duties and permissions
- **Rank** (who can manage whom): Admin > Alpha Agent > Agent > everyone else. Only an Admin can change someone at or above their own rank.
- **Duties** are add-ons that any user can hold alongside their role (`users.staffTags`):
  - `news` = News Agent. They write, publish and moderate Academicall News. Admins can assign it, and so can Alpha Agents by default.
  - `secretary` = Secretary. They run the Secretariat. Admins assign it by default.
- **Permissions**: the Admin picks them for each person at **Admin → Staff access**, or from that person's user page. A person with no saved list gets the defaults for their role. Admins always have everything.
- These stay with Admins and can never be granted to anyone else: managing staff (creating agents, assigning staff roles, choosing permissions), platform settings, and opening a student's vault.

| Permission | Alpha default | Agent default |
|---|---|---|
| users.view, users.edit, users.suspend, users.password, users.courseRep, users.news | ✓ | users.view only |
| users.secretary, users.delete | – (grantable) | – |
| documents.review, documents.manage, courses.manage, cbt.manage, announcements.publish, feeds.moderate, requests.review | ✓ | ✓ |
| files.center, payments.review, activity.view, notifications.send | ✓ | – |
| Secretary duty: secretariat.records, secretariat.activity (default); secretariat.confidential, secretariat.archive (grantable) |

The API enforces every permission on its routes (`requireCap`). The agent sidebar and routes show only what the person holds.

## Password control
On a user's page, anyone with `users.password` (Admins, and Alpha Agents by default) can:
- **Force password change**: signs the person out on every device. Their next sign-in goes straight to the change-password page, and the API refuses everything else until they change it.
- **Temporary password**: shown to staff once. It also forces a change at the next sign-in.
- **Sign out everywhere**.

## Document Center (`/admin/files`, `/agent/files` with `files.center`)
- **Materials**: live, pending and rejected, plus a **Deleted** tab. Deleting a material now only moves it to Deleted, so it can be restored. "Delete forever" is for Admins only.
- **Group files**: every file shared in study groups. Deleted ones can be restored.
- **Vaults** (Admins only): who uses the vault and how much space it takes, file names only, and a trash that keeps deleted files for 30 days (`VAULT_TRASH_DAYS`). An Admin can restore a file, or open one after writing down a reason. Every open (and every look at a student's vault listing) is written to the audit log with the admin, the time, the file and the reason. Since 15 October 2026 the student is not sent a notification when a file is opened; restoring a file still tells them it is back. An Admin can also clear a PIN lockout.

## Secretariat (`/secretariat`)
- **Register**: memos, minutes, letters, reports, circulars and notices, numbered `ACA/SEC/YYYY/0001`. Each record has attachments and tags, a meeting date for minutes, and a status: draft → filed → archived. Records can be marked confidential.
- **Activity journal**: every logged action, with search and date filters, and CSV export.
- **Overview**: what's waiting (requests, materials, payment claims), the register broken down by type, this week's activity, and which staff are on duty.

## Migration
`20261014100000_staff_access_secretariat` makes these changes:
- adds the `staffTags`, `permissions` and `sessionsRevokedAt` columns
- adds soft-delete columns
- adds the `secretariat_records` table
- converts any existing `role = newsAgent` user to `role = user` with the `news` duty
