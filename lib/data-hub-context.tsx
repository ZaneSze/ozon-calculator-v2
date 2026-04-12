"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { CategoryCommission, ShippingChannel } from "./types";
import {
  COMMISSION_COLUMN_KEYWORDS,
  SHIPPING_COLUMN_KEYWORDS,
  mapColumnsByKeywords,
  checkRequiredFields,
} from "./column-keywords";
import { DEFAULT_COMMISSION_DATA, DEFAULT_SHIPPING_DATA } from "./default-data";

// 佣金阶梯金额边界
const TIER_BOUNDARIES = [
  { min: 0, max: 1500 },
  { min: 1500.01, max: 5000 },
  { min: 5000.01, max: Infinity },
] as const;

// 列映射配置类型
export interface ColumnMapping {
  commission: Record<string, number>; // 佣金表列映射
  shipping: Record<string, number>;   // 物流表列映射
}

interface DataHubContextType {
  commissionData: CategoryCommission[];
  shippingData: ShippingChannel[];
  commissionLoaded: boolean;
  shippingLoaded: boolean;
  columnMapping: ColumnMapping;
  loadCommissionData: (file: File, mode?: "overwrite" | "merge") => Promise<void>;
  loadShippingData: (file: File, mode?: "overwrite" | "merge") => Promise<void>;
  clearCommissionData: () => void;
  clearShippingData: () => void;
  updateColumnMapping: (type: "commission" | "shipping", mapping: Record<string, number>) => void;
  getCategories: () => { primary: string; secondary: string[] }[];
  getCommissionByCategory: (primary: string, secondary: string) => CategoryCommission | undefined;
  getShippingChannels: (
    length: number,
    width: number,
    height: number,
    weight: number,
    priceRUB: number,
    exchangeRate: number,
    hasBattery?: boolean,
    hasLiquid?: boolean,
    designatedProvider?: string
  ) => { available: ShippingChannel[]; unavailable: (ShippingChannel & { reason: string })[] };
}

const DataHubContext = createContext<DataHubContextType | undefined>(undefined);

// ========================================================
// 工具函数
// ========================================================

function parsePercentString(val: string): number {
  return parseFloat(val.replace("%", "").replace(",", ".").trim());
}

/**
 * 智能寻找真实表头行（佣金表）
 * 查找包含 "一级类目" 和 "二级类目" 的行
 */
function findCommissionHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    const joined = row.join(" ").toLowerCase();
    if (joined.includes("一级类目") && joined.includes("二级类目")) {
      return i;
    }
    // 英文备选
    if (joined.includes("primary") && joined.includes("category")) {
      return i;
    }
  }
  return -1;
}

/**
 * 智能寻找佣金费率列
 * 查找包含 "Тариф" 或 "tariff" 或 "rate" 或 "%" 和阶梯区间关键字的列
 */
function findCommissionTierColumns(headers: string[]): { tier1: number; tier2: number; tier3: number } {
  console.log("[佣金列识别] 表头列表:", headers);
  
  let tier1 = -1, tier2 = -1, tier3 = -1;
  
  // 🔹 策略1：精确匹配阶梯关键词
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    const originalH = headers[i]; // 保留原始大小写
    
    // 第一阶梯：0-1500 RUB
    if (tier1 === -1) {
      // 🔹 优化匹配：支持 "0 - 1500", "0-1500", "<1500" 等格式
      if ((h.includes("0") && h.includes("1500") && h.includes("rfbs")) || 
          h.includes("tier1") || 
          h.includes("c1") ||
          h.includes("<1500") ||
          h.includes("до 1500") ||
          h.includes("до 1500 руб") ||
          (h.includes("rfbs") && h.includes("0") && h.includes("1500") && !h.includes("1500.01") && !h.includes("5000"))) {
        tier1 = i;
        console.log(`  ✓ 找到 tier1 列 [${i}]: ${originalH}`);
      }
    }
    
    // 第二阶梯：1500-5000 RUB
    if (tier2 === -1) {
      // 🔹 优化匹配：支持 "1500.01 - 5000", "1500-5000" 等格式
      if ((h.includes("1500") && h.includes("5000") && h.includes("rfbs") && !h.includes("5000.01")) || 
          h.includes("tier2") || 
          h.includes("c2") ||
          (h.includes("1500") && h.includes("5000") && !h.includes("5000.01") && !h.includes("0 - 1500")) ||
          h.includes("от 1500") ||
          h.includes("1500-5000 руб") ||
          h.includes("1500.01")) {
        tier2 = i;
        console.log(`  ✓ 找到 tier2 列 [${i}]: ${originalH}`);
      }
    }
    
    // 第三阶梯：>5000 RUB
    if (tier3 === -1) {
      // 🔹 优化匹配：支持 "5000.01+", ">5000", "5000+" 等格式
      if ((h.includes("5000") && (h.includes("+") || h.includes("plus") || h.includes(">") || h.includes(".01+"))) || 
          h.includes("tier3") || 
          h.includes("c3") ||
          h.includes(">5000") ||
          h.includes("от 5000") ||
          h.includes("> 5000 руб") ||
          h.includes("5000+") ||
          h.includes("5000.01+") ||
          (h.includes("rfbs") && h.includes("5000") && (h.includes("+") || h.includes(">") || h.includes(".01")))) {
        tier3 = i;
        console.log(`  ✓ 找到 tier3 列 [${i}]: ${originalH}`);
      }
    }
  }
  
  // 🔹 策略2：兜底 - 按顺序识别费率列
  if (tier1 === -1 || tier2 === -1 || tier3 === -1) {
    console.log("[佣金列识别] 未找到所有阶梯列，尝试兜底策略...");
    const rateColumns: number[] = [];
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      // 🔹 增强识别：包含 "тариф" 或 "%" 且在 RFBS 列之后
      if (h.includes("тариф") || 
          h.includes("rate") || 
          h.includes("%") || 
          (h.includes("rfbs") && h.includes("тариф"))) {
        rateColumns.push(i);
      }
    }
    
    console.log(`[佣金列识别] 找到 ${rateColumns.length} 个费率列:`, rateColumns.map(i => `[${i}]${headers[i]}`));
    
    if (rateColumns.length >= 3) {
      if (tier1 === -1) tier1 = rateColumns[0];
      if (tier2 === -1) tier2 = rateColumns[1];
      if (tier3 === -1) tier3 = rateColumns[2];
      console.log(`  → 使用前3个费率列作为阶梯`);
    } else if (rateColumns.length === 1) {
      // 🔹 极端情况：只有一列费率，可能是通用费率
      console.log(`  → 只找到1个费率列，将所有阶梯设为相同值`);
      tier1 = rateColumns[0];
      tier2 = rateColumns[0];
      tier3 = rateColumns[0];
    }
  }
  
  console.log(`[佣金列识别] 最终结果: tier1=${tier1}, tier2=${tier2}, tier3=${tier3}`);
  return { tier1, tier2, tier3 };
}

