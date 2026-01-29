import Image from "next/image";

type HeroLogoProps = {
  src?: string;
  alt?: string;
};

export default function HeroLogo({
  src = "/psgil-logo.png",
  alt = "PSGiL league logo",
}: HeroLogoProps) {
  return (
    <div className="relative w-[220px] sm:w-[240px] md:w-[280px] lg:w-[320px]">
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,_rgba(112,32,176,0.35),_transparent_65%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-0 rounded-full border border-[#7020B0]/40 shadow-[0_0_45px_rgba(112,32,176,0.35)] animate-[logo-breathe_10s_ease-in-out_infinite]" />
      <Image
        src={src}
        alt={alt}
        width={512}
        height={512}
        priority
        className="relative h-auto w-full drop-shadow-[0_0_18px_rgba(112,32,176,0.3)] animate-[logo-fade_1.2s_ease-out]"
        sizes="(max-width: 640px) 220px, (max-width: 768px) 240px, (max-width: 1024px) 280px, 320px"
      />
    </div>
  );
}
