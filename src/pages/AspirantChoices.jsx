import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { aspirantApi } from "../lib/aspirantApi";
import { appConfirm, notify } from "../lib/dialogs";
import AspirantChoicesForm from "../components/house/AspirantChoicesForm";
import { PageHeader } from "../components/ui";

/** /dashboard/choices — change institutions of choice; "I got admission" turns the account into a student account. */
export default function AspirantChoices() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  async function admitted() {
    const ok = await appConfirm("Congratulations! We'll switch your account to a student account and ask for your faculty, department and level next. You'll leave your Aspirant Houses.", { confirmLabel: "Switch to student" });
    if (!ok) return;
    try {
      await aspirantApi.admitted();
      await refreshProfile();
      navigate("/complete-profile", { replace: true });
    } catch (e) { notify.error(e.message); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Institutions of choice" description="One or two institutions. Changing a choice moves you to that institution's Aspirant House." />
      <section className="acx-card !p-5 sm:!p-6">
        <AspirantChoicesForm
          profile={profile}
          compact
          onSubmit={async (body) => {
            await aspirantApi.save(body);
            await refreshProfile();
            notify.success("Choices saved");
            navigate("/dashboard/house");
          }}
        />
      </section>
      <section className="flex flex-wrap items-center gap-4 rounded-[1.25rem] bg-midnight p-5 text-white">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lemon text-midnight"><GraduationCap size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Got admission?</p>
          <p className="text-sm text-white/65">Switch to a student account to get your courses, department feed and materials.</p>
        </div>
        <button type="button" onClick={admitted} className="rounded-full bg-lemon px-4 py-2 text-sm font-semibold text-midnight">I got admission</button>
      </section>
    </div>
  );
}