/**
 * 智能寻找真实表头行（物流表 XLSX）
 * 查找包含 "配送方式"、"第三方物流" 或 "尺寸限制" 的行
 */
function findShippingHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    const joined = row.join(" ").toLowerCase();
    if (joined.includes("配送方式") && (joined.includes("尺寸限制") || joined.includes("重量限制"))) {
      console.log(`[物流解析] 找到真实表头行: 第 ${i + 1} 行`);
      return i;
    }
    if (joined.includes("deliveryvariant") && joined.includes("weight")) {
      console.log(`[物流解析] 找到英文表头行: 第 ${i + 1} 行`);
      return i;
    }
    // 俄文备选
    if (joined.includes("метод") && joined.includes("размер")) {
      console.log(`[物流解析] 找到俄文表头行: 第 ${i + 1} 行`);
      return i;
    }
  }
  return -1;
}

/**
 * 增强版费率字符串解析函数
 * 支持多种格式、货币符号、特殊字符过滤
 * 
 * 格式示例:
 *   - "¥3.12 + ¥0.0468/1 g"
 *   - "$0.38 + $0.00522/1 g"
 *   - "¥2,75 + ¥0,0385/1 г"
 *   - "3.12 RMB + 0.0468 RMB/g"
 *   - "固定费: 3.12元，变动费: 0.0468元/克"
 * 
 * 返回 { fixFee: RMB, varFeePerGram: RMB/g }
 */
function parseShippingRateString(rateStr: string): { fixFee: number; varFeePerGram: number } {
  if (!rateStr || rateStr.trim() === "-" || rateStr.trim() === "") {
    return { fixFee: 0, varFeePerGram: 0 };
  }

  const result = { fixFee: 0, varFeePerGram: 0 };

  try {
    // 步骤1: 预处理 - 统一格式
    let cleaned = rateStr
      .replace(/,/g, ".")                                    // 逗号转点号
      .replace(/[¥￥$€₽]/gi, "")                             // 移除所有货币符号
      .replace(/rmb|cny|rub|rubles?|元|卢布/gi, "")           // 移除货币单位
      .replace(/人民币|固定费|变动费|价格|费用|成本/gi, "")      // 移除中文注释
      .replace(/\s+/g, " ")                                  // 合并多余空格
      .trim();

    // 步骤2: 提取变动费部分（优先匹配）
    // 匹配格式: "0.0468/1 g" 或 "0.0468/1g" 或 "0.0468/g" 或 "0.0468每克"
    const varPatterns = [
      /(\d+\.?\d*)\s*\/\s*1\s*[gгкkg]/i,                     // 0.0468/1g
      /(\d+\.?\d*)\s*\/\s*[gгкkg]/i,                         // 0.0468/g
      /(\d+\.?\d*)\s*(?:每|per)\s*[gгкkg]/i,                 // 0.0468每克
      /(\d+\.?\d*)\s*r?\s*b?\s*b?\s*\/\s*g/i,                // 0.0468 RMB/g
    ];

    for (const pattern of varPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        result.varFeePerGram = parseFloat(match[1]);
        // 从字符串中移除已匹配的变动费部分，避免重复匹配
        cleaned = cleaned.replace(pattern, "");
        break;
      }
    }

    // 步骤3: 提取固定费部分
    // 在剩余字符串中查找数字
    const fixedMatch = cleaned.match(/(\d+\.?\d*)/);
    if (fixedMatch) {
      result.fixFee = parseFloat(fixedMatch[1]);
    }

    // 步骤4: 兜底 - 如果仍然没找到，尝试原字符串提取数字
    if (result.fixFee === 0 && result.varFeePerGram === 0) {
      const numbers = rateStr.match(/\d+\.?\d*/g);
      if (numbers && numbers.length >= 1) {
        result.fixFee = parseFloat(numbers[0]);
        if (numbers.length >= 2) {
          // 假设第二个数字是变动费
          result.varFeePerGram = parseFloat(numbers[1]);
        }
      }
    }

    // 步骤5: 验证和警告
    if (result.fixFee === 0 && result.varFeePerGram === 0 && rateStr.trim() !== "0" && rateStr.trim() !== "-") {
      console.warn(`[费率解析警告] 无法解析费率字符串: "${rateStr}"`);
    } else {
      console.log(`[费率解析] 成功: "${rateStr}" → 固定费=${result.fixFee}, 变动费=${result.varFeePerGram}/g`);
    }
  } catch (error) {
    console.warn(`[费率解析错误] 解析异常: "${rateStr}"`, error);
  }

  return result;
}

/**
 * 解析尺寸限制字符串
 * 格式示例: "边长总和 ≤ 90 cm, 长边 ≤ 60 cm"
 * 返回 { maxSum, maxLength }
 */
