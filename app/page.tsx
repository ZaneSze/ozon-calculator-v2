"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/header";
import { InputPanel } from "@/components/input-panel";
import { Dashboard } from "@/components/dashboard";
import { useDataHub } from "@/lib/data-hub-context";
import { CalculationInput, ShippingChannel } from "@/lib/types";
import {
  performFullCalculation,
  calculateProfitCurve,
  calculateExchangeRateStressTest,
  calculateMultiItemProfit,
  getChargeableWeight,
  reversePriceFromMargin,
  calculateSixTierPricing,
} from "@/lib/calculator";
import { calculateShippingCost } from "@/lib/data-hub-context";

// 默认输入：售价为 RMB（1500 RUB × 0.082 = 123 RMB）
const DEFAULT_INPUT: CalculationInput = {
  primaryCategory: "电子产品",
  secondaryCategory: "电子产品配饰",
  length: 20,
  width: 15,
  height: 10,
  weight: 300,
  hasBattery: false, // 🔹 是否带电，默认否
  hasLiquid: false, // 🔹 是否带液体，默认否
  purchaseCost: 30,
  domesticShipping: 3,
  packagingFee: 2,
  returnRate: 5,
  returnHandling: "destroy",
  cpaEnabled: false,
  cpaRate: 5,
  cpcEnabled: false,
  cpcBid: 10,
  cpcConversionRate: 3,
  targetPriceRMB: 123, // RMB（≈1500 RUB）
  promotionDiscount: 0,
  exchangeRate: 0.082, // 1 RUB = 0.082 RMB
  withdrawalFee: 1.5,
  exchangeRateBuffer: 0, // 汇率安全缓冲：默认0%
  competitorPriceRMB: 0, // 竞品售价
  multiItemCount: 1, // 单单购买数量
  taxEnabled: false, // 税务核算默认关闭
  vatRate: 13, // 增值税率 13%
  corporateTaxRate: 25, // 企业所得税率 25%
};

// localStorage 键名
const STORAGE_KEY = "ozon-calculator-input";

