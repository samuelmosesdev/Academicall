import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Mail, Phone, MapPin } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#F3F6FB] text-[#101C30] antialiased">
      <header className="border-b border-[#14355E]/10 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center">
            <img
              src="/brand/logo-horizontal.png"
              alt="Academicall"
              className="h-7 w-auto object-contain"
            />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#14355E]/70 hover:text-[#3D6FE0]"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-10 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#3D6FE0]/10 text-[#3D6FE0]">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#101C30]">
              Privacy Policy
            </h1>
            <p className="mt-1 text-sm text-[#14355E]/55">
              Last updated: September 2026 · Surfwired Technologies
            </p>
          </div>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed text-[#14355E]/85">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#101C30]">1. Who we are</h2>
            <p>
              Academicall is operated by <strong className="text-[#101C30]">Surfwired Technologies</strong>, based in
              Abuja, Nigeria. We provide a web and Android platform that helps universities and
              students manage guided academic workflows — admissions, coursework, and records.
            </p>
            <p className="mt-2">
              Contact:{" "}
              <a href="mailto:info@surfwired.com" className="text-[#3D6FE0] hover:underline">
                info@surfwired.com
              </a>{" "}
              ·{" "}
              <a href="tel:+2348152243717" className="text-[#3D6FE0] hover:underline">
                0815 224 3717
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#101C30]">2. Information we collect</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-[#101C30]">Account data</strong> — name, email address, password (hashed),
                faculty, level, and course selections you provide during signup or profile completion.
              </li>
              <li>
                <strong className="text-[#101C30]">Usage data</strong> — reading progress, practice scores, and
                interaction with department feeds so we can improve the product and show relevant content.
              </li>
              <li>
                <strong className="text-[#101C30]">Device data</strong> — basic technical information (browser type,
                OS, app version) needed for security and compatibility.
              </li>
              <li>
                We do <strong className="text-[#101C30]">not</strong> sell your personal data to third parties.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#101C30]">3. How we use your data</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>To create and manage your Academicall account.</li>
              <li>To deliver guided workflows, materials, practice sessions and announcements that match your campus and courses.</li>
              <li>To send important service messages (e.g. password reset, security alerts).</li>
              <li>To improve reliability, performance and features of the web and Android apps.</li>
              <li>To comply with legal obligations under Nigerian law.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#101C30]">4. Storage & security</h2>
            <p>
              Your data is stored securely using industry-standard practices (encrypted
              connections, access controls, hashed passwords). We retain account
              information for as long as your account is active. You may request deletion
              of your account and associated data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#101C30]">5. Sharing</h2>
            <p>
              We do not sell or rent your personal information. We may share limited data
              with trusted service providers (e.g. cloud hosting, authentication) strictly
              to operate the platform, under agreements that protect your information. We
              may disclose information if required by law or to protect the rights and
              safety of users.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#101C30]">6. Your choices</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>You can update profile details at any time from your account settings.</li>
              <li>You can request access to or deletion of your data by emailing us.</li>
              <li>
                When you sign up or sign in, you will be asked to confirm that you have
                read and accept this Privacy Policy. Acceptance is required to use the
                service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#101C30]">7. Children</h2>
            <p>
              Academicall is intended for students in tertiary institutions and university staff.
              If you are under 18, please use the platform with the guidance of a parent or guardian.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#101C30]">8. Changes</h2>
            <p>
              We may update this policy from time to time. The “Last updated” date at the
              top will change. Continued use of Academicall after changes means you accept
              the updated policy. Material changes will be communicated where appropriate.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#101C30]">9. Contact</h2>
            <p>For privacy questions or data requests:</p>
            <div className="mt-3 space-y-1.5 rounded-xl border border-[#14355E]/10 bg-white p-4 text-sm">
              <p className="flex items-center gap-2">
                <MapPin size={14} className="text-[#3D6FE0]" />
                Surfwired Technologies · Abuja, Nigeria
              </p>
              <p className="flex items-center gap-2">
                <Mail size={14} className="text-[#3D6FE0]" />
                <a href="mailto:info@surfwired.com" className="text-[#3D6FE0] hover:underline">
                  info@surfwired.com
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Phone size={14} className="text-[#3D6FE0]" />
                <a href="tel:+2348152243717" className="text-[#3D6FE0] hover:underline">
                  0815 224 3717
                </a>
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 rounded-xl border border-[#D6E64A]/40 bg-[#D6E64A]/15 p-5 text-sm text-[#101C30]">
          <p className="font-semibold">Acceptance on sign-in / sign-up</p>
          <p className="mt-1 text-[#14355E]/80">
            When users create an account or sign in, they will be presented with a
            clear option to accept this Privacy Policy. Acceptance is required before
            the account can be used. Link to this page from the checkbox text
            (e.g. “I have read and accept the Privacy Policy”).
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#3D6FE0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14355E]"
          >
            <ArrowLeft size={16} />
            Return to Academicall
          </Link>
        </div>
      </main>
    </div>
  );
}
