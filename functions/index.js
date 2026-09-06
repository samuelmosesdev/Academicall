/**
 * UofA Readers Cloud Functions
 *
 * DEPRECATED: paystackWebhook below writes to Firestore, which is no longer
 * the source of truth. Point your Paystack dashboard webhook at the API
 * instead: POST https://<your-api-domain>/api/v1/payments/webhook/paystack
 * (see Academicall-api/src/controllers/payments.controller.ts). Once you've
 * switched the dashboard URL over, this function can be removed.
 *
 * - paystackWebhook / verifyPaystackReference (legacy, Firestore-backed)
 * - getR2UploadUrl (presigned PUT for documents, avatars, images — currently
 *   unused; the app uploads directly to Cloudinary instead)
 *
 * R2 config (server only — never put secrets in the Vite app):
 *   firebase functions:config:set \
 *     r2.account_id="846fcf28d6114e4cd85ef238db9fe993" \
 *     r2.access_key_id="YOUR_NEW_ACCESS_KEY" \
 *     r2.secret_access_key="YOUR_NEW_SECRET" \
 *     r2.bucket="uofa-readers" \
 *     r2.public_base_url="https://pub-xxxx.r2.dev"
 *
 * Endpoint for S3 clients:
 *   https://846fcf28d6114e4cd85ef238db9fe993.r2.cloudflarestorage.com
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

admin.initializeApp();
const db = admin.firestore();

/* ───────────────── Paystack ───────────────── */

function getPaystackSecret() {
  const fromConfig = functions.config().paystack?.secret;
  return fromConfig || process.env.PAYSTACK_SECRET_KEY || "";
}

function verifyPaystackSignature(rawBody, signature, secret) {
  if (!secret || !signature || !rawBody) return false;
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(hash, "utf8");
    const b = Buffer.from(String(signature), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function extractEmail(eventData) {
  const d = eventData || {};
  return (
    d.customer?.email ||
    d.email ||
    d.authorization?.email ||
    d.metadata?.email ||
    d.metadata?.customer_email ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();
}

function extractUserId(eventData) {
  const m = eventData?.metadata || {};
  return (m.userId || m.user_id || m.uid || "").toString().trim();
}

function extractPlanId(eventData) {
  const m = eventData?.metadata || {};
  const ref = (eventData?.reference || "").toString().toLowerCase();
  if (m.planId || m.plan_id) return String(m.planId || m.plan_id);
  if (ref.includes("weekly")) return "weekly";
  if (ref.includes("monthly")) return "monthly";
  if (ref.includes("annual") || ref.includes("year")) return "annual";
  return "annual";
}

async function activatePro({ userId, email, planId, reference, amount, raw }) {
  const batch = db.batch();
  let uid = userId;

  if (!uid && email) {
    const snap = await db.collection("users").where("email", "==", email).limit(5).get();
    let docs = snap.docs;
    if (docs.length === 0) {
      const all = await db.collection("users").where("role", "==", "user").get();
      docs = all.docs.filter((d) => (d.data().email || "").toLowerCase() === email);
    }
    if (docs.length === 0) {
      return { ok: false, reason: "no_user_for_email", email };
    }
    uid = docs[0].id;
  }

  if (!uid) return { ok: false, reason: "missing_user" };

  const userRef = db.collection("users").doc(uid);
  batch.set(
    userRef,
    {
      plan: "pro",
      subscription: "pro",
      subscriptionPlanId: planId || "annual",
      planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      planUpdatedBy: "paystack_webhook",
      lastPaymentReference: reference || null,
      lastPaymentAmount: amount ?? null,
    },
    { merge: true }
  );

  const payRef = db.collection("payments").doc();
  batch.set(payRef, {
    userId: uid,
    email: email || null,
    planId: planId || "annual",
    reference: reference || null,
    amount: amount ?? null,
    source: "paystack_webhook",
    status: "success",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    rawSummary: {
      channel: raw?.channel || null,
      paid_at: raw?.paid_at || null,
      currency: raw?.currency || null,
    },
  });

  const claims = await db.collection("paymentClaims").where("userId", "==", uid).limit(30).get();
  claims.docs.forEach((d) => {
    if (d.data().status === "activated") return;
    batch.update(d.ref, {
      status: "activated",
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      activatedBy: "paystack_webhook",
      reference: reference || null,
    });
  });

  await batch.commit();
  return { ok: true, userId: uid, email, planId };
}

exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const secret = getPaystackSecret();
  if (!secret) {
    console.error("PAYSTACK secret not configured");
    res.status(500).send("Server misconfigured");
    return;
  }

  const rawBody = req.rawBody
    ? req.rawBody.toString("utf8")
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body);

  const signature = req.headers["x-paystack-signature"];
  if (!verifyPaystackSignature(rawBody, signature, secret)) {
    console.warn("Invalid Paystack signature");
    res.status(401).send("Invalid signature");
    return;
  }

  let event;
  try {
    event = typeof req.body === "object" ? req.body : JSON.parse(rawBody);
  } catch {
    res.status(400).send("Invalid JSON");
    return;
  }

  const eventType = event.event;
  const data = event.data || {};

  if (eventType !== "charge.success" && eventType !== "subscription.create") {
    res.status(200).json({ received: true, handled: false, event: eventType });
    return;
  }

  const reference = data.reference || data.subscription_code || null;
  if (reference) {
    const existing = await db.collection("payments").where("reference", "==", reference).limit(1).get();
    if (!existing.empty) {
      res.status(200).json({ received: true, duplicate: true, reference });
      return;
    }
  }

  const email = extractEmail(data);
  const userId = extractUserId(data);
  const planId = extractPlanId(data);
  const amount = typeof data.amount === "number" ? data.amount / 100 : null;

  try {
    const result = await activatePro({ userId, email, planId, reference, amount, raw: data });
    if (!result.ok) {
      console.warn("Paystack success but could not activate", result);
      await db.collection("paymentOrphans").add({
        reason: result.reason,
        email: email || null,
        reference: reference || null,
        amount,
        planId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        event: eventType,
      });
      res.status(200).json({ received: true, activated: false, ...result });
      return;
    }
    console.log("Pro activated via Paystack", result);
    res.status(200).json({ received: true, activated: true, ...result });
  } catch (err) {
    console.error("Webhook handler error", err);
    res.status(500).send("Handler error");
  }
});