function parseDimensionString(dimStr: string): { maxSum: number; maxLength: number } {
  const result = { maxSum: 999, maxLength: 999 };

  if (!dimStr || dimStr.trim() === "") return result;

  // 🔹 中文：边长总和限制
  const sumPatterns = [
    /边长总和\s*[≤<=]\s*(\d+)/,
    /尺寸总和\s*[≤<=]\s*(\d+)/,
    /三边总和\s*[≤<=]\s*(\d+)/,
    /总尺寸\s*[≤<=]\s*(\d+)/,
    /总和\s*[≤<=]\s*(\d+)/,
  ];
  
  for (const pattern of sumPatterns) {
    const match = dimStr.match(pattern);
    if (match) {
      result.maxSum = parseInt(match[1]);
      break;
    }
  }

  // 🔹 中文：长边限制
  const lengthPatterns = [
    /长边\s*[≤<=]\s*(\d+)/,
    /最长边\s*[≤<=]\s*(\d+)/,
    /最大边\s*[≤<=]\s*(\d+)/,
    /长度\s*[≤<=]\s*(\d+)/,
  ];
  
  for (const pattern of lengthPatterns) {
    const match = dimStr.match(pattern);
    if (match) {
      result.maxLength = parseInt(match[1]);
      break;
    }
  }

  // 🔹 英文备选
  const sumMatchEn = dimStr.match(/sum\s*[≤<=]\s*(\d+)/i);
  if (sumMatchEn) {
    result.maxSum = parseInt(sumMatchEn[1]);
  }

  const lengthMatchEn = dimStr.match(/(?:max\s*)?length\s*[≤<=]\s*(\d+)/i);
  if (lengthMatchEn) {
    result.maxLength = parseInt(lengthMatchEn[1]);
  }
  
  // 🔹 俄文备选
  const sumMatchRu = dimStr.match(/сумма\s*[≤<=]\s*(\d+)/i);
  if (sumMatchRu) {
    result.maxSum = parseInt(sumMatchRu[1]);
  }

  const lengthMatchRu = dimStr.match(/длин[аы]?\s*[≤<=]\s*(\d+)/i);
  if (lengthMatchRu) {
    result.maxLength = parseInt(lengthMatchRu[1]);
  }

  // 🔹 打印解析结果
  if (result.maxSum !== 999 || result.maxLength !== 999) {
    console.log(`📏 尺寸解析: "${dimStr}" → 总和限${result.maxSum}cm / 长边限${result.maxLength}cm`);
  }

  return result;
}

/**
 * 解析货值限制字符串
 * 格式示例: "1 - 1500" 或 "0.01 - 135"
 * 返回 { min, max }
 */
function parseValueRange(valStr: string): { min: number; max: number } {
  if (!valStr || valStr.trim() === "" || valStr.trim() === "-") {
    return { min: 0, max: 999999 };
  }

  const match = valStr.match(/([\d.]+)\s*[-–—]\s*([\d.]+)/);
  if (match) {
    return { min: parseFloat(match[1]), max: parseFloat(match[2]) };
  }

  const singleNum = valStr.match(/([\d.]+)/);
  if (singleNum) {
    return { min: 0, max: parseFloat(singleNum[1]) };
  }

  return { min: 0, max: 999999 };
}

/**
 * 生成物流渠道唯一标识符
 * 格式: [配送方式名称]_[服务等级]
 * 用于数据覆盖和去重
 */
function generateShippingUniqueId(name: string, serviceLevel: string): string {
  const normalizedName = (name || "").trim().toLowerCase().replace(/\s+/g, "-");
  const normalizedLevel = (serviceLevel || "").trim().toLowerCase().replace(/\s+/g, "-");
  return `${normalizedName}_${normalizedLevel}`;
}

/**
 * 解析时效限制字符串
 * 格式示例: "5-14" 或 "3-8"
 * 返回 { min, max }
 */
function parseDeliveryTime(timeStr: string): { min: number; max: number } {
  if (!timeStr || timeStr.trim() === "") {
    return { min: 20, max: 40 };
  }

  const match = timeStr.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (match) {
    return { min: parseInt(match[1]), max: parseInt(match[2]) };
  }

  const singleNum = timeStr.match(/(\d+)/);
  if (singleNum) {
    return { min: parseInt(singleNum[1]), max: parseInt(singleNum[1]) };
  }

  return { min: 20, max: 40 };
}





