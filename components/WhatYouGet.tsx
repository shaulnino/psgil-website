type WhatYouGetItem = {
  title: string;
  description: string;
  icon: "shield" | "users" | "chart";
};

const icons = {
  shield: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm8 2c-2.2 0-4 1.8-4 4v2h8v-2c0-2.2-1.8-4-4-4zm-8 0c-2.2 0-4 1.8-4 4v2h6v-2c0-2.2-1.8-4-4-4z"
        fill="currentColor"
      />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        d="M4 19h16M7 16V9m5 7V6m5 10v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
};

export default function WhatYouGet({ items }: { items: WhatYouGetItem[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.title}
          className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-[#7020B0]/60 hover:bg-white/10"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#7020B0] transition group-hover:text-white">
            {icons[item.icon]}
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold text-white">{item.title}</h3>
          <p className="mt-2 text-sm text-white/70">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
