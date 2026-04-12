"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Package, Truck, Megaphone, Tag, AlertTriangle, RotateCcw, Battery, Droplets, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useDataHub } from "@/lib/data-hub-context";
import { CalculationInput, ShippingChannel } from "@/lib/types";
import { calculateVolumetricWeight } from "@/lib/calculator";

interface InputPanelProps {
  input: CalculationInput;
  onInputChange: (input: CalculationInput) => void;
  // 逆向推价所需的额外参数
  currentProfitMargin?: number; // 当前实际利润率 (%)
  onReversePriceFromMargin?: (targetMargin: number) => void; // 逆向推价回调
  marginError?: string | null; // 利润率熔断警告
  onReset?: () => void; // 一键重置回调
  // 广告风控数据
  adRiskControl?: {
    breakEvenACOS: number;
    currentACOS: number;
    isOverBudget: boolean;
    cvrSensitivity?: {
      costReduction: number;
      profitIncreasePercent: number;
      currentCost: number;
      newCost: number;
    };
  };
  // 🔹 物流数据（用于检测功能依赖）
  shippingData?: ShippingChannel[];
}

export function InputPanel({ input, onInputChange, currentProfitMargin, onReversePriceFromMargin, marginError, onReset, adRiskControl, shippingData = [] }: InputPanelProps) {
  const { getCategories } = useDataHub();
  const categories = useMemo(() => getCategories(), [getCategories]);
  
  // 🔹 检测物流表功能依赖
  const hasBatteryMapping = useMemo(() => {
    return shippingData.some(channel => channel.batteryAllowed !== false);
  }, [shippingData]);
  
  const hasLiquidMapping = useMemo(() => {
    return shippingData.some(channel => channel.liquidAllowed !== false);
  }, [shippingData]);
  
  // 目标利润率输入状态（用于逆向推价）
  const [targetMarginInput, setTargetMarginInput] = useState<string>("");
  
  // 🔹 输入源标记：防止循环更新
  const isUpdatingFromMargin = useRef(false);
  
  // 🔹 初始化：组件加载时显示当前利润率
  useEffect(() => {
    if (currentProfitMargin !== undefined && targetMarginInput === "") {
      setTargetMarginInput(currentProfitMargin.toFixed(1));
    }
  }, []); // 仅在组件挂载时执行
  
  // 🔹 当售价变化时，自动同步利润率显示
  useEffect(() => {
    // 如果当前正在从利润率反推售价，跳过此次同步
    if (isUpdatingFromMargin.current) {
      isUpdatingFromMargin.current = false;
      return;
    }
    
    // 当实际利润率变化且不是用户手动输入利润率时，自动同步到输入框
    if (currentProfitMargin !== undefined) {
      setTargetMarginInput(currentProfitMargin.toFixed(1));
    }
  }, [currentProfitMargin]);

  const updateField = <K extends keyof CalculationInput>(key: K, value: CalculationInput[K]) => {
    onInputChange({ ...input, [key]: value });
  };

  // 体积重警告
  const volumetricWeight = calculateVolumetricWeight(input.length, input.width, input.height);
  const isVolumetricWarning = volumetricWeight > input.weight && input.weight > 0;

  // 当一级类目改变时，重置二级类目
  const handlePrimaryCategoryChange = (primary: string) => {
    const cat = categories.find((c) => c.primary === primary);
    const secondary = cat?.secondary[0] || "";
    onInputChange({ ...input, primaryCategory: primary, secondaryCategory: secondary });
  };

  const selectedCategory = categories.find((c) => c.primary === input.primaryCategory);

  return (
    <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-6rem)] pr-1 scrollbar-thin">
      {/* 一键重置按钮 - 右上角显眼位置 */}
      {onReset && (
        <div className="flex justify-end">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 rounded transition-colors"
            title="重置所有输入为默认值"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            一键重置
          </button>
        </div>
      )}
      
      {/* 模块 A：商品参数与物流拦截 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            商品参数与物流拦截
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">一级类目</Label>
              <Select value={input.primaryCategory} onValueChange={handlePrimaryCategoryChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="选择一级类目" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.primary} value={cat.primary}>
                      {cat.primary}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">二级类目</Label>
              <Select
                value={input.secondaryCategory}
                onValueChange={(v) => updateField("secondaryCategory", v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="选择二级类目" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCategory?.secondary.map((sec) => (
                    <SelectItem key={sec} value={sec}>
                      {sec}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">长 (cm)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={input.length || ""}
                onChange={(e) => updateField("length", parseFloat(e.target.value) || 0)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">宽 (cm)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={input.width || ""}
                onChange={(e) => updateField("width", parseFloat(e.target.value) || 0)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">高 (cm)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={input.height || ""}
                onChange={(e) => updateField("height", parseFloat(e.target.value) || 0)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">实际物理重量 (g)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={input.weight || ""}
              onChange={(e) => updateField("weight", parseFloat(e.target.value) || 0)}
              className="h-9 text-sm"
            />
            {isVolumetricWarning && (
              <div className="flex items-center gap-1.5 text-xs text-red-700 font-medium p-2 rounded-md bg-red-50 border border-red-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                泡货预警：按体积重 ({volumetricWeight.toFixed(0)}g) 计费
              </div>
            )}
          </div>
          
          {/* 🔹 商品属性开关 */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className={`flex flex-col p-3 rounded-lg border-2 transition-all ${
              input.hasBattery 
                ? "bg-amber-50 border-amber-300 shadow-sm" 
                : "bg-muted/30 border-border"
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Battery className={`h-4 w-4 ${input.hasBattery ? "text-amber-600" : "text-muted-foreground"}`} />
                  <Label className="text-xs font-medium cursor-pointer">
                    带电商品
                  </Label>
                </div>
                <Switch
                  checked={input.hasBattery || false}
                  onCheckedChange={(checked) => updateField("hasBattery", checked)}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
              {/* 🔹 功能依赖提示 */}
              {!hasBatteryMapping && (
                <div className="flex items-start gap-1 text-[10px] text-gray-500 mt-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>物流表未提供电池限制数据，无法自动过滤</span>
                </div>
              )}
              {hasBatteryMapping && (
                <div className="flex items-center gap-1 text-[10px] text-green-600 mt-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>✓ 支持自动过滤禁电渠道</span>
                </div>
              )}
            </div>
            
            <div className={`flex flex-col p-3 rounded-lg border-2 transition-all ${
              input.hasLiquid 
                ? "bg-blue-50 border-blue-300 shadow-sm" 
                : "bg-muted/30 border-border"
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Droplets className={`h-4 w-4 ${input.hasLiquid ? "text-blue-600" : "text-muted-foreground"}`} />
                  <Label className="text-xs font-medium cursor-pointer">
                    带液体商品
                  </Label>
                </div>
                <Switch
                  checked={input.hasLiquid || false}
                  onCheckedChange={(checked) => updateField("hasLiquid", checked)}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>
              {/* 🔹 功能依赖提示 */}
              {!hasLiquidMapping && (
                <div className="flex items-start gap-1 text-[10px] text-gray-500 mt-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>物流表未提供液体限制数据，无法自动过滤</span>
                </div>
              )}
              {hasLiquidMapping && (
                <div className="flex items-center gap-1 text-[10px] text-green-600 mt-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>✓ 支持自动过滤禁液体渠道</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 模块 B：供应链与损耗成本 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            供应链与损耗成本
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">采购成本 (¥)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={input.purchaseCost || ""}
                onChange={(e) => updateField("purchaseCost", parseFloat(e.target.value) || 0)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">国内头程 (¥)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={input.domesticShipping || ""}
                onChange={(e) => updateField("domesticShipping", parseFloat(e.target.value) || 0)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">包装杂费 (¥)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={input.packagingFee || ""}
                onChange={(e) => updateField("packagingFee", parseFloat(e.target.value) || 0)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">退货损耗沙盘</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">预期退货率 (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={input.returnRate || ""}
                  onChange={(e) => updateField("returnRate", parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">退货处理方式</Label>
                <Select
                  value={input.returnHandling}
                  onValueChange={(v) => updateField("returnHandling", v as CalculationInput["returnHandling"])}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="destroy">全部销毁 (损货值+运费)</SelectItem>
                    <SelectItem value="resell">退回重售 (仅损运费)</SelectItem>
                    <SelectItem value="productOnly">仅损商品成本</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 模块 C：高阶广告 ROI 控制台 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            高阶广告 ROI 控制台
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* CPA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">按订单推广 (CPA)</Label>
              <button
                type="button"
                onClick={() => updateField("cpaEnabled", !input.cpaEnabled)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  input.cpaEnabled
                    ? "bg-green-500 text-white shadow-sm"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {input.cpaEnabled ? "ON" : "OFF"}
              </button>
            </div>
            <div className={`transition-opacity ${input.cpaEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={input.cpaRate || ""}
                  onChange={(e) => updateField("cpaRate", parseFloat(e.target.value) || 0)}
                  className="w-20 h-8 text-sm"
                  disabled={!input.cpaEnabled}
                />
                <span className="text-xs text-muted-foreground">%</span>
                {input.cpaEnabled && input.cpaRate > 0 && (
                  <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                    广告费: {input.cpaRate}%×售价
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* CPC */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">按点击推广 (CPC)</Label>
              <button
                type="button"
                onClick={() => updateField("cpcEnabled", !input.cpcEnabled)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  input.cpcEnabled
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {input.cpcEnabled ? "ON" : "OFF"}
              </button>
            </div>
            <div className={`transition-opacity ${input.cpcEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">单次竞价 (₽)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={input.cpcBid || ""}
                    onChange={(e) => updateField("cpcBid", parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm"
                    disabled={!input.cpcEnabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">转化率 CVR (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={input.cpcConversionRate || ""}
                    onChange={(e) => updateField("cpcConversionRate", parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm"
                    disabled={!input.cpcEnabled}
                  />
                </div>
              </div>
              {input.cpcEnabled && input.cpcBid > 0 && input.cpcConversionRate > 0 && (
                <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1 flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help font-medium">单均转化成本</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">单均转化成本 / Cost Per Conversion</p>
                          <p className="text-xs text-muted-foreground">
                            每获得一个订单所需的广告花费。计算公式：单次竞价 ÷ 转化率
                          </p>
                          <p className="text-xs text-muted-foreground">
                            The advertising cost required to acquire one order. Formula: CPC Bid ÷ Conversion Rate
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span>: ¥{((input.cpcBid / (input.cpcConversionRate / 100)) * input.exchangeRate).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* 广告风控面板 */}
          {adRiskControl && (input.cpaEnabled || input.cpcEnabled) && (
            <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
              {/* 保本 ACOS 显示 */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">保本 ACOS:</span>
                <span className="font-medium">{adRiskControl.breakEvenACOS.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">当前 ACOS:</span>
                <span className={`font-medium ${adRiskControl.isOverBudget ? 'text-red-600' : ''}`}>
                  {adRiskControl.currentACOS.toFixed(1)}%
                </span>
              </div>
              
              {/* 超预算警告 */}
              {adRiskControl.isOverBudget && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-2 rounded animate-pulse flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span className="font-medium">⚠️ 广告费已超毛利，当前每单亏损！</span>
                </div>
              )}
              
              {/* CVR 灵敏度提示 */}
              {input.cpcEnabled && adRiskControl.cvrSensitivity && adRiskControl.cvrSensitivity.costReduction > 0 && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-2 rounded">
                  💡 提示：若转化率 (CVR) 提升 1%，单均转化成本将下降 ¥{adRiskControl.cvrSensitivity.costReduction.toFixed(2)}
                  {adRiskControl.cvrSensitivity.profitIncreasePercent > 0 && (
                    <span>，净利润提升 {adRiskControl.cvrSensitivity.profitIncreasePercent.toFixed(1)}%</span>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 模块 D：前台定价与营销缓冲 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            前台定价与营销缓冲
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 三向联动输入组：RMB / RUB / 利润率 */}
          <div className="grid grid-cols-3 gap-3">
            {/* RMB 售价 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">前台售价 (¥ RMB)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">¥</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={input.targetPriceRMB || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || val === "-") {
                      updateField("targetPriceRMB", 0);
                    } else {
                      updateField("targetPriceRMB", parseFloat(val) || 0);
                    }
                  }}
                  className="h-9 text-sm pl-6"
                  placeholder="0.00"
                />
              </div>
            </div>
            {/* RUB 售价 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">前台售价 (₽ RUB)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">₽</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    input.targetPriceRMB > 0 && input.exchangeRate > 0
                      ? parseFloat((input.targetPriceRMB / input.exchangeRate).toFixed(2))
                      : ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || val === "-") {
                      updateField("targetPriceRMB", 0);
                    } else {
                      const rubValue = parseFloat(val) || 0;
                      const rmbValue = rubValue * input.exchangeRate;
                      updateField("targetPriceRMB", parseFloat(rmbValue.toFixed(4)));
                    }
                  }}
                  className="h-9 text-sm pl-6"
                  placeholder="0"
                />
              </div>
            </div>
            {/* 目标利润率 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">目标利润率 (%)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">%</span>
                <Input
                  type="number"
                  min="-99"
                  max="99"
                  step="1"
                  value={targetMarginInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTargetMarginInput(val); // 更新本地状态
                    
                    // 🔹 设置输入源标记，防止售价更新后再次触发利润率同步
                    isUpdatingFromMargin.current = true;
                    
                    if (val === "" || val === "-") {
                      // 空值或负号，不触发计算
                    } else {
                      const targetMargin = parseFloat(val);
                      if (onReversePriceFromMargin && !isNaN(targetMargin)) {
                        onReversePriceFromMargin(targetMargin);
                      }
                    }
                  }}
                  className={`h-9 text-sm pl-6 ${marginError ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                  placeholder="0"
                />
              </div>
              {marginError && (
                <div className="text-[10px] text-red-600 font-medium mt-1 p-1.5 rounded bg-red-50 border border-red-200">
                  {marginError}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">预留大促折扣 (%)</Label>
            <Input
              type="number"
              min="0"
              max="99"
              step="1"
              value={input.promotionDiscount || ""}
              onChange={(e) => updateField("promotionDiscount", parseFloat(e.target.value) || 0)}
              className="h-9 text-sm"
            />
            {input.promotionDiscount > 0 && input.targetPriceRMB > 0 && (
              <div className="text-xs text-muted-foreground p-2 rounded-md bg-muted/30">
                <span className="font-medium">划线原价:</span>{" "}
                ¥{(input.targetPriceRMB / (1 - input.promotionDiscount / 100)).toFixed(2)}
                {" "}(≈{(input.targetPriceRMB / (1 - input.promotionDiscount / 100) / input.exchangeRate).toFixed(0)} ₽)
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}