exports.verifyPaystackReference = functions.https.onRequest(async (req, res) => {
  const secret = getPaystackSecret();
  if (!secret) {
    res.status(500).json({ error: "Secret not set" });
    return;
  }
  const reference = (req.query.reference || req.body?.reference || "").toString().trim();
  if (!reference) {
    res.status(400).json({ error: "reference required" });
    return;
  }

  try {
    const resp = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const json = await resp.json();
    if (!json.status || json.data?.status !== "success") {
      res.status(200).json({ verified: false, paystack: json });
      return;
    }

    const data = json.data;
    const result = await activatePro({
      userId: extractUserId(data),
      email: extractEmail(data),
      planId: extractPlanId(data),
      reference: data.reference,
      amount: typeof data.amount === "number" ? data.amount / 100 : null,
      raw: data,
    });
    res.status(200).json({ verified: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────── Cloudflare R2 ───────────────── */

function getR2Config() {
  const c = functions.config().r2 || {};
  return {
    accountId: c.account_id || process.env.R2_ACCOUNT_ID || "846fcf28d6114e4cd85ef238db9fe993",
    accessKeyId: c.access_key_id || process.env.R2_ACCESS_KEY_ID || "4045a13ef7df59874a79568e1b38c683",
    secretAccessKey: c.secret_access_key || process.env.R2_SECRET_ACCESS_KEY || "da82304bdb72007c490e502dd9f3a57a2e8d1b7085406291e2ce30b494ea7944",
    bucket: c.bucket || process.env.R2_BUCKET || "",
    publicBaseUrl: (c.public_base_url || process.env.R2_PUBLIC_BASE_URL || "https://846fcf28d6114e4cd85ef238db9fe993.r2.cloudflarestorage.com").replace(/\/$/, ""),
  };
}

function r2Client() {
  const { accountId, accessKeyId, secretAccessKey } = getR2Config();
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Callable: returns a 5-minute presigned PUT URL.
 * Client must be signed in.
 *
 * request.data = {
 *   folder: "documents" | "avatars" | "images",
 *   fileName: string,
 *   contentType: string
 * }
 */
exports.getR2UploadUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }

  const folder = data?.folder || "documents";
  const fileName = data?.fileName;
  const contentType = data?.contentType;

  if (!fileName || !contentType) {
    throw new functions.https.HttpsError("invalid-argument", "fileName and contentType required.");
  }

  const allowed = ["documents", "avatars", "images"];
  if (!allowed.includes(folder)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid folder.");
  }

  const isPdf = contentType === "application/pdf";
  const isImage = String(contentType).startsWith("image/");
  if (folder === "documents" && !isPdf && !isImage) {
    throw new functions.https.HttpsError("invalid-argument", "Documents must be PDF or image.");
  }
  if ((folder === "avatars" || folder === "images") && !isImage) {
    throw new functions.https.HttpsError("invalid-argument", "Only images allowed.");
  }

  const cfg = getR2Config();
  if (!cfg.bucket || !cfg.publicBaseUrl) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "R2 bucket or public_base_url not configured."
    );
  }

  const safeName = String(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  const key = `${folder}/${context.auth.uid}/${Date.now()}-${safeName}`;

  try {
    const client = r2Client();
    const command = new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    const publicUrl = `${cfg.publicBaseUrl}/${key}`;
    return { uploadUrl, publicUrl, key };
  } catch (err) {
    console.error("getR2UploadUrl error", err);
    throw new functions.https.HttpsError("internal", err.message || "Could not create upload URL.");
  }
});

/* ───────────────── Class event fan-out ───────────────── */

// When a classEvent is created, notify department students and create per-student timetableEvents
exports.onClassCreated = functions.firestore.document('classEvents/{id}').onCreate(async (snap, context) => {
  const data = snap.data() || {};
  const classId = context.params.id;
  const department = data.department;
  if (!department) return null;

  // Query students in the department
  const usersSnap = await db.collection('users').where('department', '==', department).get();
  const targets = usersSnap.docs.filter(d => {
    const r = d.data().role || 'user';
    return (r === 'user' || r === 'courseRep') && d.id !== data.createdBy;
  });

  if (targets.length === 0) return null;

  const notifDocs = [];
  const ttDocs = [];
  const when = data.startsAt ? new Date(data.startsAt._seconds ? data.startsAt._seconds * 1000 : data.startsAt).toLocaleString() : null;
  const body = [data.courseCode, data.venue || 'Venue TBA', when, data.notes || ''].filter(Boolean).join(' · ');

  for (const u of targets) {
    const uid = u.id;
    notifDocs.push({
      userId: uid,
      type: 'lecture_update',
      title: data.title || 'Class scheduled',
      body,
      department: department,
      courseCode: data.courseCode || null,
      readByUser: false,
      createdByUid: data.createdBy || null,
      createdByName: data.createdByName || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const allow = (u.data().settings || {}).notifClassReminders !== false;
    if (allow) {
      ttDocs.push({
        userId: uid,
        title: `Class: ${data.title || ''}`,
        courseCode: data.courseCode || null,
        venue: data.venue || null,
        startsAt: data.startsAt || null,
        endsAt: data.endsAt || null,
        createdBy: data.createdBy || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'courseRep',
        sourceId: classId,
      });
    }
  }

  // Batch writes in chunks of 400
  const chunkSize = 400;
  const writeChunks = async (items, collectionName) => {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach((d) => {
        const ref = db.collection(collectionName).doc();
        batch.set(ref, d);
      });
      await batch.commit();
    }
  };

  const promises = [];
  if (notifDocs.length) promises.push(writeChunks(notifDocs, 'notifications'));
  if (ttDocs.length) promises.push(writeChunks(ttDocs, 'timetableEvents'));

  await Promise.all(promises);
  return null;
});

// When a classEvent is deleted, notify students and remove generated timetableEvents (sourceId)
exports.onClassDeleted = functions.firestore.document('classEvents/{id}').onDelete(async (snap, context) => {
  const data = snap.data() || {};
  const classId = context.params.id;
  const department = data.department;
  if (!department) return null;

  const usersSnap = await db.collection('users').where('department', '==', department).get();
  const targets = usersSnap.docs.filter(d => {
    const r = d.data().role || 'user';
    return (r === 'user' || r === 'courseRep') && d.id !== data.createdBy;
  });

  if (targets.length === 0) return null;

  const notifDocs = [];
  const when = data.startsAt ? new Date(data.startsAt._seconds ? data.startsAt._seconds * 1000 : data.startsAt).toLocaleString() : null;
  const body = [data.courseCode, when, 'Cancelled by Course Rep'].filter(Boolean).join(' · ');

  for (const u of targets) {
    const uid = u.id;
    notifDocs.push({
      userId: uid,
      type: 'lecture_update',
      title: `Class cancelled: ${data.title || ''}`,
      body,
      department,
      courseCode: data.courseCode || null,
      readByUser: false,
      createdByUid: data.createdBy || null,
      createdByName: data.createdByName || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Delete timetableEvents where sourceId == classId
  const ttQuery = await db.collection('timetableEvents').where('sourceId', '==', classId).get();
  const ttDeletes = [];
  ttQuery.docs.forEach(d => ttDeletes.push(d.ref));

  // Commit notifications and deletes
  const batch = db.batch();
  notifDocs.forEach((n) => {
    const r = db.collection('notifications').doc();
    batch.set(r, n);
  });
  ttDeletes.forEach((r) => batch.delete(r));
  await batch.commit();
  return null;
});