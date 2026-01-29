import Button from "@/components/Button";
import ZoomableImage from "@/components/ZoomableImage";

type RaceAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
  external?: boolean;
  badge?: string;
};

type RaceCardProps = {
  heading: string;
  race: {
    title: string;
    date: string;
    posterImagePath: string;
  };
  posterAvailable: boolean;
  actions: RaceAction[];
};

export default function RaceCard({ heading, race, posterAvailable, actions }: RaceCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-white">{heading}</h3>
        <span className="text-sm text-white/60">{race.date}</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#0B0B0E]">
        {posterAvailable ? (
          <ZoomableImage
            src={race.posterImagePath}
            alt={`${race.title} poster`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            triggerClassName="group relative aspect-video cursor-pointer"
            imageClassName="object-cover transition duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-[#111122] via-[#0B0B0E] to-[#1b0b2e]">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">
              Poster coming soon
            </span>
          </div>
        )}
      </div>
      <p className="mt-4 text-sm text-white/70">{race.title}</p>
      {actions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-3">
          {actions.map((action) => (
            <div key={action.label} className="relative">
              <Button
                href={action.href}
                variant={action.variant ?? "secondary"}
                size="sm"
                external={action.external}
              >
                {action.label}
              </Button>
              {action.badge && (
                <span className="absolute -right-3 -top-2 rounded-[4px] bg-red-700/90 px-1.5 py-0.5 text-[9px] font-medium leading-none text-white">
                  {action.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