// ========================================================
// Provider
// ========================================================
export function DataHubProvider({ children }: { children: React.ReactNode }) {
  const [commissionData, setCommissionData] = useState<CategoryCommission[]>(DEFAULT_COMMISSION_DATA);
  const [shippingData, setShippingData] = useState<ShippingChannel[]>(DEFAULT_SHIPPING_DATA);
  const [commissionLoaded, setCommissionLoaded] = useState(true);
  const [shippingLoaded, setShippingLoaded] = useState(true);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    commission: {},
    shipping: {},
  });

  // 从 localStorage 恢复数据
  useEffect(() => {
    try {
      // 🔹 数据版本控制：清除旧版本数据
      const DATA_VERSION = "v2.2"; // 强制清除旧数据，修复阶梯匹配问题
      const savedVersion = localStorage.getItem("ozon_data_version");
      
      // 🔹 先读取所有数据，避免作用域问题
      const savedCommission = localStorage.getItem("ozon_commission_data");
      const savedShipping = localStorage.getItem("ozon_shipping_data");
      const savedMapping = localStorage.getItem("ozon_column_mapping");
      
      if (savedVersion !== DATA_VERSION) {
        console.log(`[数据中心] 检测到数据版本更新 (${savedVersion} → ${DATA_VERSION})，清除旧数据...`);
        localStorage.removeItem("ozon_commission_data");
        localStorage.removeItem("ozon_shipping_data");
        localStorage.removeItem("ozon_column_mapping");
        localStorage.setItem("ozon_data_version", DATA_VERSION);
        console.log(`[数据中心] 旧数据已清除，请重新上传佣金表`);
        // 🔹 设置标志，提示用户重新上传
        console.log(`\n⚠️ ================================`);
        console.log(`⚠️ 重要：请重新上传佣金表CSV文件！`);
        console.log(`⚠️ ================================\n`);
      } else {
        if (savedCommission) {
          const parsed = JSON.parse(savedCommission);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCommissionData(parsed);
            setCommissionLoaded(true);
            console.log(`[数据中心] 从 localStorage 恢复 ${parsed.length} 条佣金数据`);
            
            // 🔹 显示第一条数据的阶梯结构
            if (parsed.length > 0) {
              const firstItem = parsed[0];
              console.log(`[数据中心] 示例佣金数据: ${firstItem.primaryCategory} > ${firstItem.secondaryCategory}`);
              firstItem.tiers.forEach((tier: any, i: number) => {
                console.log(`  阶梯${i+1}: ${tier.min}-${tier.max === Infinity ? '∞' : tier.max} RUB → ${tier.rate}%`);
              });
            }
          }
        }
        
        if (savedShipping) {
          const parsed = JSON.parse(savedShipping);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // 检查并修复重复ID
            const idSet = new Set<string>();
            const hasDuplicates = parsed.some((item: ShippingChannel) => {
              if (idSet.has(item.id)) return true;
              idSet.add(item.id);
              return false;
            });
            
            if (hasDuplicates) {
              console.warn("[数据中心] 检测到重复ID，自动清理旧数据...");
              localStorage.removeItem("ozon_shipping_data");
              setShippingData(DEFAULT_SHIPPING_DATA);
              console.log("[数据中心] 已恢复默认物流数据");
            } else {
              setShippingData(parsed);
              console.log(`[数据中心] 从 localStorage 恢复 ${parsed.length} 条物流数据`);
            }
          }
        }
        
        if (savedMapping) {
          const parsed = JSON.parse(savedMapping);
          if (parsed.commission && parsed.shipping) {
            setColumnMapping(parsed);
            console.log(`[数据中心] 从 localStorage 恢复列映射配置`);
          }
        }
      }
    } catch (e) {
      console.error("[数据中心] localStorage 恢复失败:", e);
    }
  }, []);

  /**
   * 加载佣金数据（CSV 或 XLSX）
   * 核心改进：智能寻找真实表头行
   */
  const loadCommissionData = useCallback(async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const ext = file.name.split(".").pop()?.toLowerCase();

      const parseRows = (rawRows: string[][]) => {
        // 智能寻找真实表头行
        const headerIdx = findCommissionHeaderRow(rawRows);
        if (headerIdx === -1) {
          throw new Error("无法找到佣金表的真实表头行（需要包含「一级类目」和「二级类目」）");
        }

        console.log(`[佣金解析] 找到真实表头行: 第 ${headerIdx + 1} 行`);
        const headers = rawRows[headerIdx];
        const dataRows = rawRows.slice(headerIdx + 1);

        // 寻找类目列
        const primaryIdx = headers.findIndex(h => h.includes("一级类目"));
        const secondaryIdx = headers.findIndex(h => h.includes("二级类目"));

        if (primaryIdx === -1 || secondaryIdx === -1) {
          throw new Error("佣金表缺少必要的类目列");
        }

        // 寻找费率列
        const { tier1, tier2, tier3 } = findCommissionTierColumns(headers);
        console.log(`[佣金解析] 费率列索引: tier1=${tier1}, tier2=${tier2}, tier3=${tier3}`);

        const parsed: CategoryCommission[] = [];
        for (const row of dataRows) {
          const primary = row[primaryIdx]?.trim();
          const secondary = row[secondaryIdx]?.trim();
          if (!primary || !secondary) continue;

          // 🔹 解析三个阶梯的费率
          const rate1 = tier1 >= 0 ? parsePercentString(row[tier1] || "0") : 12;
          const rate2 = tier2 >= 0 ? parsePercentString(row[tier2] || "0") : 15;
          const rate3 = tier3 >= 0 ? parsePercentString(row[tier3] || "0") : 18;
          
          const commissionItem: CategoryCommission = {
            primaryCategory: primary,
            secondaryCategory: secondary,
            tiers: [
              { min: 0, max: 1500, rate: rate1 },
              { min: 1500.01, max: 5000, rate: rate2 },
              { min: 5000.01, max: Infinity, rate: rate3 },
            ],
          };
          
          console.log(`[佣金解析] ${primary} > ${secondary}: [${rate1}%, ${rate2}%, ${rate3}%]`);
          console.log(`  原始数据: tier1="${row[tier1]}", tier2="${row[tier2]}", tier3="${row[tier3]}"`);
          
          parsed.push(commissionItem);
        }

        return parsed;
      };

      if (ext === "csv") {
        Papa.parse(file, {
          header: false,   // 不自动使用第一行作为 header
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const rawRows = results.data as string[][];
              const parsed = parseRows(rawRows);
              console.log(`[佣金解析] 成功解析 ${parsed.length} 条佣金数据`);
              setCommissionData(parsed);
              setCommissionLoaded(true);
              localStorage.setItem("ozon_commission_data", JSON.stringify(parsed));
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          error: (error) => reject(error),
        });
      } else if (ext === "xlsx" || ext === "xls") {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawRows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "", raw: false });
            const parsed = parseRows(rawRows);
            console.log(`[佣金解析] 成功解析 ${parsed.length} 条佣金数据`);
            setCommissionData(parsed);
            setCommissionLoaded(true);
            localStorage.setItem("ozon_commission_data", JSON.stringify(parsed));
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error("不支持的文件格式，请上传 .csv 或 .xlsx 文件"));
      }
    });
  }, []);

  /**
   * 加载物流数据（XLSX 或 CSV）
   * 核心改进：智能寻找真实表头行，解析 Ozon 真实费率格式
   * 
   * @param file 上传的文件
   * @param mode 加载模式：overwrite（覆盖，默认）或 merge（并存更新）
   */
  const loadShippingData = useCallback(async (file: File, mode: "overwrite" | "merge" = "overwrite") => {
    return new Promise<void>((resolve, reject) => {
      const ext = file.name.split(".").pop()?.toLowerCase();

      const parseShippingRows = (rawRows: string[][], sheetName?: string): ShippingChannel[] => {
        // 智能寻找真实表头行
        const headerIdx = findShippingHeaderRow(rawRows);

        if (headerIdx === -1) {
          // 如果找不到标准表头，尝试用第一个有内容的行
          console.warn("[物流解析] 未找到标准表头，尝试使用第一行作为表头");
          // 尝试使用 Список без неинтегр. 3PL sheet 的格式
          return parseAlternativeShippingFormat(rawRows);
        }

        const headers = rawRows[headerIdx];
        const dataRows = rawRows.slice(headerIdx + 1);
        console.log(`[物流解析] 表头: ${JSON.stringify(headers)}`);

        // 列映射
        const colMap: Record<string, number> = {};
        headers.forEach((h, i) => {
          const hl = h.toLowerCase().trim();
          if (hl.includes("评分组") || hl.includes("scoring")) colMap.tier = i;
          if (hl.includes("服务等级") || hl.includes("service") && hl.includes("level")) colMap.serviceLevel = i;
          if (hl.includes("第三方物流") || hl.includes("3pl") || hl.includes("треть")) colMap.thirdParty = i;
          if (hl.includes("配送方式") || hl.includes("deliveryvariant") || hl.includes("метод")) colMap.name = i;
          if (hl.includes("评级") || hl.includes("rating") || hl.includes("рейтинг")) colMap.rating = i;
          if (hl.includes("时效") || hl.includes("срок")) colMap.deliveryTime = i;
          if (hl.includes("费率") || hl.includes("ставк") || hl.includes("rate")) colMap.rate = i;
          if (hl.includes("电池") || hl.includes("battery") || hl.includes("батар")) colMap.battery = i;
          if (hl.includes("液体") || hl.includes("liquid")) colMap.liquid = i;
          if (hl.includes("尺寸限制") || hl.includes("размер")) colMap.dimension = i;
          if (hl.includes("重量限制") && hl.includes("最小") || hl.includes("min") && hl.includes("weight")) colMap.minWeight = i;
          if (hl.includes("重量限制") && hl.includes("最大") || hl.includes("max") && hl.includes("weight")) colMap.maxWeight = i;
          if (hl.includes("货值限制") && hl.includes("卢布") || hl.includes("rub")) colMap.valueRUB = i;
          if (hl.includes("货值限制") && hl.includes("人民币") || hl.includes("rmb") || hl.includes("cny")) colMap.valueRMB = i;
          if (hl.includes("计费类型") || hl.includes("billing")) colMap.billingType = i;
          if (hl.includes("体积重量") || hl.includes("volumetric")) colMap.volumetricDivisor = i;
        });

        console.log(`[物流解析] 列映射: ${JSON.stringify(colMap)}`);

        const parsed: ShippingChannel[] = [];
        const idCounter = new Map<string, number>(); // 跟踪ID出现次数
        let idx = 0;

        for (const row of dataRows) {
          try {
            const name = colMap.name >= 0 ? row[colMap.name]?.trim() : "";
            if (!name || name === "" || name === "-") continue;

            const serviceLevel = colMap.serviceLevel >= 0 ? row[colMap.serviceLevel]?.trim() || "" : "";
            let uniqueId = generateShippingUniqueId(name, serviceLevel);
            
            // 处理重复ID：添加序号后缀
            const count = idCounter.get(uniqueId) || 0;
            if (count > 0) {
              uniqueId = `${uniqueId}_${count + 1}`;
            }
            idCounter.set(generateShippingUniqueId(name, serviceLevel), count + 1);

            const rateStr = colMap.rate >= 0 ? row[colMap.rate] || "" : "";
            const { fixFee, varFeePerGram } = parseShippingRateString(rateStr);

            const dimStr = colMap.dimension >= 0 ? row[colMap.dimension] || "" : "";
            const { maxSum, maxLength: maxLen } = parseDimensionString(dimStr);

            const timeStr = colMap.deliveryTime >= 0 ? row[colMap.deliveryTime] || "" : "";
            const { min: dmin, max: dmax } = parseDeliveryTime(timeStr);

            const valRUBStr = colMap.valueRUB >= 0 ? row[colMap.valueRUB] || "" : "";
            const valRMBStr = colMap.valueRMB >= 0 ? row[colMap.valueRMB] || "" : "";
            const valRUB = parseValueRange(valRUBStr);
            const valRMB = parseValueRange(valRMBStr);

            const minW = colMap.minWeight >= 0 ? parseFloat(row[colMap.minWeight]) || 0 : 0;
            const maxW = colMap.maxWeight >= 0 ? parseFloat(row[colMap.maxWeight]) || 999999 : 999999;

            const batteryAllowed = colMap.battery >= 0 ? row[colMap.battery]?.includes("允许") || row[colMap.battery]?.toLowerCase().includes("allow") || row[colMap.battery]?.includes("Разрешено") : false;
            const liquidAllowed = colMap.liquid >= 0 ? row[colMap.liquid]?.includes("允许") || row[colMap.liquid]?.toLowerCase().includes("allow") || row[colMap.liquid]?.includes("Разрешено") : false;

            const billingType = colMap.billingType >= 0 ? row[colMap.billingType]?.trim() || "实际重量" : "实际重量";

            idx++;
            parsed.push({
              id: uniqueId, // 使用唯一标识符
              name,
              thirdParty: colMap.thirdParty >= 0 ? row[colMap.thirdParty]?.trim() || "" : "",
              serviceTier: colMap.tier >= 0 ? row[colMap.tier]?.trim() || "" : "",
              serviceLevel,
              fixFee,
              varFeePerGram,
              pricePerKg: fixFee + varFeePerGram * 1000,
              pricePerCubic: 0,
              minWeight: minW,
              maxWeight: maxW,
              maxLength: maxLen,
              maxWidth: maxLen,  // 默认和 maxLength 相同
              maxHeight: maxLen,
              maxSumDimension: maxSum,
              deliveryTimeMin: dmin,
              deliveryTimeMax: dmax,
              deliveryTime: Math.round((dmin + dmax) / 2),
              maxValueRUB: valRUB.max,
              maxValue: valRMB.max,
              billingType,
              volumetricDivisor: 0,
              ozonRating: colMap.rating >= 0 ? parseFloat(row[colMap.rating]) || 0 : 0,
              batteryAllowed,
              liquidAllowed,
            });
          } catch (error) {
            console.warn(`[物流解析警告] 第 ${idx + 1} 行解析失败:`, row, error);
          }
        }

        return parsed;
      };

      /**
       * 备选解析格式：Список без неинтегр. 3PL sheet
       * Header: Лого, Метод, Рейтинг Ozon, Сроки доставки, ПВЗ, Курьер, Батарейки, ..., Fix, Var, Валюта, Мин. Срок, Макс. срок
       */
      const parseAlternativeShippingFormat = (rawRows: string[][]): ShippingChannel[] => {
        const parsed: ShippingChannel[] = [];
        const idCounter = new Map<string, number>(); // 跟踪ID出现次数
        let idx = 0;

        for (let i = 0; i < rawRows.length; i++) {
          try {
            const row = rawRows[i];
            if (row.length < 10) continue;

            const name = row[1]?.trim(); // Метод
            if (!name || name === "") continue;

            const rating = parseFloat(row[2]) || 0;
            const timeStr = row[3] || "";
            const { min: dmin, max: dmax } = parseDeliveryTime(timeStr);
            const pvzPrice = row[4] || ""; // ПВЗ 价格

            // 从 ПВЗ 价格解析费率
            const { fixFee, varFeePerGram } = parseShippingRateString(pvzPrice);

            // Fix 和 Var 列
            const fixCol = row.find((_, ci) => rawRows[0]?.[ci]?.trim() === "Fix");
            const varCol = row.find((_, ci) => rawRows[0]?.[ci]?.trim() === "Var");
            const currency = row.find((_, ci) => rawRows[0]?.[ci]?.trim() === "Валюта");

            const serviceLevel = ""; // 备选格式没有服务等级
            let uniqueId = generateShippingUniqueId(name, serviceLevel);
            
            // 处理重复ID：添加序号后缀
            const count = idCounter.get(uniqueId) || 0;
            if (count > 0) {
              uniqueId = `${uniqueId}_${count + 1}`;
            }
            idCounter.set(generateShippingUniqueId(name, serviceLevel), count + 1);

            idx++;
            parsed.push({
              id: uniqueId,
              name,
              thirdParty: name.split(" ")[0] || "",
              serviceTier: "",
              serviceLevel,
              fixFee,
              varFeePerGram,
              pricePerKg: fixFee + varFeePerGram * 1000,
              pricePerCubic: 0,
              minWeight: 0,
              maxWeight: 999999,
              maxLength: 999,
              maxWidth: 999,
              maxHeight: 999,
              maxSumDimension: 9999,
              deliveryTimeMin: dmin,
              deliveryTimeMax: dmax,
              deliveryTime: Math.round((dmin + dmax) / 2),
              maxValueRUB: 999999,
              maxValue: 999999,
              billingType: "实际重量",
              volumetricDivisor: 0,
              ozonRating: rating,
              batteryAllowed: row[6]?.includes("Разрешено") || false,
              liquidAllowed: false,
            });
          } catch (error) {
            console.warn(`[物流解析警告-备选格式] 第 ${i + 1} 行解析失败:`, rawRows[i], error);
          }
        }

        return parsed;
      };

      if (ext === "xlsx" || ext === "xls") {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });

            // 优先寻找 "中国 rFBS" sheet
            let sheetName = workbook.SheetNames.find(n => n.includes("rFBS") || n.includes("中国"));
            if (!sheetName) {
              sheetName = workbook.SheetNames.find(n => n.includes("Список") || n.includes("3PL"));
            }
            if (!sheetName) {
              sheetName = workbook.SheetNames[0];
            }
            console.log(`[物流解析] 使用 Sheet: ${sheetName}`);

            const worksheet = workbook.Sheets[sheetName];
            const rawRows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "", raw: false });

            const parsed = parseShippingRows(rawRows, sheetName);
            console.log(`[物流解析] 成功解析 ${parsed.length} 条物流渠道数据`);

            // 根据 mode 处理数据
            let finalData: ShippingChannel[];
            if (mode === "overwrite") {
              finalData = parsed;
              console.log(`[物流解析] 覆盖模式：清空旧数据，保留新数据 ${parsed.length} 条`);
            } else {
              // merge 模式：根据 uniqueId 合并
              const existingMap = new Map(shippingData.map(ch => [ch.id, ch]));
              parsed.forEach(ch => {
                existingMap.set(ch.id, ch); // 覆盖或新增
              });
              finalData = Array.from(existingMap.values());
              console.log(`[物流解析] 并存模式：合并后共 ${finalData.length} 条`);
            }

            setShippingData(finalData);
            setShippingLoaded(true);
            localStorage.setItem("ozon_shipping_data", JSON.stringify(finalData));
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsArrayBuffer(file);
      } else if (ext === "csv") {
        Papa.parse(file, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const rawRows = results.data as string[][];
              const parsed = parseShippingRows(rawRows);
              console.log(`[物流解析] 成功解析 ${parsed.length} 条物流渠道数据`);

              // 根据 mode 处理数据
              let finalData: ShippingChannel[];
              if (mode === "overwrite") {
                finalData = parsed;
                console.log(`[物流解析] 覆盖模式：清空旧数据，保留新数据 ${parsed.length} 条`);
              } else {
                // merge 模式：根据 uniqueId 合并
                const existingMap = new Map(shippingData.map(ch => [ch.id, ch]));
                parsed.forEach(ch => {
                  existingMap.set(ch.id, ch); // 覆盖或新增
                });
                finalData = Array.from(existingMap.values());
                console.log(`[物流解析] 并存模式：合并后共 ${finalData.length} 条`);
              }

              setShippingData(finalData);
              setShippingLoaded(true);
              localStorage.setItem("ozon_shipping_data", JSON.stringify(finalData));
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          error: (error) => reject(error),
        });
      } else {
        reject(new Error("不支持的文件格式，请上传 .csv 或 .xlsx 文件"));
      }
    });
  }, [shippingData]);

  /**
   * 清除佣金数据
   */
  const clearCommissionData = useCallback(() => {
    setCommissionData([]);
    setCommissionLoaded(false);
    localStorage.removeItem("ozon_commission_data");
    localStorage.removeItem("ozon_commission_mappings"); // 🔹 清除映射历史
    console.log("[数据中心] 佣金数据和映射历史已清除");
  }, []);

  /**
   * 清除物流数据
   */
  const clearShippingData = useCallback(() => {
    setShippingData([]);
    setShippingLoaded(false);
    localStorage.removeItem("ozon_shipping_data");
    localStorage.removeItem("ozon_shipping_mappings"); // 🔹 清除映射历史
    console.log("[数据中心] 物流数据和映射历史已清除");
  }, []);

  /**
   * 更新列映射配置
   */
  const updateColumnMapping = useCallback((type: "commission" | "shipping", mapping: Record<string, number>) => {
    setColumnMapping((prev) => {
      const newMapping = { ...prev, [type]: mapping };
      localStorage.setItem("ozon_column_mapping", JSON.stringify(newMapping));
      console.log(`[数据中心] ${type === "commission" ? "佣金表" : "物流表"}列映射已更新`);
      return newMapping;
    });
  }, []);

  const getCategories = useCallback(() => {
    const map = new Map<string, string[]>();
    commissionData.forEach((item) => {
      if (!map.has(item.primaryCategory)) {
        map.set(item.primaryCategory, []);
      }
      map.get(item.primaryCategory)!.push(item.secondaryCategory);
    });
    return Array.from(map.entries()).map(([primary, secondary]) => ({ primary, secondary }));
  }, [commissionData]);

  const getCommissionByCategory = useCallback(
    (primary: string, secondary: string) => {
      return commissionData.find(
        (item) => item.primaryCategory === primary && item.secondaryCategory === secondary
      );
    },
    [commissionData]
  );

  const getShippingChannels = useCallback(
    (
      length: number,
      width: number,
      height: number,
      weight: number,
      priceRUB: number,
      exchangeRate: number,
      hasBattery: boolean = false, // 🔹 是否带电
      hasLiquid: boolean = false, // 🔹 是否带液体
      designatedProvider: string = "" // 🔹 指定物流商过滤
    ) => {
      const priceRMB = priceRUB * exchangeRate;
      const sumDim = length + width + height;
      const maxSide = Math.max(length, width, height);
      const available: ShippingChannel[] = [];
      const unavailable: (ShippingChannel & { reason: string })[] = [];

      shippingData.forEach((channel) => {
        const reasons: string[] = [];
        
        // 🔹 预过滤：指定物流商
        if (designatedProvider && channel.thirdParty !== designatedProvider) {
          unavailable.push({ ...channel, reason: `指定物流商过滤: 仅显示 ${designatedProvider}` });
          return;
        }
        
        // 🔹 属性硬拦截：电池
        if (hasBattery && !channel.batteryAllowed) {
          reasons.push("❌ 该渠道禁止带电商品");
        }
        
        // 🔹 属性硬拦截：液体
        if (hasLiquid && !channel.liquidAllowed) {
          reasons.push("❌ 该渠道禁止带液体商品");
        }
        
        // 🔹 物理参数拦截：重量
        if (weight > channel.maxWeight) {
          reasons.push(`超重: ${weight}g > ${channel.maxWeight}g`);
        }
        if (weight < channel.minWeight) {
          reasons.push(`不足最小重量: ${weight}g < ${channel.minWeight}g`);
        }
        
        // 🔹 物理参数拦截：尺寸
        if (maxSide > channel.maxLength) {
          reasons.push(`超长边: ${maxSide}cm > ${channel.maxLength}cm`);
        }
        if (sumDim > channel.maxSumDimension) {
          reasons.push(`超边长总和: ${sumDim}cm > ${channel.maxSumDimension}cm`);
        }
        
        // 🔹 物理参数拦截：货值
        if (priceRMB > channel.maxValue) {
          reasons.push(`超货值: ¥${priceRMB.toFixed(0)} > ¥${channel.maxValue}`);
        }

        if (reasons.length > 0) {
          unavailable.push({ ...channel, reason: reasons.join("; ") });
        } else {
          available.push(channel);
        }
      });

      // 按运费升序排列（使用体积重计算）
      // 注意：当传入 length/width/height/actualWeight 时，calculateShippingCost 会自动计算计费重
      // 此时第二个参数 chargeableWeight 会被忽略
      available.sort((a, b) => {
        const costA = calculateShippingCost(a, 0, length, width, height, weight);
        const costB = calculateShippingCost(b, 0, length, width, height, weight);
        return costA - costB;
      });

      return { available, unavailable };
    },
    [shippingData]
  );

  return (
    <DataHubContext.Provider
      value={{
        commissionData,
        shippingData,
        commissionLoaded,
        shippingLoaded,
        columnMapping,
        loadCommissionData,
        loadShippingData,
        clearCommissionData,
        clearShippingData,
        updateColumnMapping,
        getCategories,
        getCommissionByCategory,
        getShippingChannels,
      }}
    >
      {children}
    </DataHubContext.Provider>
  );
}

