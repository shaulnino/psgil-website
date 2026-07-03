import { Button } from "@/components/ui/button";
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
    <div className="rounded-[2px] border border-[color:var(--isl-hairline)] bg-cream p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display font-bold tracking-[0.005em] leading-[1.05] text-lg text-ink">{heading}</h3>
        <span className="num text-sm text-meta">{race.date}</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-[2px] border border-[color:var(--isl-hairline)] bg-sink">
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
          <div className="flex aspect-video items-center justify-center bg-sink">
            <span className="font-isl-body text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-meta">
              Poster coming soon
            </span>
          </div>
        )}
      </div>
      <p className="mt-4 text-sm text-ink-2">{race.title}</p>
      {actions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-3">
          {actions.map((action) => (
            <div key={action.label} className="relative">
              <Button
                href={action.href}
                variant={action.variant ?? "secondary"}
                size="sm"
                {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {action.label}
              </Button>
              {action.badge && (
                <span className="num absolute -end-3 -top-2 rounded-[2px] border border-oxblood bg-paper px-1.5 py-0.5 text-[9px] font-medium leading-none text-oxblood">
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
