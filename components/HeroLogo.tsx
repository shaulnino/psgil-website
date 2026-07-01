import Image from "next/image";

type HeroLogoProps = {
  src?: string;
  alt?: string;
};

export default function HeroLogo({
  src = "/psgil-logo.png",
  alt = "ISL league logo",
}: HeroLogoProps) {
  const isLocalPublic = src.startsWith("/") && !src.startsWith("//");
  return (
    <div className="relative w-[220px] sm:w-[240px] md:w-[280px] lg:w-[320px]">
      <Image
        src={src}
        alt={alt}
        width={512}
        height={512}
        priority
        className="relative h-auto w-full animate-[f1-rise_0.7s_ease-out]"
        sizes="(max-width: 640px) 220px, (max-width: 768px) 240px, (max-width: 1024px) 280px, 320px"
        unoptimized={isLocalPublic}
      />
    </div>
  );
}