export function useDataHub() {
  const context = useContext(DataHubContext);
  if (!context) {
    throw new Error("useDataHub must be used within a DataHubProvider");
  }
  return context;
}

/**
 * 计算体积重 (g)
 * 公式: L × W × H / divisor × 1000
 * @param length 长度 (cm)
 * @param width 宽度 (cm)
 * @param height 高度 (cm)
 * @param divisor 除数（默认12000）
 */
function calculateChannelVolumetricWeight(
  length: number,
  width: number,
  height: number,
  divisor: number = 12000
): number {
  return ((length * width * height) / divisor) * 1000;
}

/**
 * 解析物流渠道的体积重除数
 * 从 volumetricDivisor 字段获取，或从 billingType 解析除数
 */
function parseVolumetricDivisor(channel: ShippingChannel): number {
  // 如果 channel 有 volumetricDivisor 字段，直接使用
  if (channel.volumetricDivisor && channel.volumetricDivisor > 0) {
    return channel.volumetricDivisor;
  }
  
  // 否则尝试从 billingType 解析除数
  const billingType = channel.billingType || "";
  
  // 常见除数模式匹配
  const divisorPatterns = [
    /\/(\d+)/,           // /12000, /6000, /5000
    /(\d{4,5})/,        // 12000, 6000, 5000
  ];
  
  for (const pattern of divisorPatterns) {
    const match = billingType.match(pattern);
    if (match) {
      const divisor = parseInt(match[1]);
      if (divisor >= 1000 && divisor <= 20000) {
        return divisor;
      }
    }
  }
  
  // 默认值
  return 12000;
}

