import { isOglSheet } from "./ogl";

const SKIP_ROW_TOKENS = new Set(["переход", "transition", "跳转", "h"]);

function normalizeSheetName(name: string): string {
  return String(name || "").trim().toLowerCase();
}

function isRoutingSheet(name: string): boolean {
  const normalized = normalizeSheetName(name);
  return normalized.includes("routing") || normalized.includes("路由") || normalized.includes("sla");
}

function isMainChineseRfbsSheet(name: string): boolean {
  const normalized = normalizeSheetName(name);
  return normalized.includes("中国") && normalized.includes("rfbs") && !isRoutingSheet(name);
}

function isMainEnglishRfbsSheet(name: string): boolean {
  const normalized = normalizeSheetName(name);
  return normalized.includes("china") && normalized.includes("rfbs") && !isRoutingSheet(name);
}

export function selectShippingSheetName(sheetNames: string[]): string | undefined {
  return (
    sheetNames.find((name) => /中国.*OGL/i.test(name)) ||
    sheetNames.find((name) => /\bOGL\b/i.test(name)) ||
    sheetNames.find((name) => normalizeSheetName(name) === "中国 rfbs") ||
    sheetNames.find((name) => normalizeSheetName(name) === "china rfbs") ||
    sheetNames.find(isMainChineseRfbsSheet) ||
    sheetNames.find(isMainEnglishRfbsSheet) ||
    sheetNames.find((name) => normalizeSheetName(name).includes("список") || normalizeSheetName(name).includes("3pl")) ||
    sheetNames[0]
  );
}

export function selectShippingSheetNames(sheetNames: string[]): string[] {
  const ogl = sheetNames.find(name => /中国.*OGL/i.test(name)) || sheetNames.find(name => /\bOGL\b/i.test(name));
  const legacyNames = sheetNames.filter(name => !/\bOGL\b/i.test(name));
  const legacy = legacyNames.some(name => /rfbs|3pl|список/i.test(name)) ? selectShippingSheetName(legacyNames) : undefined;
  return ogl ? [ogl, ...(legacy ? [legacy] : [])] : [selectShippingSheetName(sheetNames)!].filter(Boolean);
}

export function selectShippingSheets(sheets: { name: string; rows: string[][] }[]): { name: string; rows: string[][] }[] {
  const candidates = sheets.filter(sheet => !isRoutingSheet(sheet.name));
  const oglSheets = candidates.filter(sheet => isOglSheet(sheet.rows, sheet.name));
  const ogl = oglSheets.find(sheet => sheet.rows.slice(0, 20).some(row => row.some(cell => String(cell).includes("发运方法")))) || oglSheets[0];
  const legacySheets = candidates.filter(sheet => !oglSheets.includes(sheet) && (/rfbs|3pl|список/i.test(sheet.name) || sheet.rows.slice(0, 20).some(row => /配送方式|delivery method|deliveryvariant|метод/i.test(row.join(" ")))));
  const legacyName = selectShippingSheetName(legacySheets.map(sheet => sheet.name));
  const legacy = legacySheets.find(sheet => sheet.name === legacyName);
  if (ogl || legacy) return [...(ogl ? [ogl] : []), ...(legacy ? [legacy] : [])];
  return candidates.slice(0, 1);
}

export function isSkippableShippingRow(row: string[], name: string): boolean {
  const normalizedName = String(name || "").trim().toLowerCase();
  if (!normalizedName || normalizedName === "-") return true;
  if (SKIP_ROW_TOKENS.has(normalizedName)) return true;

  const nonEmptyCells = row
    .map((cell) => String(cell || "").trim().toLowerCase())
    .filter(Boolean);
  if (nonEmptyCells.length < 4) return true;

  const transitionLikeCount = nonEmptyCells.filter((cell) => SKIP_ROW_TOKENS.has(cell)).length;
  return transitionLikeCount >= Math.max(3, Math.floor(nonEmptyCells.length * 0.6));
}
