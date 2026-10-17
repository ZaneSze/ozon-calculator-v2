import type { ShippingChannel, LogisticsMode } from "./types";
import { parseEuropeanNumber } from "./number-parsing";
import { parseDeliveryTime, parseValueRange } from "./logistics-parsing";

export const OGL_SOURCE_URL = "https://global-help.ozonru.cn/zh/commissions/ozon-fees/ogl-rates";
export const OGL_RATE_DATE = "2026-08-24";

export function getLogisticsMode(channel: ShippingChannel): LogisticsMode {
  return channel.logisticsMode || (/\bOGL\b/i.test(`${channel.thirdParty} ${channel.name}`) ? "OGL" : "thirdParty");
}

// 电子服务费与运输费分开核算；上下限以卢布计价，随结算汇率换算。
export function calculateOglServiceFee(channel: ShippingChannel | undefined | null, priceRMB: number, rubPerCny: number): number {
  if (!channel || getLogisticsMode(channel) !== "OGL") return 0;
  if (!Number.isFinite(rubPerCny) || rubPerCny <= 0) throw new Error("OGL费用计算需要有效的卢布/人民币汇率");
  const valueRUB = Math.max(0, Number.isFinite(priceRMB) ? priceRMB : 0) * rubPerCny;
  return Math.min(200, Math.max(15, valueRUB * 0.02)) / rubPerCny;
}

const normalize = (value: unknown) => String(value ?? "").replace(/[\s（），(),]/g, "").toLowerCase();
const aliases: Record<string, string[]> = {
  handling: ["发运方法", "handlingtype", "交接方式"],
  tier: ["评分组", "scoringgroup"],
  time: ["时限", "time-limits", "时效"],
  fix: ["一票", "fix", "固定费"],
  variable: ["1克", "var", "每克费用"],
  unit: ["计费单位", "unitoftariffication"],
  battery: ["电池", "batteries"],
  liquid: ["液体", "liquids"],
  dimensions: ["尺寸", "measurements"],
  minWeight: ["货件重量限制/最小", "shipmentweightlimits/ming"],
  maxWeight: ["货件重量限制/最大", "shipmentweightlimits/maxg"],
  valueRUB: ["货件价值限制/最小值-最大值rub", "shipmentcostlimit/min-maxrub"],
  valueCNY: ["货件价值限制/最小值-最大值cny", "shipmentcostlimit/min-maxcny", "货值限制/最低-最高人民币"],
  billing: ["计费类型", "tarificationtype"],
  volume: ["体积重量计算方式", "volumeweightcalculation"],
};
const fieldLabels: Record<string, string> = {
  handling: "发运方法", tier: "评分组", fix: "固定费", variable: "每克运费", unit: "计费单位",
  battery: "电池", liquid: "液体", dimensions: "尺寸限制", minWeight: "最小重量", maxWeight: "最大重量",
  billing: "计费类型", volume: "体积重公式",
};

function columns(row: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, names] of Object.entries(aliases)) {
    const index = row.findIndex(cell => names.some(name => normalize(cell).startsWith(normalize(name))));
    if (index >= 0) result[key] = index;
  }
  return result;
}

export function isOglSheet(rows: string[][], sheetName = ""): boolean {
  return /\bogl\b/i.test(sheetName) || rows.slice(0, 10).some(row => row.some(cell => /\bOGL\b/i.test(String(cell)))) ||
    rows.slice(0, 20).some(row => { const map = columns(row); return map.handling !== undefined && map.tier !== undefined && map.fix !== undefined && map.variable !== undefined; });
}