/**
 * 解析计费类型并计算计费重量
 * 
 * @returns 包含以下信息:
 * - billingWeight: 计费重量 (g)
 * - actualWeight: 实际重量 (g)
 * - volumetricWeight: 体积重 (g)
 * - isVolumetric: 是否按体积重计费
 * - divisor: 体积重除数
 * - billingType: 计费类型描述
 */
export function parseBillingWeight(
  channel: ShippingChannel,
  length: number,
  width: number,
  height: number,
  actualWeight: number
): {
  billingWeight: number;
  actualWeight: number;
  volumetricWeight: number;
  isVolumetric: boolean;
  divisor: number;
  billingType: string;
} {
  const billingTypeRaw = channel.billingType || "实际重量";
  const divisor = parseVolumetricDivisor(channel);
  
  // 计算体积重
  const volumetricWeight = calculateChannelVolumetricWeight(length, width, height, divisor);
  
  // 根据计费类型确定计费重量
  // 优先级: 最大/取大 > 体积 > 实际
  let billingWeight: number;
  let isVolumetric: boolean;
  let billingTypeDesc: string;
  
  const normalizedBillingType = billingTypeRaw.toLowerCase();
  
  if (
    normalizedBillingType.includes("最大") || 
    normalizedBillingType.includes("取大") ||
    normalizedBillingType.includes("max")
  ) {
    // 最大/取大: 取实重和体积重的最大值
    billingWeight = Math.max(actualWeight, volumetricWeight);
    isVolumetric = volumetricWeight > actualWeight;
    billingTypeDesc = "取大";
  } else if (
    normalizedBillingType.includes("体积") && 
    !normalizedBillingType.includes("实际") &&
    !normalizedBillingType.includes("实际")
  ) {
    // 纯体积: 只按体积重计费
    billingWeight = volumetricWeight;
    isVolumetric = true;
    billingTypeDesc = "体积重";
  } else if (
    normalizedBillingType.includes("实际") &&
    !normalizedBillingType.includes("最大") &&
    !normalizedBillingType.includes("取大")
  ) {
    // 纯实际: 只按实际重量计费
    billingWeight = actualWeight;
    isVolumetric = false;
    billingTypeDesc = "实际重";
  } else {
    // 默认行为: 取大
    billingWeight = Math.max(actualWeight, volumetricWeight);
    isVolumetric = volumetricWeight > actualWeight;
    billingTypeDesc = "取大";
  }
  
  return {
    billingWeight,
    actualWeight,
    volumetricWeight,
    isVolumetric,
    divisor,
    billingType: billingTypeDesc,
  };
}

