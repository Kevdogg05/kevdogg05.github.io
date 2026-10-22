import { qrShape } from "@/lib/qr";

/** A scannable QR code: dark modules on white, sharp at any size. */
export function QrCode({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const { size, path } = qrShape(value);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges" className={className}>
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#160d2b" />
    </svg>
  );
}
