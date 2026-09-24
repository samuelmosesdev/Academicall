/** Free vs Pro limits for UofA Readers */
export const FREE_LIMITS = {
  maxCourses: 5,
  practiceQuestions: 15,
  documentsPerCourse: 1,
  timedQuiz: false,
};

export const PRO_FEATURES = [
  "Unlimited courses across all faculties",
  "Full practice banks — no 15-question cap",
  "Timed exam-mode quizzes",
  "All documents & materials per course",
  "Class timetable access",
  "Priority access to new CBT sets",
];

export const FREE_FEATURES = [
  "Up to 5 courses (your department only)",
  "Practice sets capped at 15 questions",
  "1 document per course",
  "Untimed practice only",
  "Timetable locked",
];

/** Default catalogue — admin can override URLs in Payments settings */
export const DEFAULT_PLANS = [
  {
    id: "weekly",
    name: "Weekly",
    amount: 500,
    amountLabel: "₦500",
    period: "per week",
    description: "Short burst access for test week",
    url: "",
  },
  {
    id: "monthly",
    name: "Monthly",
    amount: 1500,
    amountLabel: "₦1,500",
    period: "per month",
    description: "Flexible month-to-month prep",
    url: "",
  },
  {
    id: "annual",
    name: "Annual",
    amount: 4000,
    amountLabel: "₦4,000",
    period: "per year",
    description: "Best value — full academic year",
    url: "https://paystack.shop/pay/5o79vdpr6a",
    highlighted: true,
  },
];

export function isPro(profile) {
  if (!profile) return false;
  if (profile.role === "admin" || profile.role === "agent" || profile.role === "alphaAgent" || profile.role === "courseRep") return true;
  const plan = (profile.plan || profile.subscription || "free").toLowerCase();
  if (plan === "pro" || plan === "paid" || plan === "premium") return true;
  if (profile.subscriptionExpiresAt?.toDate) {
    return profile.subscriptionExpiresAt.toDate() > new Date();
  }
  if (profile.subscriptionExpiresAt instanceof Date) {
    return profile.subscriptionExpiresAt > new Date();
  }
  return false;
}

export function planLabel(profile) {
  return isPro(profile) ? "Pro" : "Free";
}

/** Merge Firestore payment settings with default plan catalogue */
export function resolvePlans(settings = {}) {
  return DEFAULT_PLANS.map((p) => {
    const fromSettings = settings.plans?.[p.id] || {};
    return {
      ...p,
      url: (fromSettings.url ?? p.url) || "",
      amountLabel: fromSettings.amountLabel || p.amountLabel,
      enabled: fromSettings.enabled !== false,
    };
  });
}
