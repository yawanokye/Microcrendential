import Image from "next/image";

type UccBrandLockupProps = {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
  subtitle?: string;
};

export function UccGrowthWordmark() {
  return <>UCC <span>Growth<sup>+</sup></span></>;
}

export function UccBrandLockup({
  className = "",
  compact = false,
  inverse = false,
  subtitle = "Professional and lifelong learning",
}: UccBrandLockupProps) {
  return (
    <span className={`ucc-brand-lockup${compact ? " compact" : ""}${inverse ? " inverse" : ""}${className ? ` ${className}` : ""}`}>
      <span className="ucc-brand-crest-frame">
        <Image
          className="ucc-brand-crest"
          unoptimized
          width={56}
          height={56}
          src="/ucc_crest_approved_2026.png"
          alt="University of Cape Coast crest"
          priority
        />
      </span>
      <span className="ucc-brand-copy">
        <strong className="ucc-growth-wordmark"><UccGrowthWordmark /></strong>
        <small className="ucc-brand-subtitle">{subtitle}</small>
      </span>
    </span>
  );
}
