import type { Metadata } from "next";
import Section from "@/components/Section";

export const metadata: Metadata = {
  title: "Privacy Policy | ISL",
  description: "Privacy policy for the ISL website.",
};

export default function PrivacyPage() {
  return (
    <main className="bg-[#0B0B0E] text-white">
      <Section
        title="Privacy Policy"
        description="Last updated: February 19, 2026"
        pageHeader
      >
        <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-white/80 md:p-8 md:text-base">
          <p>
            F1 Israeli Super League (ISL) respects your privacy.
            This page explains what information we collect, how we use it, and
            how you can contact us about your data.
          </p>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-[#D4AF37]">
              Information We Collect
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Information you submit through our contact form (such as name,
                email address, and message).
              </li>
              <li>Basic technical logs needed to protect the site from spam.</li>
              <li>
                Public league-related content displayed on the site (for
                example, article metadata and racing results).
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-[#D4AF37]">
              How We Use Information
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>To respond to contact form submissions.</li>
              <li>To operate, secure, and improve the website.</li>
              <li>
                To publish league content, updates, and announcements,
                including social media updates.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-[#D4AF37]">
              Data Sharing
            </h2>
            <p>
              We do not sell personal data. We may use trusted service
              providers for website hosting, email delivery, and social media
              publishing as needed to run ISL services.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-[#D4AF37]">
              Data Retention
            </h2>
            <p>
              We retain data only as long as needed for communication,
              moderation, operational, or legal purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-[#D4AF37]">
              Your Rights and Deletion Requests
            </h2>
            <p>
              To request access, correction, or deletion of personal data,
              contact us at <a className="text-[#d7b3ff] hover:text-white" href="mailto:psgileague@gmail.com">psgileague@gmail.com</a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-[#D4AF37]">
              Contact
            </h2>
            <p>
              For privacy questions, email{" "}
              <a
                className="text-[#d7b3ff] hover:text-white"
                href="mailto:psgileague@gmail.com"
              >
                psgileague@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </Section>
    </main>
  );
}

