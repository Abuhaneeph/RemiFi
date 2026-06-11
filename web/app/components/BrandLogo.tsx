import Link from "next/link";
import { BRAND_LOGO_SRC } from "../lib/brand";

export function BrandLogo({
  src = BRAND_LOGO_SRC,
  size = 40,
  className,
  linked = true,
}: {
  src?: string;
  size?: number;
  className?: string;
  linked?: boolean;
}) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Remifi"
      width={size}
      height={size}
      className={className}
      decoding="async"
    />
  );

  if (!linked) return image;

  return (
    <Link href="/home" className="inline-flex shrink-0" aria-label="Remifi home">
      {image}
    </Link>
  );
}
