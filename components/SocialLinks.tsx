type SocialLink = {
  label: string;
  href: string;
  icon: "facebook" | "discord" | "youtube" | "instagram";
};

type SocialLinksProps = {
  items: SocialLink[];
  variant?: "full" | "compact";
};

const icons = {
  facebook: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v6h3v-6h3l1-3h-4v-2c0-.6.4-1 1-1z"
        fill="currentColor"
      />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M19.5 6.5a16 16 0 0 0-4.1-1.3l-.2.4a12.4 12.4 0 0 1 3.7 1.4c-1.6-.8-3.3-1.3-5-1.5-1.7.2-3.4.7-5 1.5a12.4 12.4 0 0 1 3.7-1.4l-.2-.4a16 16 0 0 0-4.1 1.3C6.1 8.4 5.4 10.6 5 12.7a8.9 8.9 0 0 0 2.9 2.1l.7-.9c-.6-.2-1.2-.6-1.7-1 1.6 1.2 3.6 1.8 5.1 1.8s3.5-.6 5.1-1.8c-.5.4-1.1.8-1.7 1l.7.9a8.9 8.9 0 0 0 2.9-2.1c-.4-2.1-1.1-4.3-2.5-6.2zm-8 5.5c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1zm4.9 0c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1z"
        fill="currentColor"
      />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M22 8.5a3 3 0 0 0-2.1-2.1C18 6 12 6 12 6s-6 0-7.9.4A3 3 0 0 0 2 8.5a31 31 0 0 0 0 7 3 3 0 0 0 2.1 2.1C6 18 12 18 12 18s6 0 7.9-.4a3 3 0 0 0 2.1-2.1 31 31 0 0 0 0-7zM10 14.7V9.3L15 12l-5 2.7z"
        fill="currentColor"
      />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm6.5-8.2a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM20 9.2c0-1.8-.5-3.2-1.5-4.2S16.1 3.5 14.3 3.5h-4.6c-1.8 0-3.2.5-4.2 1.5S4 7.4 4 9.2v5.6c0 1.8.5 3.2 1.5 4.2s2.4 1.5 4.2 1.5h4.6c1.8 0 3.2-.5 4.2-1.5s1.5-2.4 1.5-4.2V9.2zm-2 5.5a3.7 3.7 0 0 1-1 2.6 3.7 3.7 0 0 1-2.6 1H9.6a3.7 3.7 0 0 1-2.6-1 3.7 3.7 0 0 1-1-2.6V9.2a3.7 3.7 0 0 1 1-2.6 3.7 3.7 0 0 1 2.6-1h4.6a3.7 3.7 0 0 1 2.6 1 3.7 3.7 0 0 1 1 2.6v5.5z"
        fill="currentColor"
      />
    </svg>
  ),
};

export default function SocialLinks({ items, variant = "full" }: SocialLinksProps) {
  const isCompact = variant === "compact";

  return (
    <div className={`flex flex-wrap items-center ${isCompact ? "gap-2" : "gap-4"}`}>
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`PSGiL on ${item.label}`}
          className={
            isCompact
              ? "flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-[#7020B0]/60 hover:text-white"
              : "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:border-[#7020B0]/60 hover:text-white"
          }
        >
          <span className="text-[#7020B0]">
            <span className={isCompact ? "block scale-90" : ""}>{icons[item.icon]}</span>
          </span>
          {!isCompact && item.label}
        </a>
      ))}
    </div>
  );
}
