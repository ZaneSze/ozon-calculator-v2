"use client";

import { useId, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calculateOzonPricing,
  formatPricingFactor,
  getPricingFactor,
  normalizePricingSettings,
  pricingFactorToMultiplier,
  type PricingMode,
  type PricingSettings,
} from "@/lib/ozon-pricing";

const MODES = [
  { value: "multiplier", label: "按倍数" },
  { value: "discount", label: "按折扣" },
] as const;

function PriceFactor({ label, base, mode, multiplier, price, onChange, onCopy }: {
  label: string;
  base: string;
  mode: PricingMode;
  multiplier: number;
  price?: { rmb: number; rub: number };
  onChange: (value: number) => void;
  onCopy?: (label: string, value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const inputValue = draft ?? formatPricingFactor(getPricingFactor(mode, multiplier));
  const invalid = draft !== null && pricingFactorToMultiplier(mode, Number(draft)) === undefined;
  const otherMode = mode === "multiplier" ? "discount" : "multiplier";
  const equivalent = getPricingFactor(otherMode, multiplier).toFixed(2);

  return (
    <div className="min-w-0 space-y-1 rounded-md border border-border bg-card p-2">
      <div className="flex items-center justify-between gap-1">
        <Label htmlFor={id} className="text-xs font-semibold">{label}系数</Label>
        {price && onCopy && (
          <button type="button" aria-label={`复制${label}`} title={`复制${label}`}
            onClick={() => onCopy(label, String(price.rmb))}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-primary">
            <Copy className="size-3" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Input id={id} type="number" inputMode="decimal" step="any"
          min={mode === "multiplier" ? 1 : 0} max={mode === "discount" ? 10 : undefined}
          value={inputValue} aria-invalid={invalid} aria-describedby={`${id}-hint`}
          className="h-9 min-w-0 px-2 tabular-nums"
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            const next = pricingFactorToMultiplier(mode, Number(value));
            if (next !== undefined) onChange(next);
          }}
          onBlur={() => { if (!invalid) setDraft(null); }}
        />
        <span className="shrink-0 text-xs text-slate-600">{mode === "discount" ? "折" : "倍"}</span>
      </div>
      <p id={`${id}-hint`} className="text-xs leading-relaxed text-slate-600">
        基准：{base}<br />
        等效{otherMode === "discount" ? "折扣" : "倍数"}：{equivalent}{otherMode === "discount" ? " 折" : " 倍"}
      </p>
      {invalid && <p role="status" className="text-xs text-red-700">
        {mode === "discount" ? "请输入大于 0、且不超过 10 的折数。" : "请输入至少 1 倍。"}暂按上次有效系数计算。
      </p>}
      <div className="border-t pt-1">
        <div className="text-xs text-slate-600">{label}</div>
        <div className="break-all text-sm font-bold tabular-nums text-slate-900">{price ? `¥${price.rmb.toFixed(2)}` : "—"}</div>
        {price && <div className="break-all text-xs text-slate-600">≈ ₽{price.rub.toLocaleString("zh-CN")}</div>}
      </div>
    </div>
  );
}

export function OzonPriceSettings({ settings: savedSettings, targetPriceRMB, exchangeRate, onChange, onCopy }: {
  settings?: PricingSettings;
  targetPriceRMB: number;
  exchangeRate: number;
  onChange: (settings: PricingSettings) => void;
  onCopy?: (label: string, value: string) => void;
}) {
  const settings = normalizePricingSettings(savedSettings);
  const price = calculateOzonPricing(targetPriceRMB, exchangeRate, settings);

  return (
    <fieldset className="min-w-0 space-y-2 rounded-lg border border-border bg-secondary p-2">
      <legend className="px-1 text-xs font-bold text-slate-800">最高价格与划线价</legend>
      <div role="group" aria-label="价格计算方式" className="grid grid-cols-2 gap-2">
        {MODES.map(({ value, label }) => (
          <Button key={value} type="button" variant="segmented" size="lg" className="min-w-0 px-2 text-xs"
            aria-pressed={settings.mode === value} data-active={settings.mode === value}
            onClick={() => onChange({ ...settings, mode: value })}>{label}</Button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-slate-600">
        目标售价 → 最高价格 → 划线价。每一步按前一档价格反推并向上取整到元；4 折表示支付原价的 40%。
      </p>
      <div className="grid grid-cols-2 gap-2">
        <PriceFactor key={`highest-${settings.mode}`} label="最高价格" base="目标售价" mode={settings.mode}
          multiplier={settings.highestMultiplier} onChange={(highestMultiplier) => onChange({ ...settings, highestMultiplier })}
          price={price.isValid ? { rmb: price.highestPriceRMB, rub: price.highestPriceRUB } : undefined} onCopy={onCopy} />
        <PriceFactor key={`strike-${settings.mode}`} label="划线价" base="最高价格" mode={settings.mode}
          multiplier={settings.strikeMultiplier} onChange={(strikeMultiplier) => onChange({ ...settings, strikeMultiplier })}
          price={price.isValid ? { rmb: price.strikePriceRMB, rub: price.strikePriceRUB } : undefined} onCopy={onCopy} />
      </div>
      {!price.isValid && <p className="text-xs text-slate-600">{targetPriceRMB <= 0 ? "填入目标售价后显示计算结果。" : "当前目标售价、汇率或系数超出可计算范围。"}</p>}
    </fieldset>
  );
}
