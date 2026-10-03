import Image from "next/image";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <Image
      src="/brand/kemtit-logo-v2.png"
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      className={className}
    />
  );
}
