import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  transparent?: boolean;
};

export function BrandLogo({ className, transparent = false }: BrandLogoProps) {
  return (
    <Image
      src={transparent ? "/brand/kemtit-logo-v2-transparent.png" : "/brand/kemtit-logo-v2.png"}
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      className={className}
    />
  );
}