export default function Home() {
  const { getCommissionByCategory, getShippingChannels, shippingData, clearCommissionData, clearShippingData } = useDataHub();
  const [input, setInput] = useState<CalculationInput>(DEFAULT_INPUT);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [marginError, setMarginError] = useState<string | null>(null);
  const [lockedChannelId, setLockedChannelId] = useState<string | null>(null); // 🔹 物流商锁定状态
  
  // 防抖保存的定时器
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 🔹 页面加载时从 localStorage 恢复数据
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData) as CalculationInput;
        setInput(parsedData);
      }
      
      // 🔹 恢复锁定的物流商
      const savedLockedChannel = localStorage.getItem("ozon-locked-channel");
      if (savedLockedChannel) {
        setLockedChannelId(savedLockedChannel);
        setSelectedChannelId(savedLockedChannel);
      }
    } catch (error) {
      console.error("Failed to load saved data:", error);
    }
  }, []);

  // 🔹 自动保存到 localStorage（带防抖，避免频繁写入）
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
      } catch (error) {
        console.error("Failed to save data:", error);
      }
    }, 500); // 500ms 防抖延迟

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [input]);

  // 全局汇率和提现费同步
  const handleExchangeRateChange = useCallback((rate: number) => {
    setInput((prev) => ({ ...prev, exchangeRate: rate }));
  }, []);

  const handleWithdrawalFeeChange = useCallback((fee: number) => {
    setInput((prev) => ({ ...prev, withdrawalFee: fee }));
  }, []);

  const handleExchangeRateBufferChange = useCallback((buffer: number) => {
    setInput((prev) => ({ ...prev, exchangeRateBuffer: buffer }));
  }, []);

  // 获取当前类目的佣金配置
  const commission = useMemo(
    () => getCommissionByCategory(input.primaryCategory, input.secondaryCategory),
    [getCommissionByCategory, input.primaryCategory, input.secondaryCategory]
  );

  // 🔹 计算实际汇率（扣除安全缓冲）
  const effectiveExchangeRate = useMemo(() => {
    return input.exchangeRate * (1 - input.exchangeRateBuffer / 100);
  }, [input.exchangeRate, input.exchangeRateBuffer]);

  // 获取可用物流渠道 — 需要将 RMB 转为 RUB 传入（使用实际汇率）
  const shippingChannels = useMemo(() => {
    const priceRUB = effectiveExchangeRate > 0 ? input.targetPriceRMB / effectiveExchangeRate : 0;
    return getShippingChannels(
      input.length,
      input.width,
      input.height,
      input.weight,
      priceRUB,
      effectiveExchangeRate,
      input.hasBattery, // 🔹 传入是否带电
      input.hasLiquid // 🔹 传入是否带液体
    );
  }, [getShippingChannels, input.length, input.width, input.height, input.weight, input.targetPriceRMB, effectiveExchangeRate, input.hasBattery, input.hasLiquid]);

  // 默认选中价格最优渠道（如果已锁定，则使用锁定的渠道）
  const selectedChannel = useMemo(() => {
    // 🔹 优先使用锁定的物流商
    if (lockedChannelId) {
      const lockedChannel = shippingChannels.available.find((c) => c.id === lockedChannelId);
      if (lockedChannel) return lockedChannel;
    }
    
    if (selectedChannelId) {
      const ch = shippingChannels.available.find((c) => c.id === selectedChannelId);
      if (ch) return ch;
    }
    return shippingChannels.available[0] || null;
  }, [selectedChannelId, shippingChannels.available, lockedChannelId]);

  // 🔹 创建计算用的 input（使用实际汇率）
  const effectiveInput = useMemo(() => {
    return {
      ...input,
      exchangeRate: effectiveExchangeRate,
    };
  }, [input, effectiveExchangeRate]);

  // 执行完整计算（使用实际汇率）
  const result = useMemo(
    () => performFullCalculation(effectiveInput, commission, selectedChannel),
    [effectiveInput, commission, selectedChannel]
  );
  
  // 🔹 监控佣金阶梯变化
  useEffect(() => {
    const priceRUB = effectiveInput.targetPriceRMB / effectiveInput.exchangeRate;
    console.log(`\n💰 售价变动: ${effectiveInput.targetPriceRMB} RMB = ${priceRUB.toFixed(2)} RUB`);
    console.log(`当前佣金率: ${result.commissionRate}%`);
    if (commission) {
      const matchedTier = commission.tiers.find(tier => priceRUB >= tier.min && priceRUB <= tier.max);
      if (matchedTier) {
        console.log(`所属阶梯: ${matchedTier.min}-${matchedTier.max === Infinity ? '∞' : matchedTier.max} RUB (${matchedTier.rate}%)`);
      }
    }
  }, [effectiveInput.targetPriceRMB, effectiveInput.exchangeRate, result.commissionRate, commission]);
  
  // 🔹 调试：输出当前使用的佣金数据
  useEffect(() => {
    if (commission) {
      console.log(`\n=== 当前使用佣金数据 ===`);
      console.log(`类目: ${commission.primaryCategory} > ${commission.secondaryCategory}`);
      console.log(`阶梯费率:`);
      commission.tiers.forEach((tier, i) => {
        console.log(`  阶梯${i+1}: ${tier.min}-${tier.max === Infinity ? '∞' : tier.max} RUB → ${tier.rate}%`);
      });
    }
  }, [commission]);

  // 计算六档定价推荐矩阵（使用实际汇率）
  const sixTierPricing = useMemo(() => {
    if (!commission) return [];
    return calculateSixTierPricing(effectiveInput, commission, selectedChannel || undefined);
  }, [effectiveInput, commission, selectedChannel]);

  // 计算总固定成本
  const computeTotalFixedCost = useCallback(() => {
    const chargeableWeight = getChargeableWeight(effectiveInput.length, effectiveInput.width, effectiveInput.height, effectiveInput.weight).chargeable;
    const internationalShipping = selectedChannel ? calculateShippingCost(selectedChannel, chargeableWeight) : 0;
    const rate = effectiveInput.returnRate / 100;
    const returnCost = (() => {
      switch (effectiveInput.returnHandling) {
        case "destroy": return (effectiveInput.purchaseCost + effectiveInput.domesticShipping + internationalShipping) * rate;
        case "resell": return internationalShipping * rate;
        case "productOnly": return effectiveInput.purchaseCost * rate;
        default: return 0;
      }
    })();
    const cpcCost = effectiveInput.cpcEnabled && effectiveInput.cpcConversionRate > 0 ? (effectiveInput.cpcBid / (effectiveInput.cpcConversionRate / 100)) * effectiveInput.exchangeRate : 0;
    return {
      totalFixedCost: effectiveInput.purchaseCost + effectiveInput.domesticShipping + effectiveInput.packagingFee + internationalShipping + cpcCost + returnCost,
      cpaRateForM: effectiveInput.cpaEnabled ? effectiveInput.cpaRate : 0,
    };
  }, [effectiveInput, selectedChannel]);

  // 利润曲线数据 — X轴为 RMB 售价
  const profitCurve = useMemo(() => {
    if (!commission) return [];
    const minPrice = Math.max(1, Math.floor(effectiveInput.targetPriceRMB * 0.3));
    const maxPrice = Math.ceil(effectiveInput.targetPriceRMB * 2.5);
    const step = Math.max(0.5, (maxPrice - minPrice) / 80);
    const priceRangeRMB: number[] = [];
    for (let p = minPrice; p <= maxPrice; p += step) {
      priceRangeRMB.push(parseFloat(p.toFixed(2)));
    }
    const { totalFixedCost, cpaRateForM } = computeTotalFixedCost();
    return calculateProfitCurve(priceRangeRMB, effectiveInput.exchangeRate, commission, effectiveInput.withdrawalFee, cpaRateForM, totalFixedCost);
  }, [commission, effectiveInput, computeTotalFixedCost]);

  // 汇率抗压测试
  const stressTest = useMemo(() => {
    if (!commission) return { at5PercentDrop: 0, at10PercentDrop: 0, zeroProfitRate: 0 };
    const { totalFixedCost, cpaRateForM } = computeTotalFixedCost();
    return calculateExchangeRateStressTest(effectiveInput.targetPriceRMB, effectiveInput.exchangeRate, commission, effectiveInput.withdrawalFee, cpaRateForM, totalFixedCost);
  }, [commission, effectiveInput, computeTotalFixedCost]);

  // 多件装利润
  const multiItemProfit = useMemo(() => {
    if (!commission || !selectedChannel) return null;
    return calculateMultiItemProfit(effectiveInput.multiItemCount || 1, effectiveInput, selectedChannel, commission);
  }, [commission, effectiveInput, selectedChannel]);

  const handleSelectChannel = useCallback((channel: ShippingChannel) => {
    setSelectedChannelId(channel.id);
    // 🔹 点击即锁定：将选中的物流商设为锁定状态
    setLockedChannelId(channel.id);
    localStorage.setItem("ozon-locked-channel", channel.id);
  }, []);
  
  // 🔹 解锁/恢复自动匹配
  const handleUnlockChannel = useCallback(() => {
    setLockedChannelId(null);
    setSelectedChannelId(null);
    localStorage.removeItem("ozon-locked-channel");
  }, []);

  // 逆向推价：根据目标利润率反推售价
  const handleReversePriceFromMargin = useCallback((targetMargin: number) => {
    if (!commission) return;
    
    const result = reversePriceFromMargin(targetMargin, effectiveInput, commission, selectedChannel || undefined);
    
    if (result.error) {
      setMarginError(result.error);
    } else {
      setMarginError(null);
      setInput((prev) => ({ ...prev, targetPriceRMB: result.priceRMB }));
    }
  }, [effectiveInput, commission, selectedChannel]);

  // 清除售价时清除利润率错误
  const handleInputChange = useCallback((newInput: CalculationInput) => {
    setInput(newInput);
    if (marginError && newInput.targetPriceRMB !== input.targetPriceRMB) {
      setMarginError(null);
    }
  }, [marginError, input.targetPriceRMB]);

  // 🔹 一键重置功能（彻底化：清除所有状态）
  // 🔹 全局重置函数：物理+逻辑+存储三重重置
  const handleReset = useCallback(() => {
    const confirmed = window.confirm(
      "⚠️ 确定要重置所有数据吗？\n\n" +
      "此操作将：\n" +
      "• 清空所有输入参数（尺寸、重量、成本等）\n" +
      "• 解除物流商锁定\n" +
      "• 清除所有缓存数据\n\n" +
      "此操作不可撤销！"
    );
    
    if (!confirmed) return;
    
    console.log("🧹 开始全局重置...");
    
    // ===== 1. 全局状态清空 =====
    console.log("  [1/4] 重置输入参数...");
    setInput(DEFAULT_INPUT);
    setSelectedChannelId(null);
    setMarginError(null);
    setLockedChannelId(null);
    
    // ===== 2. 持久化存储清理 =====
    console.log("  [2/4] 清除 localStorage...");
    
    // 清除输入数据
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("ozon-locked-channel");
    
    // 清除数据中心缓存
    localStorage.removeItem("ozon_commission_data");
    localStorage.removeItem("ozon_shipping_data");
    localStorage.removeItem("ozon_commission_mappings");
    localStorage.removeItem("ozon_shipping_mappings");
    localStorage.removeItem("ozon_column_mapping");
    
    // 清除汇率缓存
    localStorage.removeItem("ozon_exchange_rate");
    localStorage.removeItem("ozon_withdrawal_fee");
    
    // 清除数据版本标记
    localStorage.removeItem("ozon_data_version");
    
    // ===== 3. 逻辑干预撤销 =====
    console.log("  [3/4] 清除数据中心数据...");
    
    // 清除上传的佣金和物流数据
    if (clearCommissionData) clearCommissionData();
    if (clearShippingData) clearShippingData();
    
    // ===== 4. UI 刷新与防御 =====
    console.log("  [4/4] 强制页面刷新...");
    
    // 显示成功提示
    alert("✅ 重置成功！系统已恢复至初始状态。");
    
    // 强制刷新页面（确保所有组件重新挂载）
    window.location.reload();
    
  }, [clearCommissionData, clearShippingData]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        exchangeRate={input.exchangeRate}
        onExchangeRateChange={handleExchangeRateChange}
        withdrawalFee={input.withdrawalFee}
        onWithdrawalFeeChange={handleWithdrawalFeeChange}
        exchangeRateBuffer={input.exchangeRateBuffer}
        onExchangeRateBufferChange={handleExchangeRateBufferChange}
        input={input}
        onInputChange={handleInputChange}
      />
      <main className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* 左侧输入区 40% */}
          <div className="w-[40%] shrink-0">
            <InputPanel
              input={input}
              onInputChange={handleInputChange}
              currentProfitMargin={result.profitMargin}
              onReversePriceFromMargin={handleReversePriceFromMargin}
              marginError={marginError}
              onReset={handleReset}
              adRiskControl={result.adRiskControl}
              shippingData={shippingData} // 🔹 传入物流数据
            />
          </div>

          {/* 右侧看板区 60% */}
          <div className="w-[60%] sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin">
            <Dashboard
              result={result}
              input={input}
              shippingChannels={shippingChannels}
              allShippingChannels={shippingData}
              selectedChannel={selectedChannel}
              onSelectChannel={handleSelectChannel}
              lockedChannelId={lockedChannelId}
              onUnlockChannel={handleUnlockChannel}
              profitCurve={profitCurve}
              stressTest={stressTest}
              multiItemProfit={multiItemProfit}
              sixTierPricing={sixTierPricing}
              commission={commission}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
