import { cnyToRub } from "./currency";

export type PricingMode = "multiplier" | "discount";

export interface PricingSettings {
  mode: PricingMode;
  highestMultiplier: number;
  strikeMultiplier: number;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  mode: "discount",
  highestMultiplier: 2.5,
  strikeMultiplier: 1 / 0.6,
};

export interface OzonPricing {
  isValid: boolean;
  targetPriceRMB: number;
  targetPriceRUB: number;
  highestPriceRMB: number;
  highestPriceRUB: number;
  strikePriceRMB: number;
  strikePriceRUB: number;
}

function isMultiplier(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1;
}

export function normalizePricingSettings(value?: Partial<PricingSettings> | null): PricingSettings {
  return {
    mode: value?.mode === "multiplier" ? "multiplier" : "discount",
    highestMultiplier: isMultiplier(value?.highestMultiplier) ? value.highestMultiplier : DEFAULT_PRICING_SETTINGS.highestMultiplier,
    strikeMultiplier: isMultiplier(value?.strikeMultiplier) ? value.strikeMultiplier : DEFAULT_PRICING_SETTINGS.strikeMultiplier,
  };
}

// 统一存储倍数，切换显示方式时不把已四舍五入的显示值写回配置。
export function pricingFactorToMultiplier(mode: PricingMode, factor: number): number | undefined {
  if (!Number.isFinite(factor) || (mode === "discount" && (factor <= 0 || factor > 10))) return undefined;
  const multiplier = mode === "discount" ? 10 / factor : factor;
  return isMultiplier(multiplier) ? multiplier : undefined;
}

export function getPricingFactor(mode: PricingMode, multiplier: number): number {
  return mode === "discount" ? 10 / multiplier : multiplier;
}

export function formatPricingFactor(value: number): string {
  return String(Number(value.toPrecision(10)));
}

function ceilRmb(value: number): number {
  // 避免 1.1 × 100 这类浮点误差把整数价格多进一元。
  const nearest = Math.round(value);
  return Math.abs(value - nearest) <= Math.abs(value) * Number.EPSILON ? nearest : Math.ceil(value);
}

export function calculateOzonPricing(price: number, rate: number, settings?: PricingSettings): OzonPricing {
  const invalid: OzonPricing = {
    isValid: false,
    targetPriceRMB: 0, targetPriceRUB: 0,
    highestPriceRMB: 0, highestPriceRUB: 0,
    strikePriceRMB: 0, strikePriceRUB: 0,
  };
  if (!Number.isFinite(price) || !Number.isFinite(rate) || price <= 0 || rate <= 0) return invalid;
  const { highestMultiplier, strikeMultiplier } = normalizePricingSettings(settings);
  const highestPriceRMB = ceilRmb(price * highestMultiplier);
  const strikePriceRMB = ceilRmb(highestPriceRMB * strikeMultiplier);
  const targetPriceRUB = Math.round(cnyToRub(price, rate));
  const highestPriceRUB = Math.round(cnyToRub(highestPriceRMB, rate));
  const strikePriceRUB = Math.round(cnyToRub(strikePriceRMB, rate));
  if (![highestPriceRMB, strikePriceRMB, targetPriceRUB, highestPriceRUB, strikePriceRUB].every(Number.isSafeInteger)) return invalid;
  return {
    isValid: true,
    targetPriceRMB: Math.round(price * 100) / 100, targetPriceRUB,
    highestPriceRMB, highestPriceRUB,
    strikePriceRMB, strikePriceRUB,
  };
}
