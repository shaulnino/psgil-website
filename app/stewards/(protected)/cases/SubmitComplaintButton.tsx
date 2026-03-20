"use client";

import FormActionButton from "@/app/stewards/components/FormActionButton";

export default function SubmitComplaintButton() {
  return (
    <FormActionButton
      idleLabel="Submit Complaint"
      loadingLabel="Submitting..."
      className="rounded-full bg-[#7020B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7c2ac3]"
    />
  );
}