/**
 * 获取计费模式描述
 */
export function getBillingModeDescription(channel: ShippingChannel): string {
  const billingTypeRaw = channel.billingType || "实际重量";
  const normalizedBillingType = billingTypeRaw.toLowerCase();
  
  if (normalizedBillingType.includes("最大") || normalizedBillingType.includes("取大")) {
    return "取大";
  } else if (normalizedBillingType.includes("体积") && !normalizedBillingType.includes("实际")) {
    return "体积重";
  } else if (normalizedBillingType.includes("实际")) {
    return "实际重";
  }
  
  return "取大";
}

/**
 * 计算物流费用（RMB）
 * 支持 Ozon 真实费率格式: fixFee + varFeePerGram × 计费重量(g)
 * 
 * @param channel 物流渠道
 * @param chargeableWeight 计费重量 (g) - 由调用方根据计费类型计算
 */
export function calculateShippingCost(
  channel: ShippingChannel, 
  chargeableWeight: number,
  length?: number,
  width?: number,
  height?: number,
  actualWeight?: number
): number {
  // 如果提供了尺寸和实际重量，说明调用方需要体积重计算
  if (length !== undefined && width !== undefined && height !== undefined && actualWeight !== undefined) {
    const { billingWeight } = parseBillingWeight(channel, length, width, height, actualWeight);
    return channel.fixFee + channel.varFeePerGram * billingWeight;
  }
  
  // 兼容旧调用方式：直接使用传入的重量作为计费重量
  return channel.fixFee + channel.varFeePerGram * chargeableWeight;
}
