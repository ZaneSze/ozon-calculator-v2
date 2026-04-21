"use client";

import { useState } from "react";
import { ShippingChannel, CalculationInput } from "@/lib/types";
import { CalculationTrace } from "./mapping-debug-panel";

interface LogisticsCardProps {
  channel: ShippingChannel;
  cost: number;
  billing: {
    mode: string;
    billingWeight: number;
    actualWeight: number;
    volumetricWeight: number;
    isVolumetric: boolean;
    divisor: number;
  } | undefined;
  isSelected: boolean;
  onClick: () => void;
  input: CalculationInput;
}

// 格式化函数
const fDim = (v: number | undefined | null): string => {
  if (v === undefined || v === null || v === Infinity) return '无限制';
  return `≤${v}`;
};

const fPrice = (v: number | undefined | null): string => {
  if (v === undefined || v === null || v === Infinity) return '无上限';
  return Math.round(v).toLocaleString();
};

export function LogisticsCard({ channel, cost, billing, isSelected, onClick, input }: LogisticsCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  // 🔴 核心逻辑：直接使用计算引擎的结果，不做本地判定
  const isVolMetric = billing?.isVolumetric ?? false;
  const volWeight = billing?.volumetricWeight || 0;
  const actualWeight = billing?.actualWeight || 0;
  
  // 🔴 安全防护：如果抛重异常（超过 50kg），强制关闭标签
  const safetyCheck = volWeight < 50000;  // 50kg 安全阀
  const showVolumetricLabel = isVolMetric && safetyCheck;
  
  const isAvailable = true; // 默认可用，拦截原因在 unavailable 列表展示
  
  // 🔴 关键修复：直接使用 varFeePerGram（每克运费），不转换
  const varFeePerGram = channel.varFeePerGram;
  
  // 从 billing 获取计费数据
  const freightData = {
    total: cost,
    original: cost * 1.1, // 模拟原价
    billingWeight: billing?.billingWeight || 0,
    formula: billing 
      ? `¥${channel.fixFee.toFixed(2)} + (${billing.billingWeight}g × ¥${varFeePerGram.toFixed(4)})`
      : '计算中...'
  };

  // 从 channel 提取 limits 数据（兼容新旧数据结构）
  const limits = {
    minWt: channel.minWeight || 0,
    maxWt: channel.maxWeight || Infinity,
    maxSide: channel.maxLength || Infinity, // 近似最长边
    maxSum: channel.maxSumDimension || Infinity,
    minPrice: channel.minValueRUB || 0,     // 货值下限
    maxPrice: channel.maxValueRUB || Infinity, // 货值上限
    maxVolWt: billing?.divisor || 12000,
    allowBattery: channel.batteryAllowed !== false,
    allowLiquid: channel.liquidAllowed !== false,
  };

  return (
    <div 
      onClick={onClick}
      className={`relative border rounded-lg p-4 mb-2 transition-all cursor-pointer ${
        !isAvailable 
          ? 'bg-secondary opacity-60 border-border' 
          : isSelected 
            ? 'bg-indigo-50/50 border-[#6366F1] shadow-md ring-1 ring-[#6366F1]/20' 
            : 'bg-card hover:shadow-md border-border'
      }`}
    >
      {/* 1. 顶部状态栏：时效 + 计抛强提醒 + Ozon 评级 */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            ⏱ {channel.deliveryTimeMin || 15}-{channel.deliveryTimeMax || 30} 天
          </span>
          {showVolumetricLabel && isAvailable && (
            <span className="animate-pulse bg-[#F59E0B] text-white text-[10px] px-2 py-0.5 rounded-full font-semibold shadow-sm">
              ⚠️ 计抛
            </span>
          )}
          {/* Ozon 评级标签 */}
          {channel.ozonRating > 0 && (
            <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-yellow-200">
              <span className="text-yellow-500">★</span>
              <span>{channel.ozonRating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          {channel.serviceTier || '-'}
        </div>
      </div>

      {/* 2. 标题与价格区 */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            {channel.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] bg-indigo-50 text-[#6366F1] px-1.5 py-0.5 rounded border border-indigo-100">
              {channel.serviceLevel || '标准'}
            </span>
            <span className="text-[10px] text-muted-foreground">{channel.thirdParty || 'Ozon'}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-[#6366F1]">
            ¥ {freightData.total.toFixed(2)}
          </div>
          {/* 原价仅在计抛时显示 */}
          {showVolumetricLabel && (
            <div className="text-[10px] text-muted-foreground line-through">
              实重: ¥ {((billing?.actualWeight || 0) * channel.varFeePerGram + channel.fixFee).toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* 3. 特货属性横条 */}
      <div className="flex gap-2 mb-3">
        <div className={`flex-1 text-center py-1 rounded text-[10px] font-medium border ${
          limits.allowBattery 
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
            : 'bg-red-50 text-red-400 border-red-100'
        }`}>
          {limits.allowBattery ? '⚡ 带电' : '🚫 禁电'}
        </div>
        <div className={`flex-1 text-center py-1 rounded text-[10px] font-medium border ${
          limits.allowLiquid 
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
            : 'bg-red-50 text-red-400 border-red-100'
        }`}>
          {limits.allowLiquid ? '💧 液体' : '🚫 禁液'}
        </div>
      </div>

      {/* 4. 限制矩阵 */}
      <div className="grid grid-cols-2 gap-2 bg-secondary p-2.5 rounded border border-border">
        <div className="text-[11px] text-muted-foreground">
          <span className="opacity-70">⚖️ 限重:</span> <b className="text-foreground">{limits.minWt}-{fDim(limits.maxWt)}g</b>
        </div>
        <div className="text-[11px] text-muted-foreground">
          <span className="opacity-70">📏 边长:</span> <b className="text-foreground">≤{fDim(limits.maxSide)}cm</b>
        </div>
        <div className="text-[11px] text-muted-foreground">
          <span className="opacity-70">📐 三边:</span> <b className="text-foreground">≤{fDim(limits.maxSum)}cm</b>
        </div>
        <div className="text-[11px] text-muted-foreground">
          <span className="opacity-70">💰 货值:</span> <b className="text-foreground">{fPrice(limits.minPrice)}-{fPrice(limits.maxPrice)}₽</b>
        </div>
      </div>

      {/* 5. 计费详情 (默认折叠) */}
      <details className="mt-3 group">
        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-[#6366F1] list-none flex items-center gap-1 select-none">
          <span className="group-open:rotate-180 transition-transform">▼</span> 
          <span>计费重: {freightData.billingWeight}g</span>
        </summary>
        <div className="mt-2 text-[10px] text-muted-foreground bg-secondary p-2 rounded border border-dashed border-border space-y-1.5">
          {/* 实重 */}
          <div className="flex justify-between">
            <span>实重:</span>
            <span>{billing?.actualWeight?.toFixed(0) || 0}g</span>
          </div>
          {/* 抛重 */}
          <div className="flex justify-between">
            <span>抛重:</span>
            <span className={billing?.isVolumetric ? "text-[#F59E0B] font-medium" : ""}>
              {billing?.volumetricWeight?.toFixed(0) || 0}g
              {billing?.isVolumetric && " ⚠️"}
            </span>
          </div>
          {/* 计费重高亮 */}
          <div className="flex justify-between font-semibold pt-1 border-t border-border">
            <span>计费重:</span>
            <span className={billing?.isVolumetric ? "text-[#EF4444]" : "text-foreground"}>
              {billing?.billingWeight?.toFixed(0) || 0}g
            </span>
          </div>
          {/* 计算公式 */}
          <div className="pt-1 border-t border-border text-[9px] opacity-70">
            {freightData.formula}
          </div>
          
          {/* 计算轨迹 (Debug - dev only) */}
          {process.env.NODE_ENV === 'development' && (
          <CalculationTrace 
            channel={{
              name: channel.name,
              minWeight: channel.minWeight,
              maxWeight: channel.maxWeight,
              maxLength: channel.maxLength,
              maxSumDimension: channel.maxSumDimension,
              minValueRUB: channel.minValueRUB,
              maxValueRUB: channel.maxValueRUB,
              volumetricDivisor: channel.volumetricDivisor,
            }}
            input={{
              weight: input.weight,
              length: input.length,
              width: input.width,
              height: input.height,
              priceRUB: input.targetPriceRMB / input.exchangeRate,
            }}
            interceptionReasons={[]}
            isAvailable={true}
          />
          )}
        </div>
      </details>

      {/* 选中徽章 */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-[#6366F1] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm z-10">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          已选
        </div>
      )}
    </div>
  );
}