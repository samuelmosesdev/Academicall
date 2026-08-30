import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { activityApi } from "./api";

/**
 * Write an audit entry. Best-effort — failures are logged, not thrown to UI.
 *
 * @param {Object} opts
 * @param {string} opts.actorUid
 * @param {string} opts.actorName
 * @param {string} opts.action - e.g. "role.change", "user.suspend", "request.approve"
 * @param {string} [opts.targetUid]
 * @param {string} [opts.targetName]
 * @param {string} [opts.reference]
 * @param {Object} [opts.meta]
 * @param {string} [opts.status]
 */
export async function logActivity({
  actorUid,
  actorName,
  action,
  targetUid = null,
  targetName = null,
  reference = null,
  meta = {},
  status = "success",
}) {
  try {
    if (localStorage.getItem("academicall_token")) {
      await activityApi.create({ action, status, reference, meta: { ...meta, targetUid, targetName, actorName } });
      return;
    }
    await addDoc(collection(db, "activityLog"), {
      actorUid: actorUid || null,
      actorName: actorName || "System",
      userName: actorName || "System", // legacy field used by some dashboard tables
      action,
      targetUid,
      targetName,
      reference,
      meta,
      status,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("activityLog write failed:", err?.message || err);
  }
}