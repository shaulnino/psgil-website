"use client";

import { useState, useRef, useCallback } from "react";
import SuccessModal from "./SuccessModal";

const EMAIL = "psgileague@gmail.com";

type FormState = "idle" | "sending" | "sent" | "error";
type FormMode = "signup" | "question";

export default function ContactSection() {
  const [mode, setMode] = useState<FormMode>("signup");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [successMode, setSuccessMode] = useState<FormMode>("signup");
  const formRef = useRef<HTMLFormElement>(null);

  const switchMode = useCallback((next: FormMode) => {
    setMode(next);
    setState("idle");
    setErrorMsg("");
    formRef.current?.reset();
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    setErrorMsg("");

    const fd = new FormData(e.currentTarget);
    const base = {
      name: fd.get("name") as string,
      email: fd.get("email") as string,
      _hp: fd.get("_hp") as string,
    };
    const payload =
      mode === "signup"
        ? {
            ...base,
            type: "signup" as const,
            birthdate: fd.get("birthdate") as string,
            platform: fd.get("platform") as string,
            experience: fd.get("experience") as string,
          }
        : {
            ...base,
            type: "question" as const,
            subject: fd.get("subject") as string,
            message: fd.get("message") as string,
          };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong.");
      }

      setState("sent");
      formRef.current?.reset();
      setSuccessMode(mode);
      setShowModal(true);
    } catch (err) {
      setState("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to send. Please try again.",
      );
    }
  };

  const inputCls =
    "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#7020B0]/60 focus:ring-1 focus:ring-[#7020B0]/30";
  const selectCls =
    `${inputCls} [&>option]:bg-[#18181f] [&>option]:text-white`;
  const labelCls =
    "mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50";

  return (
    <div className="flex flex-col gap-6">
      {/* Info */}
      <div>
        <p className="text-sm text-white/70 leading-relaxed">
          Have a question, feedback, or interested in joining the league?
          Drop us a message and we&apos;ll get back to you.
        </p>

        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <a
              href={`mailto:${EMAIL}`}
              className="flex items-center gap-3 text-sm text-white/60 transition hover:text-white"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#D4AF37]">
                  <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                  <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                </svg>
              </span>
              {EMAIL}
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/40 transition hover:border-white/20 hover:text-white/70"
              title="Copy email"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-emerald-400">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                  <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Form */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
      >
        {/* Honeypot — hidden from real users, attracts bots */}
        <div aria-hidden="true" className="absolute -left-[9999px]">
          <label htmlFor="contact-hp">Leave empty</label>
          <input id="contact-hp" name="_hp" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
          {(["signup", "question"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                mode === m
                  ? "bg-[#7020B0] text-white shadow-[0_0_12px_rgba(112,32,176,0.4)]"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {m === "signup" ? "Sign Up" : "Questions"}
            </button>
          ))}
        </div>

        {/* Helper text */}
        {mode === "signup" && (
          <p className="text-xs leading-relaxed text-white/50">
            Leave your details and we&apos;ll reach out before the next season or when a seat opens.
          </p>
        )}

        {/* Name + Email (always visible) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contact-name" className={labelCls}>
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              placeholder="Your name"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="contact-email" className={labelCls}>
              Email <span className="text-red-400">*</span>
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className={inputCls}
            />
          </div>
        </div>

        {/* Sign-up extra fields */}
        {mode === "signup" && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="contact-birthdate" className={labelCls}>
                  Date of Birth <span className="text-red-400">*</span>
                </label>
                <input
                  id="contact-birthdate"
                  name="birthdate"
                  type="date"
                  required
                  className={inputCls}
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div>
                <label htmlFor="contact-platform" className={labelCls}>
                  Platform <span className="text-red-400">*</span>
                </label>
                <select id="contact-platform" name="platform" required defaultValue="" className={selectCls}>
                  <option value="" disabled>Select…</option>
                  <option value="PC">PC</option>
                  <option value="PS5">PS5</option>
                  <option value="Xbox">Xbox</option>
                </select>
              </div>
              <div>
                <label htmlFor="contact-experience" className={labelCls}>
                  Sim Racing Experience <span className="text-red-400">*</span>
                </label>
                <select id="contact-experience" name="experience" required defaultValue="" className={selectCls}>
                  <option value="" disabled>Select…</option>
                  <option value="0–4 months">0–4 months</option>
                  <option value="4 months–1 year">4 months–1 year</option>
                  <option value="1–2 years">1–2 years</option>
                  <option value="Above 2 years">Above 2 years</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Subject + Message (questions only) */}
        {mode === "question" && (
          <>
            <div>
              <label htmlFor="contact-subject" className={labelCls}>
                Subject
              </label>
              <input
                id="contact-subject"
                name="subject"
                type="text"
                placeholder="What is this about?"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="contact-message" className={labelCls}>
                Message <span className="text-red-400">*</span>
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={4}
                placeholder="Your message..."
                className={`${inputCls} resize-y`}
              />
            </div>
          </>
        )}

        {state === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7020B0] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(112,32,176,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(112,32,176,0.6)] disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {state === "sending" ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending…
            </>
          ) : mode === "signup" ? (
            "Join ISL"
          ) : (
            "Send Message"
          )}
        </button>
      </form>

      <SuccessModal
        mode={successMode}
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setState("idle");
        }}
      />
    </div>
  );
}
