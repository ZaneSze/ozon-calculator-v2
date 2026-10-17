const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const { loadTsModule } = require("./ts-module-loader");
const { parseOglRows, isOglSheet, mergeShippingImport, calculateOglServiceFee, getLogisticsMode } = loadTsModule("lib/ogl.ts");
const { selectShippingSheetNames, selectShippingSheets } = loadTsModule("lib/shipping-workbook.ts");
const { performFullCalculation, reversePriceFromMargin, calculateSixTierPricing, calculateMultiItemProfit, calculateProfitCurve, calculateExchangeRateStressTest } = loadTsModule("lib/calculator.ts");
const { parseBillingWeight, calculateShippingCost } = loadTsModule("lib/data-hub-context.tsx");
const { DEFAULT_SHIPPING_DATA } = loadTsModule("lib/default-data.ts");
const { DEFAULT_OGL_DATA } = loadTsModule("lib/ogl-default-data.ts");
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `预期${expected}，实际${actual}`);
const workbook = XLSX.readFile("public/data/OGL_2026-08-24.xlsx");
const rows = name => XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", raw: false });
const cn = parseOglRows(rows("中国 OGL"), "中国 OGL");
const en = parseOglRows(rows("CHINA OGL"), "CHINA OGL");
assert.equal(cn.length, 12);
assert.equal(en.length, 12);
assert.equal(JSON.stringify(cn.map(({ sourceSheet, ...channel }) => channel)), JSON.stringify(en.map(({ sourceSheet, ...channel }) => channel)));
assert.equal(JSON.stringify(cn), JSON.stringify(DEFAULT_OGL_DATA));
assert.equal(isOglSheet(rows("中国 OGL")), true);
assert.equal(selectShippingSheetNames(["CHINA OGL", "中国 OGL"]).join(), "中国 OGL");
assert.equal(selectShippingSheetNames(["说明", "China RFBS", "中国 OGL", "CHINA OGL"]).join(), "中国 OGL,China RFBS");
assert.equal(selectShippingSheetNames(["Routing", "中国 RFBS", "China RFBS"]).join(), "中国 RFBS");
assert.equal(selectShippingSheets([{ name: "说明", rows: [["费率说明"]] }, { name: "新版运费", rows: rows("中国 OGL") }])[0].name, "新版运费");

// 列重排、说明行、合并单元格、官方CSV和旧Excel格式都经过相同的行解析。
const shuffled = rows("中国 OGL").map(row => [...row].reverse());
assert.equal(parseOglRows(shuffled).length, 12);
const mergedRows = rows("中国 OGL");
mergedRows[4][0] = "";
assert.equal(parseOglRows(mergedRows)[1].serviceLevel, "上门取件");
for (const bookType of ["xlsx", "xls", "csv"]) {
  const single = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(single, workbook.Sheets["中国 OGL"], "中国 OGL");
  const restored = XLSX.read(XLSX.write(single, { type: "buffer", bookType }), { type: "buffer" });
  const parsed = parseOglRows(XLSX.utils.sheet_to_json(restored.Sheets[restored.SheetNames[0]], { header: 1, defval: "", raw: false }));
  assert.equal(parsed.length, 12);
  near(parsed[3].varFeePerGram, 0.0164);
}
const broken = rows("中国 OGL");
broken[3][4] = "待确认";
assert.throws(() => parseOglRows(broken), /数值/);
const wrongUnit = rows("中国 OGL");
wrongUnit[3][5] = "1kg";
assert.throws(() => parseOglRows(wrongUnit), /每1克/);
assert.throws(() => parseOglRows([["OGL"]]), /表头/);

const small = cn[0];
const big = cn[3];
near(calculateShippingCost(small, 80), 4.876);
near(parseBillingWeight(big, 100, 60, 6, 2200).billingWeight, 3000);
near(calculateShippingCost(big, 2200, 100, 60, 6, 2200), 84.02);
near(parseBillingWeight(small, 100, 60, 6, 80).billingWeight, 80);
assert.equal(big.volumetricDivisor, 12000);
near(calculateOglServiceFee(small, 10, 12), 15 / 12);
near(calculateOglServiceFee(small, 100, 12), 2);
near(calculateOglServiceFee(small, 1000, 12), 200 / 12);
near(calculateOglServiceFee(DEFAULT_SHIPPING_DATA[0], 100, 12), 0);

// 分类型覆盖、重复导入和同ID跨类型都不能删除另一类物流。
const all = [...DEFAULT_SHIPPING_DATA, ...cn];
const updated = mergeShippingImport(all, cn.map(ch => ({ ...ch, fixFee: ch.fixFee + 1 })), "overwrite");
assert.equal(updated.filter(ch => getLogisticsMode(ch) === "thirdParty").length, DEFAULT_SHIPPING_DATA.length);
assert.equal(updated.filter(ch => getLogisticsMode(ch) === "OGL").length, 12);
assert.equal(mergeShippingImport(updated, cn, "overwrite").length, all.length);
assert.equal(mergeShippingImport(all, [DEFAULT_SHIPPING_DATA[0]], "overwrite").filter(ch => getLogisticsMode(ch) === "OGL").length, 12);
assert.equal(mergeShippingImport(all, cn, "merge").length, all.length);
assert.throws(() => mergeShippingImport(all, [], "overwrite"), /未识别/);

