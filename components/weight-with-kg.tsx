import { cn } from "@/lib/utils";
import { formatWeightParts } from "@/lib/weight-format";

interface WeightWithKgProps {
  weightG: number | undefined | null;
  className?: string;
  gramClassName?: string;
  kgClassName?: string;
}

export function WeightWithKg({ weightG, className, gramClassName, kgClassName }: WeightWithKgProps) {
  const parts = formatWeightParts(weightG);
  if (!parts) return null;

  return (
    <span className={cn("inline-flex items-baseline gap-1 whitespace-nowrap", className)}>
      <span className={cn("font-semibold text-current", gramClassName)}>{parts.grams}</span>
      <span className={cn("text-[0.92em] font-medium text-indigo-500/80", kgClassName)}>({parts.kg})</span>
    </span>
  );
}
