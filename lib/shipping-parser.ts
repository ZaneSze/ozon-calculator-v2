// ========================================================
// 物流 CSV 解析 - 模糊字段映射字典
// Fuzzy Column Mapping for Shipping CSV Parsing
// ========================================================

/**
 * 字段别名映射表
 * 用于匹配各种中英文混杂的 CSV 表头
 */
export const SHIPPING_COLUMN_MAPPING: Record<string, string[]> = {
  // 基本标识
  id: ["ID", "物流方式ID", "配送方式ID", "渠道ID", "method id", "delivery method id"],
  name: ["配送方式", "物流名称", "名称", "方法", "method name", "name", "物流方式"],
  thirdParty: ["第三方物流", "3PL", "物流商", "carrier", "third party", "логист"],
  serviceTier: ["评分组", "服务组", "tier", "service tier", "service group", "группа"],
  serviceLevel: ["服务等级", "等级", "level", "service level", "тип"],
  
  // 价格相关
  fixFee: ["固定费", "首费", "起步价", "fix fee", "fixed fee", "基础费", "固定费用"],
  varFeePerGram: ["续重费", "每克费用", "单价", "variable fee", "per gram", "变动费"],
  rate: ["费率", "rate", "ставка"],
  
  // 尺寸限制
  maxLength: ["最大长度", "最长边", "length limit", "max length", "макс длина"],
  maxWidth: ["最大宽度", "width limit", "max width", "макс ширина"],
  maxHeight: ["最大高度", "height limit", "max height", "макс высота"],
  maxSumDimension: ["尺寸总和限制", "边长之和", "sum of dimensions", "max sum", "сумма размеров"],
  
  // 重量限制
  minWeight: ["最小重量", "最低重量", "min weight", "minimum", "мин вес"],
  maxWeight: ["最大重量", "最高重量", "max weight", "maximum", "макс вес"],
  maxVolWeight: ["最大体积重", "体积重限制", "volumetric limit", "макс объемный вес"],
  
  // 货值限制
  maxValueRUB: ["最大货值卢布", "最大金额卢布", "max amount rub", "max value rub"],
  maxValue: ["最大货值", "最大金额", "max amount", "max value", "макс сумма"],
  
  // 时效
  deliveryTimeMin: ["最短时效", "min days", "delivery time min"],
  deliveryTimeMax: ["最长时效", "max days", "delivery time max"],
  deliveryTime: ["平均时效", "时效", "delivery time", "срок"],
  
  // 计费类型
  billingType: ["计费类型", "计费方式", "billing type", "type", "тип оплаты"],
  volumetricDivisor: ["体积重除数", "除数", "divisor", "коэффициент"],
  
  // 特殊属性
  ozonRating: ["Ozon评级", "评分", "rating", "ozon rating", "рейтинг"],
  batteryAllowed: ["允许电池", "带电", "battery", "电池", "батарея"],
  liquidAllowed: ["允许液体", "带液", "liquid", "液体", "жидкость"],
  
  // 附加字段
  description: ["描述", "备注", "description", "备注信息"],
};

/**
 * 将表头行映射到标准字段名
 * @param headers 表头数组
 * @returns 字段名到列索引的映射
 */
export function mapHeadersToFields(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.trim().toLowerCase();
    
    // 遍历所有标准字段，查找匹配
    for (const [fieldName, aliases] of Object.entries(SHIPPING_COLUMN_MAPPING)) {
      const matched = aliases.some(alias => 
        normalizedHeader.includes(alias.toLowerCase()) ||
        alias.toLowerCase().includes(normalizedHeader)
      );
      
      if (matched && !mapping[fieldName]) {
        mapping[fieldName] = index;
        break;
      }
    }
  });
  
  return mapping;
}

/**
 * 从映射的行数据创建 ShippingChannel 对象
 * @param row 原始行数据
 * @param fieldMapping 字段映射
 * @returns ShippingChannel 对象
 */
export function createShippingChannel(
  row: string[], 
  fieldMapping: Record<string, number>
): Partial<ImportShippingChannel> {
  const getValue = (field: string): string => {
    const idx = fieldMapping[field];
    return idx !== undefined ? row[idx]?.trim() || "" : "";
  };
  
  const getNumber = (field: string, defaultValue: number = 0): number => {
    const val = getValue(field);
    const num = parseFloat(val.replace(/[^\d.-]/g, ""));
    return isNaN(num) ? defaultValue : num;
  };
  
  const getBoolean = (field: string, defaultValue: boolean = true): boolean => {
    const val = getValue(field).toLowerCase();
    if (val.includes("不") || val.includes("否") || val === "false" || val === "no") {
      return false;
    }
    if (val.includes("可") || val.includes("是") || val.includes("允") || val === "true" || val === "yes") {
      return true;
    }
    return defaultValue;
  };
  
  return {
    // 基本信息
    id: getValue("id"),
    name: getValue("name"),
    thirdParty: getValue("thirdParty"),
    serviceTier: getValue("serviceTier"),
    serviceLevel: getValue("serviceLevel"),
    
    // 价格
    fixFee: getNumber("fixFee"),
    varFeePerGram: getNumber("varFeePerGram"),
    
    // 尺寸限制
    maxLength: getNumber("maxLength"),
    maxWidth: getNumber("maxWidth"),
    maxHeight: getNumber("maxHeight"),
    maxSumDimension: getNumber("maxSumDimension"),
    
    // 重量限制
    minWeight: getNumber("minWeight"),
    maxWeight: getNumber("maxWeight"),
    maxVolWeight: getNumber("maxVolWeight"),
    
    // 货值
    maxValueRUB: getNumber("maxValueRUB"),
    maxValue: getNumber("maxValue"),
    
    // 时效
    deliveryTimeMin: getNumber("deliveryTimeMin"),
    deliveryTimeMax: getNumber("deliveryTimeMax"),
    
    // 计费
    billingType: getValue("billingType"),
    volumetricDivisor: getNumber("volumetricDivisor"),
    
    // 属性
    ozonRating: getNumber("ozonRating"),
    batteryAllowed: getBoolean("batteryAllowed"),
    liquidAllowed: getBoolean("liquidAllowed"),
  };
}

/**
 * 从名称提取电池/液体属性（智能推断）
 */
export function inferAttributesFromName(name: string): {
  batteryAllowed: boolean;
  liquidAllowed: boolean;
} {
  const lowerName = name.toLowerCase();
  
  // 电池：Economy 通常可以带电，Express 通常不可以
  const batteryAllowed = lowerName.includes("economy") || 
                          lowerName.includes("standard") ||
                          !lowerName.includes("express");
  
  // 液体：包含"特货"、"液体"、"液体"通常不允许
  const liquidAllowed = !lowerName.includes("特货") && 
                         !lowerName.includes("liquid") &&
                         !lowerName.includes("液体");
  
  return { batteryAllowed, liquidAllowed };
}

/**
 * 导入用的物流通道类型（部分字段可选）
 */
export interface ImportShippingChannel {
  id?: string;
  name?: string;
  thirdParty?: string;
  serviceTier?: string;
  serviceLevel?: string;
  fixFee?: number;
  varFeePerGram?: number;
  maxLength?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxSumDimension?: number;
  minWeight?: number;
  maxWeight?: number;
  maxVolWeight?: number;
  maxValueRUB?: number;
  maxValue?: number;
  deliveryTimeMin?: number;
  deliveryTimeMax?: number;
  billingType?: string;
  volumetricDivisor?: number;
  ozonRating?: number;
  batteryAllowed?: boolean;
  liquidAllowed?: boolean;
}