const commission = { primaryCategory: "测试", secondaryCategory: "测试", tiers: [{ min: 0, max: 1500, rate: 12 }, { min: 1500.01, max: 5000, rate: 15 }, { min: 5000.01, max: Infinity, rate: 18 }] };
const input = { primaryCategory: "测试", secondaryCategory: "测试", length: 10, width: 8, height: 5, weight: 80, purchaseCost: 10, domesticShipping: 2, packagingFee: 1, returnRate: 5, returnHandling: "destroy", targetPriceRMB: 60, exchangeRate: 12, withdrawalFee: 1.5, paymentFee: 1, cpaEnabled: true, cpaRate: 5, cpcEnabled: true, cpcBillingMode: "salesPercent", cpcSalesPercent: 3, fulfillmentMode: "RFBS", taxEnabled: false };
for (const price of [10, 60, 100, 125, 125.01, 500, 1000]) {
  const trial = { ...input, targetPriceRMB: price };
  const result = performFullCalculation(trial, commission, small);
  const baseline = performFullCalculation(trial, commission, { ...small, logisticsMode: "thirdParty" });
  near(baseline.netProfit - result.netProfit, calculateOglServiceFee(small, price, 12));
  const sum = Object.entries(result.costs).filter(([key]) => key !== "total").reduce((total, [, cost]) => total + cost, 0);
  near(sum, result.costs.total);
  near(price - result.costs.total, result.netProfit);
  const fixed = result.costs.purchase + result.costs.domesticShipping + result.costs.packaging + result.costs.internationalShipping + result.costs.returnCost;
  near(calculateProfitCurve([price], 12, commission, 1.5, 5, fixed, 1, 3, 0, "RFBS", small)[0].profit, result.netProfit);
  const stress = calculateExchangeRateStressTest(price, 12, commission, 1.5, 5, fixed, 1, 3, 0, "RFBS", small);
  const stressed = performFullCalculation({ ...trial, exchangeRate: 12 * 1.05, targetPriceRMB: price / 1.05 }, commission, small);
  near(stress.at5PercentDrop, stressed.netProfit);
  near(calculateMultiItemProfit(1, trial, small, commission).totalProfit, result.netProfit);
  const two = calculateMultiItemProfit(2, trial, small, commission);
  const twoBaseline = calculateMultiItemProfit(2, trial, { ...small, logisticsMode: "thirdParty" }, commission);
  near(twoBaseline.totalProfit - two.totalProfit, calculateOglServiceFee(small, price * 2, 12));
}
for (const purchaseCost of [1, 40, 100, 700, 2000]) {
  const trial = { ...input, purchaseCost };
  for (const margin of [0, 10, 20, 30, 45]) {
    const reversed = reversePriceFromMargin(margin, trial, commission, small);
    assert.equal(reversed.error, undefined);
    const recalculated = performFullCalculation({ ...trial, targetPriceRMB: reversed.priceRMB }, commission, small);
    assert.ok(recalculated.profitMargin + 0.00001 >= margin, `反推售价未达到目标利润率${margin}`);
  }
  for (const tier of calculateSixTierPricing(trial, commission, small)) {
    if (!tier.disabled) assert.ok(performFullCalculation({ ...trial, targetPriceRMB: tier.priceRMB }, commission, small).profitMargin + 0.00001 >= tier.profitMargin);
  }
}
// 价格跨过135/635人民币时，必须换用相应评分组的费率。
for (const purchaseCost of [30, 100, 300, 700]) {
  const trial = { ...input, purchaseCost, valueLimitCurrency: "RMB" };
  for (const tier of calculateSixTierPricing(trial, commission, small, cn)) {
    assert.equal(tier.disabled, false, `成本${purchaseCost}的${tier.label}应有可用报价`);
    const matching = cn.find(channel => channel.serviceLevel === small.serviceLevel && trial.weight >= channel.minWeight && trial.weight <= channel.maxWeight && tier.priceRMB >= channel.minValue && tier.priceRMB <= channel.maxValue);
    assert.ok(matching, "跨组报价必须落入可用评分组");
    assert.ok(performFullCalculation({ ...trial, targetPriceRMB: tier.priceRMB }, commission, matching).profitMargin + 0.00001 >= tier.profitMargin);
  }
}
console.log("OGL验证通过：官方中英文表、CSV/XLS/XLSX、体积重、费用边界、并存更新、利润与反推售价。");
