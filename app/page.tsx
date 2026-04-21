"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { InputPanel } from "@/components/input-panel";
import { Dashboard } from "@/components/dashboard";
import { LogisticsCard } from "@/components/logistics-card";
import { useDataHub } from "@/lib/data-hub-context";
import { RotateCcw, Truck, Upload, FileText, Settings, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { calculateShippingCost, parseBillingWeight, getBillingModeDescription } from "@/lib/data-hub-context";
import { PreviewMappingDialog } from "@/components/preview-mapping-dialog";
import { FieldMapping, ParsedData, smartParseCSV } from "@/lib/smart-parser";

// 默认输入：售价为 RMB（1500 RUB ÷ 12 = 125 RMB）
const DEFAULT_INPUT: CalculationInput = {
  primaryCategory: "电子产品",
  secondaryCategory: "电子产品配饰",
  length: 20,
  width: 15,
  height: 10,
  weight: 300,
  hasBattery: false, // 🔹 是否带电，默认否
  hasLiquid: false, // 🔹 是否带液体，默认否
  designatedProvider: "", // 🔹 指定物流商，为空表示全部
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
  targetPriceRMB: 125, // RMB（≈1500 RUB）
  promotionDiscount: 0,
  exchangeRate: 12.0, // 1 CNY = 12 RUB
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
const CONFIG_EXPORT_KEY = "ozon-calculator-config";

// 🔹 工具函数：检查渠道是否支持体积重计费
function supportsVolumetricBilling(channel: ShippingChannel): boolean {
  const billingType = (channel.billingType || "").toLowerCase();
  return billingType.includes("体积") || billingType.includes("取大") || billingType.includes("max");
}

// 🔹 工具函数：下载模板 CSV
function downloadTemplate(type: "commission" | "shipping") {
  if (type === "shipping") {
    const template = `配送方式,第三方物流,服务等级,固定费(RMB),续重费(RMB/g),最小重量(g),最大重量(g),最大长度(cm),最大宽度(cm),最大高度(cm),边长总和(cm),时效(天),计费类型,体积重除数
中国邮政小包,邮政,Economy,2.00,0.063,0,2000,60,60,60,150,25-35,取大,12000
顺丰国际,顺丰,Express,5.00,0.080,0,3000,60,60,60,120,10-15,取大,8000`;
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ozon_shipping_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  } else {
    const template = `一级类目,二级类目,rfbs -> 0 - 1500 -> тариф, %,rfbs -> 1500.01 - 5000 -> тариф, %,rfbs -> 5000.01+ -> тариф, %
电子产品,手机配件,12,15,18
电子产品,充电器,12,15,18`;
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ozon_commission_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
}

// 🔹 工具函数：导出配置
function exportConfig() {
  const config = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    input: localStorage.getItem(STORAGE_KEY),
    columnMappings: {
      commission: localStorage.getItem("ozon_commission_mappings"),
      shipping: localStorage.getItem("ozon_shipping_mappings"),
    },
    exchangeRate: localStorage.getItem("ozon_exchange_rate"),
    withdrawalFee: localStorage.getItem("ozon_withdrawal_fee"),
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ozon_config_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// 🔹 工具函数：导入配置
function importConfig(onSuccess: () => void, onError: (err: string) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      if (!config.version) throw new Error("无效的配置文件");
      if (config.input) localStorage.setItem(STORAGE_KEY, config.input);
      if (config.columnMappings?.commission) localStorage.setItem("ozon_commission_mappings", config.columnMappings.commission);
      if (config.columnMappings?.shipping) localStorage.setItem("ozon_shipping_mappings", config.columnMappings.shipping);
      if (config.exchangeRate) localStorage.setItem("ozon_exchange_rate", config.exchangeRate);
      if (config.withdrawalFee) localStorage.setItem("ozon_withdrawal_fee", config.withdrawalFee);
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "导入失败");
    }
  };
  input.click();
}

export default function Home() {
  const { getCommissionByCategory, getShippingChannels, shippingData, clearCommissionData, clearShippingData, loadCommissionData, loadShippingData, updateInterceptionConfig } = useDataHub();
  const [input, setInput] = useState<CalculationInput>(DEFAULT_INPUT);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [marginError, setMarginError] = useState<string | null>(null);
  const [lockedChannelId, setLockedChannelId] = useState<string | null>(null); // 🔹 物流商锁定状态
  const [showAllAvailable, setShowAllAvailable] = useState(false); // 🔹 显示全部可用渠道
  const [showAllUnavailable, setShowAllUnavailable] = useState(false); // 🔹 显示全部不可用渠道
  const [sortMode, setSortMode] = useState<'cost' | 'time' | 'rating'>('cost'); // 🔹 推荐物流排序模式
  const [dataManagementOpen, setDataManagementOpen] = useState(false); // 🔹 数据管理抽屉状态
  const [commissionFileName, setCommissionFileName] = useState<string>("");
  const [shippingFileName, setShippingFileName] = useState<string>("");
  
  // 🔹 CSV 映射弹窗状态
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [mappingDataType, setMappingDataType] = useState<"commission" | "shipping">("shipping");
  const [pendingMappingFile, setPendingMappingFile] = useState<File | null>(null);
  const [parsedCsvData, setParsedCsvData] = useState<ParsedData | null>(null);
  
  // 防抖保存的定时器
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🔹 自动获取汇率
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [rateFetchError, setRateFetchError] = useState<string | null>(null);
  // 🔹 利润率锁定状态：null=未锁定, 数字=锁定的利润率值(%)
  const [lockedMargin, setLockedMargin] = useState<number | null>(null);
  
  const fetchExchangeRate = useCallback(async () => {
    setIsFetchingRate(true);
    setRateFetchError(null);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/RUB');
      if (!response.ok) throw new Error('汇率API请求失败');
      const data = await response.json();
      if (data.rates && data.rates.CNY) {
        // API返回: 1 RUB = X CNY, 需要转为: 1 CNY = X RUB
        const rateRUBperCNY = 1 / parseFloat(data.rates.CNY.toFixed(6));
        setInput(prev => ({ ...prev, exchangeRate: parseFloat(rateRUBperCNY.toFixed(4)) }));
      }
    } catch (error) {
      console.error('获取汇率失败:', error);
      setRateFetchError('无法获取实时汇率，请手动输入');
    } finally {
      setIsFetchingRate(false);
    }
  }, []);

  // 组件加载时自动获取汇率
  useEffect(() => {
    fetchExchangeRate();
  }, []);

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

      // 🔹 恢复利润率锁定状态
      const savedLockedMargin = localStorage.getItem("ozon-locked-margin");
      if (savedLockedMargin !== null) {
        setLockedMargin(parseFloat(savedLockedMargin));
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
    // 用户输入表示: 1 CNY = X RUB
    // 转换为程序内部表示: 1 RUB = (1/X) RMB
    const rateCNYperRUB = input.exchangeRate;
    return rateCNYperRUB > 0 ? 1 / rateCNYperRUB : 0.082;
  }, [input.exchangeRate]);

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
      input.hasLiquid, // 🔹 传入是否带液体
      input.designatedProvider // 🔹 传入指定物流商
    );
  }, [getShippingChannels, input.length, input.width, input.height, input.weight, input.targetPriceRMB, effectiveExchangeRate, input.hasBattery, input.hasLiquid, input.designatedProvider]);

  // 🔹 推荐物流排序：按费用/时效/评分排序（定义在 channelCosts 之后，见下方）

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
  
  // 🔹 利润率锁定时：成本变化自动反推售价
  // 注意：监听输入参数而非结果，防止无限循环
  const lockedMarginRef = useRef(lockedMargin);
  useEffect(() => {
    if (lockedMargin === null || !commission) return;
    
    // 防止在同一渲染周期内重复触发
    if (lockedMarginRef.current === lockedMargin) {
      const reverseResult = reversePriceFromMargin(lockedMargin, effectiveInput, commission, selectedChannel || undefined);
      
      if (reverseResult.error) {
        setMarginError(reverseResult.error);
      } else if (reverseResult.priceRMB > 0) {
        setMarginError(null);
        setInput((prev) => ({ ...prev, targetPriceRMB: reverseResult.priceRMB }));
      }
    }
    lockedMarginRef.current = lockedMargin;
  }, [
    // 🔹 监听影响成本的输入参数变化
    // 使用 input 对象而非 result，避免循环依赖
    effectiveInput.purchaseCost,
    effectiveInput.domesticShipping,
    effectiveInput.packagingFee,
    effectiveInput.weight,
    effectiveInput.length,
    effectiveInput.width,
    effectiveInput.height,
    effectiveInput.cpcEnabled,
    effectiveInput.cpcBid,
    effectiveInput.cpcConversionRate,
    effectiveInput.exchangeRate,
    effectiveInput.withdrawalFee,
    lockedMargin,
    commission,
    selectedChannel,
  ]);
  
  // 🔹 监控佣金阶梯变化
  useEffect(() => {
    // 佣金阶梯变化监控已移除调试日志
  }, [effectiveInput.targetPriceRMB, effectiveInput.exchangeRate, result.commissionRate, commission]);
  
  // 🔹 调试：输出当前使用的佣金数据
  useEffect(() => {
    // 佣金数据调试日志已移除
  }, [commission]);

  // 计算六档定价推荐矩阵（使用实际汇率）
  const sixTierPricing = useMemo(() => {
    if (!commission) return [];
    return calculateSixTierPricing(effectiveInput, commission, selectedChannel || undefined);
  }, [effectiveInput, commission, selectedChannel]);

  // 🔹 优化：共享的总固定成本计算 - 避免重复计算
  const totalFixedCostData = useMemo(() => {
    const chargeableWeight = getChargeableWeight(effectiveInput.length, effectiveInput.width, effectiveInput.height, effectiveInput.weight, selectedChannel || undefined).chargeable;
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

  // 保留向后兼容的回调（供外部组件使用）
  const computeTotalFixedCost = useCallback(() => totalFixedCostData, [totalFixedCostData]);

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
    const { totalFixedCost, cpaRateForM } = totalFixedCostData;
    return calculateProfitCurve(priceRangeRMB, effectiveInput.exchangeRate, commission, effectiveInput.withdrawalFee, cpaRateForM, totalFixedCost);
  }, [commission, effectiveInput, totalFixedCostData]);

  // 汇率抗压测试
  const stressTest = useMemo(() => {
    if (!commission) return { at5PercentDrop: 0, at10PercentDrop: 0, zeroProfitRate: 0 };
    const { totalFixedCost, cpaRateForM } = totalFixedCostData;
    return calculateExchangeRateStressTest(effectiveInput.targetPriceRMB, effectiveInput.exchangeRate, commission, effectiveInput.withdrawalFee, cpaRateForM, totalFixedCost);
  }, [commission, effectiveInput, totalFixedCostData]);

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

  // 🔹 利润率锁定切换：锁定当前利润率，或解锁
  const handleToggleMarginLock = useCallback(() => {
    setLockedMargin((prev) => {
      if (prev !== null) {
        // 解锁
        localStorage.removeItem("ozon-locked-margin");
        return null;
      }
      // 锁定当前利润率
      const currentMargin = result.profitMargin;
      localStorage.setItem("ozon-locked-margin", String(currentMargin));
      return currentMargin;
    });
  }, [result.profitMargin]);

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
    
    // ===== 1. 全局状态清空 =====
    setInput(DEFAULT_INPUT);
    setSelectedChannelId(null);
    setMarginError(null);
    setLockedChannelId(null);
    setLockedMargin(null);
    
    // ===== 2. 持久化存储清理 =====
    
    // 清除输入数据
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("ozon-locked-channel");
    localStorage.removeItem("ozon-locked-margin");
    
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
    
    // 清除上传的佣金和物流数据
    if (clearCommissionData) clearCommissionData();
    if (clearShippingData) clearShippingData();
    
    // ===== 4. UI 刷新与防御 =====
    
    // 显示成功提示
    alert("✅ 重置成功！系统已恢复至初始状态。");
    
    // 强制刷新页面（确保所有组件重新挂载）
    window.location.reload();
    
  }, [clearCommissionData, clearShippingData]);

  // 🔹 佣金表上传处理
  const handleCommissionFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCommissionFileName(file.name);
    
    try {
      // 读取文件并解析
      const content = await file.text();
      const parsed = smartParseCSV(content, "commission");
      setParsedCsvData(parsed);
      setMappingDataType("commission");
      setPendingMappingFile(file);
      setMappingDialogOpen(true);
    } catch (err) {
      // 回退到直接加载
      try {
        await loadCommissionData(file, "overwrite");
      } catch (loadErr) {
        console.error("上传佣金表失败:", loadErr);
      }
    }
  }, [loadCommissionData]);

  // 🔹 物流表上传处理
  const handleShippingFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setShippingFileName(file.name);
    
    try {
      // 读取文件并解析
      const content = await file.text();
      const parsed = smartParseCSV(content, "shipping");
      setParsedCsvData(parsed);
      setMappingDataType("shipping");
      setPendingMappingFile(file);
      setMappingDialogOpen(true);
    } catch (err) {
      // 回退到直接加载
      try {
        await loadShippingData(file, "overwrite");
      } catch (loadErr) {
        console.error("上传物流表失败:", loadErr);
      }
    }
  }, [loadShippingData]);
  
  // 🔹 映射确认处理
  const handleMappingConfirm = useCallback(async (mappings: FieldMapping[]) => {
    setMappingDialogOpen(false);
    
    if (pendingMappingFile) {
      try {
        if (mappingDataType === "commission") {
          await loadCommissionData(pendingMappingFile, "overwrite");
        } else {
          await loadShippingData(pendingMappingFile, "overwrite");
          
          // 🔹 物流表：提取拦截配置并保存
          const config: Record<string, boolean> = {};
          mappings.forEach(m => {
            if (m.interceptionEnabled !== undefined) {
              config[m.systemField] = m.interceptionEnabled;
            }
          });
          updateInterceptionConfig(config);
        }
      } catch (err) {
        console.error("上传数据失败:", err);
      }
    }
    
    setPendingMappingFile(null);
    setParsedCsvData(null);
  }, [pendingMappingFile, mappingDataType, loadCommissionData, loadShippingData, updateInterceptionConfig]);
  
  // 🔹 映射取消处理
  const handleMappingCancel = useCallback(() => {
    setMappingDialogOpen(false);
    setPendingMappingFile(null);
    setParsedCsvData(null);
  }, []);

  // 计算卢布售价
  const priceRUB = input.exchangeRate > 0 ? input.targetPriceRMB / input.exchangeRate : 0;

  // 🔹 预计算所有渠道运费（使用体积重计算）
  const channelCosts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ch of [...shippingChannels.available, ...shippingChannels.unavailable]) {
      // 传入尺寸和实际重量，让 calculateShippingCost 自动计算体积重
      map.set(ch.id, calculateShippingCost(ch, input.weight, input.length, input.width, input.height, input.weight));
    }
    return map;
  }, [shippingChannels.available, shippingChannels.unavailable, input.weight, input.length, input.width, input.height]);

  // 🔹 预计算所有渠道的计费模式信息
  const channelBillingInfo = useMemo(() => {
    const map = new Map<string, { 
      mode: string; 
      billingWeight: number; 
      actualWeight: number; 
      volumetricWeight: number; 
      isVolumetric: boolean; 
      divisor: number;
    }>();
    for (const ch of [...shippingChannels.available, ...shippingChannels.unavailable]) {
      const info = parseBillingWeight(ch, input.length, input.width, input.height, input.weight);
      map.set(ch.id, {
        mode: getBillingModeDescription(ch),
        billingWeight: info.billingWeight,
        actualWeight: info.actualWeight,
        volumetricWeight: info.volumetricWeight,
        isVolumetric: info.isVolumetric,
        divisor: info.divisor,
      });
    }
    return map;
  }, [shippingChannels.available, shippingChannels.unavailable, input.weight, input.length, input.width, input.height]);
  
  // 🔹 当前选中渠道的计费信息（用于输入面板计抛预警同步）
  const selectedBillingInfo = useMemo(() => {
    if (!selectedChannel) return null;
    return channelBillingInfo.get(selectedChannel.id) || null;
  }, [selectedChannel, channelBillingInfo]);

  // 🔹 推荐物流排序：按费用/时效/评分排序
  const sortedAvailableChannels = useMemo(() => {
    const channels = [...shippingChannels.available];
    switch (sortMode) {
      case 'cost':
        // 按运费从低到高排序
        channels.sort((a, b) => {
          const costA = channelCosts.get(a.id) ?? Infinity;
          const costB = channelCosts.get(b.id) ?? Infinity;
          return costA - costB;
        });
        break;
      case 'time':
        // 按时效从快到慢排序（deliveryTime 越小越快）
        channels.sort((a, b) => a.deliveryTime - b.deliveryTime);
        break;
      case 'rating':
        // 按评分从高到低排序
        channels.sort((a, b) => (b.ozonRating || 0) - (a.ozonRating || 0));
        break;
    }
    return channels;
  }, [shippingChannels.available, sortMode, channelCosts]);

  // 🔹 不可用渠道排序：统一按名称排序
  const sortedUnavailableChannels = useMemo(() => {
    return [...shippingChannels.unavailable].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [shippingChannels.unavailable]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 🔹 顶部控制台 - 极致扁平化 */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm h-12">
        {/* 外部容器 */}
        <div className="w-full px-4 relative flex items-center justify-between h-full">
          {/* 左侧：品牌标题 */}
          <div className="flex-shrink-0">
            <span className="text-xs font-bold text-slate-600">🎯 精算</span>
          </div>
          
          {/* 中间：5个核心指标 - 绝对居中 - 醒目强化 */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 whitespace-nowrap">
            {/* 净利 - 核心盈亏指标 */}
            <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-white shadow-sm border">
              <span className={`text-lg font-bold tabular-nums ${result.netProfit >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                ¥{result.netProfit.toFixed(1)}
              </span>
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">净利</span>
            </div>
            {/* ROI */}
            <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-white shadow-sm border">
              <span className={`text-lg font-bold tabular-nums ${result.roi >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                {result.roi.toFixed(1)}%
              </span>
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">ROI</span>
            </div>
            {/* 毛利率 */}
            <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-white shadow-sm border">
              <span className={`text-lg font-bold tabular-nums ${result.profitMargin >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                {result.profitMargin.toFixed(1)}%
              </span>
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">毛利率</span>
            </div>
            {/* 总成本 */}
            <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-white shadow-sm border">
              <span className="text-lg font-bold tabular-nums text-slate-700">
                ¥{result.costs.total.toFixed(1)}
              </span>
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">成本</span>
            </div>
            {/* 售价 */}
            <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-indigo-50 shadow-sm border border-indigo-200 whitespace-nowrap">
              <span className="text-lg font-bold tabular-nums text-[#4F46E5]">
                ¥{input.targetPriceRMB.toFixed(0)}
              </span>
              <span className="text-[9px] text-indigo-500 font-semibold uppercase tracking-wide">≈ {Math.round(input.targetPriceRMB * input.exchangeRate).toLocaleString()} ₽</span>
            </div>
          </div>
          
          {/* 右侧：功能聚合 - 扁平紧凑 */}
          <div className="flex items-center gap-2 w-auto flex-shrink-0 pr-2 ml-auto">
            {/* 数据管理下拉菜单 */}
            <div className="relative group">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center justify-center h-7 px-2 rounded border border-gray-300 hover:bg-gray-50 text-xs gap-1">
                      <Settings className="h-3 w-3" />
                      <span>数据</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">数据管理</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {/* 下拉内容 */}
              <div className="absolute top-full right-0 mt-1 bg-white border rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px]">
                <div className="px-3 py-2 border-b text-xs font-medium text-slate-600">导入</div>
                <label className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 cursor-pointer">
                  <Upload className="h-3 w-3 text-blue-600" />
                  <span>导入佣金表</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleCommissionFileUpload} />
                </label>
                <label className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 cursor-pointer">
                  <Truck className="h-3 w-3 text-green-600" />
                  <span>导入物流表</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleShippingFileUpload} />
                </label>
                <div className="px-3 py-2 border-t border-b text-xs font-medium text-slate-600">模板</div>
                <button onClick={() => downloadTemplate("commission")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">佣金表模板</button>
                <button onClick={() => downloadTemplate("shipping")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">物流表模板</button>
                <div className="px-3 py-2 border-t text-xs font-medium text-slate-600">配置</div>
                <button onClick={() => exportConfig()} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">导出配置</button>
                <label className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 cursor-pointer">
                  <FileText className="h-3 w-3" />
                  <span>导入配置</span>
                  <input type="file" accept=".json" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      try {
                        const config = JSON.parse(evt.target?.result as string);
                        if (config.input) {
                          localStorage.setItem("ozon-calculator-input", config.input);
                          window.location.reload();
                        }
                      } catch (err) { alert(`导入失败: ${err}`); }
                    };
                    reader.readAsText(file);
                  }} />
                </label>
              </div>
            </div>
            
            {/* 汇率设置组 - 扁平紧凑 */}
            <div className="flex items-center gap-1 bg-slate-100 rounded px-2 h-8 flex-shrink-0">
              <span className="text-[11px] text-slate-500 whitespace-nowrap">1 CNY =</span>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                value={input.exchangeRate}
                onChange={(e) => {
                  setInput(prev => ({ ...prev, exchangeRate: parseFloat(e.target.value) || 12.0 }));
                  setRateFetchError(null);
                }}
                className="w-[70px] h-6 text-xs bg-white px-2"
                aria-invalid={!!rateFetchError}
                aria-describedby="rate-error"
              />
              <span className="text-[10px] text-slate-400">₽</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0" 
                onClick={fetchExchangeRate} 
                disabled={isFetchingRate} 
                title="获取汇率" 
                aria-label="刷新汇率"
              >
                <RefreshCw className={`h-3 w-3 ${isFetchingRate ? "animate-spin" : ""}`} />
              </Button>
              {/* 汇率错误提示 */}
              {rateFetchError ? (
                <span id="rate-error" className="text-[9px] text-red-500 whitespace-nowrap" role="alert">
                  ⚠️
                </span>
              ) : (
                /* 辅助提示：当前反向换算 */
                <div className="flex flex-col -space-y-0.5">
                  <span className="text-[9px] text-slate-400 whitespace-nowrap">1 RUB ≈ {(1/input.exchangeRate).toFixed(4)}¥</span>
                </div>
              )}
            </div>
            
            {/* 提现手续费 - 扁平紧凑 */}
            <div className="flex items-center gap-1 bg-slate-100 rounded px-2 h-8 flex-shrink-0">
              <span className="text-[11px] text-slate-500 whitespace-nowrap">提现</span>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={input.withdrawalFee}
                onChange={(e) => setInput(prev => ({ ...prev, withdrawalFee: parseFloat(e.target.value) || 0 }))}
                className="w-[50px] h-6 text-xs bg-white px-2"
              />
              <span className="text-[10px] text-slate-400">%</span>
            </div>
            
            {/* 重置按钮 */}
            <div className="border-l border-slate-300 pl-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleReset} className="h-7 w-7 p-0 text-red-600 border-red-300 hover:bg-red-50">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">重置全部</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </header>
      
      {/* 🔹 全局诊断通栏 - 横跨全屏，自适应滚动，去重渲染 */}
      <div 
        id="global-diagnostic-bar"
        className="w-full flex flex-wrap justify-center items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-50 via-amber-50 to-slate-50 border-b border-amber-200"
        style={{ 
          minHeight: '40px',
          maxHeight: '100px',
          overflowY: 'auto'
        }}
      >
        {/* 🔴 致命错误 - 无可用渠道（唯一）- 强烈警报 */}
        {shippingChannels.available.length === 0 && shippingData.length > 0 && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 px-5 py-2 rounded-full text-base font-extrabold bg-red-600 text-white border-4 border-red-800 shadow-2xl animate-critical-flash">
            <AlertCircle className="h-5 w-5" />
            <span>🚨 致命：商品尺寸/重量/属性无法匹配任何物流渠道</span>
          </span>
        )}
        
        {/* 🔴 阻断错误 - 亏损（唯一）- 强烈红色闪烁 */}
        {result.netProfit < 0 && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-full text-base font-extrabold bg-red-500 text-white border-3 border-red-700 shadow-xl animate-urgent-pulse">
            <span className="text-xl">❌</span>
            <span>亏损: ¥{Math.abs(result.netProfit).toFixed(2)}</span>
          </span>
        )}
        
        {/* 尺寸/重量超限（唯一）- 红色边框脉冲 */}
        {(() => {
          const sumDim = input.length + input.width + input.height;
          const maxSide = Math.max(input.length, input.width, input.height);
          const dimEx = shippingChannels.available.find(ch => (ch.maxLength && maxSide > ch.maxLength) || (ch.maxSumDimension && sumDim > ch.maxSumDimension));
          const weightEx = shippingChannels.available.find(ch => ch.maxWeight && input.weight > ch.maxWeight);
          if (dimEx || weightEx) {
            return (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-full text-base font-bold bg-red-100 text-red-700 border-3 border-red-400 animate-urgent-pulse">
                <span className="text-lg">⚠️</span>
                <span>超限</span>
              </span>
            );
          }
          return null;
        })()}
        
        {/* 🔹 货值拦截 - 显示具体数值范围 */}
        {(() => {
          // 提取货值拦截的渠道，获取其数值范围
          const valueBlockedChannel = shippingChannels.unavailable.find(ch => ch.reason?.includes('货值'));
          const maxValueRUB = valueBlockedChannel?.maxValueRUB;
          const minValueRUB = valueBlockedChannel?.minValueRUB;
          const priceRUB = input.targetPriceRMB * input.exchangeRate;
          
          return (valueBlockedChannel && (maxValueRUB || minValueRUB)) ? (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-full text-base font-bold bg-red-500 text-white border-3 border-red-600 shadow-lg animate-urgent-pulse">
              <span>❌</span>
              <span>货值拦截</span>
              <details className="inline ml-1 group">
                <summary className="cursor-help list-none inline text-xs opacity-75 hover:opacity-100">
                  ⓘ
                </summary>
                <div className="hidden group-open:block absolute z-50 mt-2 p-3 bg-white text-slate-700 rounded-lg shadow-xl border-2 border-red-200 text-xs whitespace-nowrap">
                  <div className="font-bold text-red-600 mb-1">货值限制</div>
                  <div>您的售价: ≈ {Math.round(priceRUB).toLocaleString()} ₽</div>
                  <div className="mt-1">允许: {minValueRUB ? Math.round(minValueRUB).toLocaleString() : 0} - {maxValueRUB ? Math.round(maxValueRUB).toLocaleString() : '∞'} ₽</div>
                </div>
              </details>
            </span>
          ) : null;
        })()}
        
        {/* ⚠️ 计抛预警 - 强烈橙色脉冲（唯一） */}
        {selectedBillingInfo?.isVolumetric && selectedBillingInfo.billingWeight > selectedBillingInfo.actualWeight && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-full text-base font-extrabold bg-amber-500 text-white border-3 border-amber-600 shadow-xl animate-warning-pulse">
            <span className="text-lg">⚠️</span>
            <span>计抛: {selectedBillingInfo.billingWeight.toFixed(0)}g</span>
          </span>
        )}
        
        {/* 广告超支 - 橙色警告 */}
        {result.adRiskControl?.isOverBudget && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-full text-base font-bold bg-amber-100 text-amber-800 border-3 border-amber-400 shadow-lg animate-warning-pulse">
            <span className="text-lg">⚠️</span>
            <span>广告超支</span>
          </span>
        )}
        
        {/* 💡 建议 Tips - 紫色提示（唯一） */}
        {(() => {
          const uniqueSuggestions = Array.from(new Set(result.suggestions.slice(0, 2)));
          return uniqueSuggestions.map((s, i) => (
            <span key={`tip-${i}`} className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border-2 border-indigo-200">
              <span>💡</span>
              <span className="whitespace-nowrap">{s}</span>
            </span>
          ));
        })()}
        
        {/* 减重建议 - 绿色（唯一） */}
        {(() => {
          const weightSaved = (selectedBillingInfo?.volumetricWeight || 0) - input.weight;
          if (weightSaved > 50) {
            return (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-emerald-50 text-emerald-700 border-2 border-emerald-300">
                <span>💡</span>
                <span>减重{weightSaved.toFixed(0)}g进下一阶梯</span>
              </span>
            );
          }
          return null;
        })()}
        
        {/* ✅ 参数正常提示（唯一） - 绿色醒目 */}
        {!result.warnings.length && result.netProfit >= 0 && !selectedBillingInfo?.isVolumetric && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-emerald-50 text-emerald-700 border-2 border-emerald-300">
            <span>✅</span>
            <span>参数正常</span>
          </span>
        )}
      </div>
      
      {/* 🔹 主内容区 - 三栏布局 */}
      <main className="flex-1 container mx-auto px-4 py-3">
        <div className="grid grid-cols-12 gap-3 h-[calc(100vh-5rem)]">
          {/* 左侧输入区 col-span-3 ≈ 25% */}
          {/* 🔹 重构：Flex 纵向锁定 - 父容器撑满高度，内部独立滚动 */}
          <div className="col-span-3 flex flex-col h-full">
            {/* 🔹 上部：参数输入区 - 独立滚动区域 */}
            <div className="flex-1 overflow-y-auto scrollbar-thin pb-3">
              <InputPanel
                input={input}
                onInputChange={handleInputChange}
                currentProfitMargin={result.profitMargin}
                onReversePriceFromMargin={handleReversePriceFromMargin}
                marginError={marginError}
                adRiskControl={result.adRiskControl}
                shippingData={shippingData}
                selectedBillingInfo={selectedBillingInfo}
                lockedMargin={lockedMargin}
                onToggleMarginLock={handleToggleMarginLock}
              />
            </div>
          </div>

          {/* 中间财务看板 col-span-5 ≈ 42% */}
          <div className="col-span-5 overflow-y-auto scrollbar-thin">
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

          {/* 右侧物流列表 col-span-4 ≈ 33% */}
          <div className="col-span-4 flex flex-col gap-3 h-[calc(100vh-5rem)] overflow-hidden">
            {/* 物流筛选区 */}
            <div className="bg-card rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  物流渠道
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  可用 {shippingChannels.available.length} / 总计 {shippingChannels.available.length + shippingChannels.unavailable.length}
                </span>
              </div>
              {/* 物流下拉筛选 */}
              <div className="flex items-center gap-2">
                <Select 
                  value={input.designatedProvider || "全部"} 
                  onValueChange={(value) => handleInputChange({ ...input, designatedProvider: value === "全部" ? "" : value })}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="全部物流商" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部物流商</SelectItem>
                    {[...new Set(shippingData.map(ch => ch.thirdParty).filter(Boolean))].sort().map(provider => (
                      <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* 🔹 推荐排序切换 */}
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[10px] text-slate-400 mr-1">推荐:</span>
                {[
                  { key: 'cost' as const, label: '按费用', icon: '💰' },
                  { key: 'time' as const, label: '按时效', icon: '⏱' },
                  { key: 'rating' as const, label: '按评分', icon: '⭐' },
                ].map(({ key, label, icon }) => (
                  <button
                    key={key}
                    onClick={() => setSortMode(key)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                      sortMode === key
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 🔹 唯一物流列表（唯一物流模块） */}
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2">
              {/* 🔹 智能推荐提示 */}
              {!input.designatedProvider && shippingChannels.available.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">💡</span>
                    <span className="text-blue-700">
                      根据您的商品属性，已为您
                      {sortMode === 'cost' ? '按费用推荐' : sortMode === 'time' ? '按时效推荐' : '按评分推荐'}
                      ，前 <strong>{Math.min(shippingChannels.available.length, 10)}</strong> 条渠道
                    </span>
                  </div>
                </div>
              )}
              
              {/* 可用渠道 - 高密度信息卡片 */}
              {sortedAvailableChannels.slice(0, showAllAvailable ? undefined : 10).map((channel) => {
                const cost = channelCosts.get(channel.id) ?? 0;
                const billing = channelBillingInfo.get(channel.id);
                const isSelected = selectedChannel?.id === channel.id;
                const hasVolumetricBilling = supportsVolumetricBilling(channel);
                const showVolumetricWarning = hasVolumetricBilling && billing?.isVolumetric;
                const divisor = billing?.divisor || 12000;
                
                return (
                  <LogisticsCard
                    key={channel.id}
                    channel={channel}
                    cost={cost}
                    billing={billing}
                    isSelected={isSelected}
                    onClick={() => handleSelectChannel(channel)}
                    input={input}
                  />
                );
              })}
              
              {/* 🔹 可用渠道查看更多/收起 */}
              {shippingChannels.available.length > 10 && (
                <button
                  onClick={() => setShowAllAvailable(!showAllAvailable)}
                  className="w-full py-2 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  {showAllAvailable ? (
                    <>收起渠道</>
                  ) : (
                    <>查看全部 {shippingChannels.available.length} 条可用渠道</>
                  )}
                </button>
              )}
              
              {/* 不可用渠道（灰色卡片 + 红色拦截原因，下沉底部） */}
              {shippingChannels.unavailable.length > 0 && (
                <div className="mt-4 pt-4 border-t-2 border-dashed border-slate-300">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-3">
                    <AlertCircle className="h-4 w-4" />
                    不可用渠道 ({shippingChannels.unavailable.length})
                  </div>
                  <div className="space-y-2">
                    {sortedUnavailableChannels.slice(0, showAllUnavailable ? undefined : 5).map((channel) => (
                      <div key={channel.id} className="p-3 rounded-lg bg-slate-100/60 border border-slate-200 opacity-60 hover:opacity-80 transition-opacity">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-600 truncate">
                              {channel.thirdParty} - {channel.name}
                            </div>
                          </div>
                        </div>
                        {/* 红色拦截原因 */}
                        <div className="flex items-start gap-2 bg-red-50 border border-red-100 p-2 rounded">
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                          <span className="text-[10px] text-red-600 font-medium leading-relaxed">{channel.reason}</span>
                        </div>
                      </div>
                    ))}
                    {/* 🔹 不可用渠道查看更多/收起 */}
                    {shippingChannels.unavailable.length > 5 && (
                      <button
                        onClick={() => setShowAllUnavailable(!showAllUnavailable)}
                        className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        {showAllUnavailable ? (
                          <>收起不可用渠道</>
                        ) : (
                          <>查看全部 {shippingChannels.unavailable.length} 条不可用渠道</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* 🔹 CSV 列映射弹窗 */}
      {parsedCsvData && (
        <PreviewMappingDialog
          open={mappingDialogOpen}
          onOpenChange={(open) => {
            setMappingDialogOpen(open);
            if (!open) {
              setPendingMappingFile(null);
              setParsedCsvData(null);
            }
          }}
          parsedData={parsedCsvData}
          dataType={mappingDataType}
          onConfirm={handleMappingConfirm}
          onCancel={handleMappingCancel}
        />
      )}
    </div>
  );
}
