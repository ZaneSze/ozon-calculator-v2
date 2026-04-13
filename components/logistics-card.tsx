"use client";

import { useState } from "react";
import { ShippingChannel, CalculationInput } from "@/lib/types";

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
      className={`relative border rounded-xl p-4 mb-3 transition-all cursor-pointer ${
        !isAvailable 
          ? 'bg-gray-50 opacity-60 border-gray-200' 
          : isSelected 
            ? 'bg-blue-50 border-blue-400 shadow-lg ring-2 ring-blue-200' 
            : 'bg-white hover:shadow-lg border-blue-100'
      }`}
    >
      {/* 1. 顶部状态栏：时效 + 计抛强提醒 + Ozon 评级 */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            ⏱ {channel.deliveryTimeMin || 15}-{channel.deliveryTimeMax || 30} 天
          </span>
          {showVolumetricLabel && isAvailable && (
            <span className="animate-pulse bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">
              ⚠️ 触发计抛
            </span>
          )}
          {/* Ozon 评级标签 */}
          {channel.ozonRating > 0 && (
            <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-200">
              <span className="text-yellow-500">★</span>
              <span>{channel.ozonRating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="text-xs text-slate-400 font-medium">
          评分组: {channel.serviceTier || '-'}
        </div>
      </div>

      {/* 2. 标题与价格区 */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-base font-black text-slate-800 leading-tight">
            {channel.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
              {channel.serviceLevel || '标准服务'}
            </span>
            <span className="text-[10px] text-slate-400">{channel.thirdParty || 'Ozon网络'}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-blue-600">
            ¥ {freightData.total.toFixed(2)}
          </div>
          {/* 原价仅在计抛时显示 */}
          {showVolumetricLabel && (
            <div className="text-[10px] text-slate-400 line-through">
              实重价: ¥ {((billing?.actualWeight || 0) * channel.varFeePerGram + channel.fixFee).toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* 3. 特货属性横条 */}
      <div className="flex gap-2 mb-4">
        <div className={`flex-1 text-center py-1 rounded text-[10px] font-bold border ${
          limits.allowBattery 
            ? 'bg-green-50 text-green-600 border-green-100' 
            : 'bg-red-50 text-red-300 border-red-100'
        }`}>
          {limits.allowBattery ? '⚡ 支持带电' : '🚫 禁发带电'}
        </div>
        <div className={`flex-1 text-center py-1 rounded text-[10px] font-bold border ${
          limits.allowLiquid 
            ? 'bg-green-50 text-green-600 border-green-100' 
            : 'bg-red-50 text-red-300 border-red-100'
        }`}>
          {limits.allowLiquid ? '💧 支持液体' : '🚫 禁发液体'}
        </div>
      </div>

      {/* 4. 限制矩阵 (核心：数据读取 channel limits) */}
      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
        <div className="text-[11px] text-slate-500">
          <span className="opacity-70">⚖️ 限重:</span> <b className="text-slate-700">{limits.minWt}-{fDim(limits.maxWt)}g</b>
        </div>
        <div className="text-[11px] text-slate-500">
          <span className="opacity-70">📏 边长:</span> <b className="text-slate-700">最长边{fDim(limits.maxSide)}cm</b>
        </div>
        <div className="text-[11px] text-slate-500">
          <span className="opacity-70">📐 三边和:</span> <b className="text-slate-700">{fDim(limits.maxSum)}cm</b>
        </div>
        <div className="text-[11px] text-slate-500">
          <span className="opacity-70">💰 货值:</span> <b className="text-slate-700">{fPrice(limits.minPrice)}-{fPrice(limits.maxPrice)}₽</b>
        </div>
      </div>

      {/* 5. 计费详情 (默认折叠) */}
      <details className="mt-3 group">
        <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-blue-500 list-none flex items-center gap-1 select-none">
          <span className="group-open:rotate-180 transition-transform">▼</span> 
          <span>查看计费详情 (当前计费重: {freightData.billingWeight}g)</span>
        </summary>
        <div className="mt-2 text-[10px] text-slate-500 bg-white p-2 rounded border border-dashed border-slate-200 space-y-1.5">
          {/* 实重 */}
          <div className="flex justify-between">
            <span>实重:</span>
            <span>{billing?.actualWeight?.toFixed(0) || 0}g</span>
          </div>
          {/* 抛重 */}
          <div className="flex justify-between">
            <span>抛重:</span>
            <span className={billing?.isVolumetric ? "text-orange-600 font-medium" : ""}>
              {billing?.volumetricWeight?.toFixed(0) || 0}g
              {billing?.isVolumetric && " [触发]"}
            </span>
          </div>
          {/* 计费重高亮 */}
          <div className="flex justify-between font-bold pt-1 border-t border-slate-100">
            <span>计费重:</span>
            <span className={billing?.isVolumetric ? "text-red-600" : "text-slate-700"}>
              {billing?.billingWeight?.toFixed(0) || 0}g
            </span>
          </div>
          {/* 计算公式 */}
          <div className="pt-1 border-t border-slate-100 text-[9px] text-slate-400">
            {freightData.formula}
          </div>
        </div>
      </details>

      {/* 选中徽章 */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md z-10">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          已选
        </div>
      )}
    </div>
  );
}