// 按表头语义映射，支持说明行、中英文列名、列重排和交接方式合并单元格。
export function parseOglRows(rows: string[][], sheetName = "OGL"): ShippingChannel[] {
  const headerIndex = rows.findIndex(row => { const map = columns(row); return map.tier !== undefined && map.fix !== undefined && map.variable !== undefined; });
  if (headerIndex < 0) throw new Error(`${sheetName}：未识别到OGL费率表头，请保留评分组、一票/Fix、1克/Var列`);
  const map = columns(rows[headerIndex]);
  const required = ["handling", "tier", "fix", "variable", "unit", "battery", "liquid", "dimensions", "minWeight", "maxWeight", "billing", "volume"];
  const missing = required.filter(key => map[key] === undefined);
  if (missing.length || (map.valueRUB === undefined && map.valueCNY === undefined)) throw new Error(`${sheetName}：OGL表格缺少必要列：${missing.map(key => fieldLabels[key]).join("、") || "货值区间"}，未更新现有费率`);
  if (["fix", "variable"].some(key => /\$|USD|EUR|RUB|₽|€/i.test(rows[headerIndex][map[key]]))) throw new Error(`${sheetName}：当前仅支持人民币运输费率，未更新现有数据`);
  const result: ShippingChannel[] = [];
  const seen = new Set<string>();
  let handling = "";
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    const cell = (key: string) => String(row[map[key]] ?? "").trim();
    const tier = cell("tier");
    if (!/^(extra\s*small|budget|small|big|premium\s*small|premium\s*big)$/i.test(tier)) {
      if (cell("fix") || cell("variable")) throw new Error(`${sheetName} 第${index + 1}行：无法识别评分组“${tier}”，未更新费率`);
      continue;
    }
    handling = cell("handling") || handling;
    if (!handling) throw new Error(`${sheetName} 第${index + 1}行：缺少发运方法`);
    const readNumber = (key: string) => {
      const raw = cell(key);
      if (!/\d/.test(raw) || /\$|USD|EUR|RUB|₽|€|%/i.test(raw)) throw new Error(`${sheetName} 第${index + 1}行：${fieldLabels[key]}数值或币种无法识别`);
      const value = parseEuropeanNumber(raw);
      if (!Number.isFinite(value) || value < 0) throw new Error(`${sheetName} 第${index + 1}行：${fieldLabels[key]}数值无效`);
      return value;
    };
    const unit = normalize(cell("unit"));
    if (!/^(1克|1g|1gramm?|1gram)$/i.test(unit)) throw new Error(`${sheetName} 第${index + 1}行：仅支持每1克计费，当前为${cell("unit")}`);
    const fixFee = readNumber("fix");
    const varFeePerGram = readNumber("variable");
    const minWeight = readNumber("minWeight");
    const maxWeight = readNumber("maxWeight");
    if (maxWeight < minWeight || maxWeight <= 0 || fixFee + varFeePerGram <= 0) throw new Error(`${sheetName} 第${index + 1}行：重量区间或费率无效`);
    const rub = parseValueRange(cell("valueRUB"));
    const cny = parseValueRange(cell("valueCNY"));
    if (!rub.hasLimit && !cny.hasLimit) throw new Error(`${sheetName} 第${index + 1}行：无法识别货值区间`);
    const isBig = /^(premium\s*)?big$/i.test(tier);
    const billing = cell("billing");
    if (isBig ? !/较大|取大|最大|max/i.test(billing) : !/实际|physical|actual/i.test(billing)) throw new Error(`${sheetName} 第${index + 1}行：计费类型无法识别`);
    const volume = cell("volume").replace(/\s/g, "");
    const divisorMatch = volume.match(/[÷/]([\d.]+)/);
    // 官方÷12的结果为克；内部统一使用“除数后乘1000”的千克公式。
    const rawDivisor = divisorMatch ? Number(divisorMatch[1]) : 0;
    const volumetricDivisor = isBig ? (rawDivisor < 1000 ? rawDivisor * 1000 : rawDivisor) : 0;
    if (isBig && !(volumetricDivisor >= 1000)) throw new Error(`${sheetName} 第${index + 1}行：缺少有效体积重公式`);
    const dimensions = cell("dimensions");
    const side = dimensions.match(/(?:长度|长边|length|longest)[^\d]*(\d+(?:\.\d+)?)/i);
    const sum = dimensions.match(/(?:总和|sum)[^\d]*(\d+(?:\.\d+)?)/i);
    if (!side && !sum) throw new Error(`${sheetName} 第${index + 1}行：无法识别尺寸限制`);
    const allowed = (key: string) => /^(允许|allowed|yes|разрешено)$/i.test(cell(key));
    for (const key of ["battery", "liquid"]) if (!/^(允许|禁止|不允许|allowed|not allowed|prohibited|yes|no|разрешено|запрещено)$/i.test(cell(key))) throw new Error(`${sheetName} 第${index + 1}行：${fieldLabels[key]}限制无法识别`);
    const pickup = /pick.?up|上门/i.test(handling);
    if (!pickup && !/self.?drop|自送/i.test(handling)) throw new Error(`${sheetName} 第${index + 1}行：无法识别发运方法“${handling}”`);
    const serviceLevel = pickup ? "上门取件" : "卖家自送";
    const id = `ogl_${pickup ? "pickup" : "selfdrop"}_${normalize(tier)}_${minWeight}_${maxWeight}_${rub.min}_${rub.max}_${cny.min}_${cny.max}`;
    if (seen.has(id)) throw new Error(`${sheetName} 第${index + 1}行：存在重复评分组区间`);
    seen.add(id);
    const time = parseDeliveryTime(cell("time"));
    result.push({
      id, logisticsMode: "OGL", sourceSheet: sheetName,
      name: `OGL ${serviceLevel} ${tier}`, thirdParty: "OGL", serviceTier: tier, serviceLevel,
      fixFee, varFeePerGram, pricePerKg: fixFee + varFeePerGram * 1000, pricePerCubic: 0,
      minWeight, maxWeight, maxLength: side ? Number(side[1]) : 999999,
      maxWidth: 999999, maxHeight: 999999, maxSumDimension: sum ? Number(sum[1]) : 999999,
      minValueRUB: rub.hasLimit ? rub.min : undefined, maxValueRUB: rub.hasLimit ? rub.max : undefined,
      minValue: cny.hasLimit ? cny.min : undefined, maxValue: cny.hasLimit ? cny.max : undefined,
      deliveryTimeMin: time.min, deliveryTimeMax: time.max, deliveryTime: (time.min + time.max) / 2,
      billingType: isBig ? "实际重量与体积重量取大" : "实际重量", volumetricDivisor,
      batteryAllowed: allowed("battery"), liquidAllowed: allowed("liquid"), ozonRating: 0,
    });
  }
  if (!result.length) throw new Error(`${sheetName}：未找到有效OGL渠道，未更新现有费率`);
  return result;
}

// 覆盖仅影响本次导入涉及的物流类型，另一类渠道和历史数据继续保留。
export function mergeShippingImport(existing: ShippingChannel[], imported: ShippingChannel[], mode: "overwrite" | "merge"): ShippingChannel[] {
  if (!imported.length) throw new Error("未识别到有效物流渠道，原有数据未修改");
  const modes = new Set(imported.map(getLogisticsMode));
  const retained = mode === "overwrite" ? existing.filter(channel => !modes.has(getLogisticsMode(channel))) : existing;
  const map = new Map(retained.map(channel => [`${getLogisticsMode(channel)}:${channel.id}`, channel]));
  imported.forEach(channel => map.set(`${getLogisticsMode(channel)}:${channel.id}`, channel));
  return Array.from(map.values());
}
