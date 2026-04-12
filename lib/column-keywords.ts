/**
 * 列名关键词库配置
 * 用于模糊匹配表格列名
 */

export interface ColumnKeywordConfig {
  field: string;
  keywords: string[];
  required?: boolean;
}

// 佣金表列关键词库
export const COMMISSION_COLUMN_KEYWORDS: ColumnKeywordConfig[] = [
  {
    field: "primaryCategory",
    keywords: ["一级类目", "primary", "主类目", "大类目", "一级分类", "категория", "category"],
    required: true,
  },
  {
    field: "secondaryCategory",
    keywords: ["二级类目", "secondary", "子类目", "小类目", "二级分类", "подкатегория", "subcategory"],
    required: true,
  },
  {
    field: "tier1",
    keywords: [
      "0-1500",
      "tier1",
      "c1",
      "第一阶梯",
      "第一档",
      "0~1500",
      "0‑1500",
      "tier 1",
      "一档",
      "0 руб. – 1500 руб.",
    ],
    required: true,
  },
  {
    field: "tier2",
    keywords: [
      "1500-5000",
      "tier2",
      "c2",
      "第二阶梯",
      "第二档",
      "1500~5000",
      "1500‑5000",
      "tier 2",
      "二档",
      "1500 руб. – 5000 руб.",
    ],
    required: true,
  },
  {
    field: "tier3",
    keywords: [
      "5000+",
      "tier3",
      "c3",
      "第三阶梯",
      "第三档",
      "5000+",
      "5000以上",
      "tier 3",
      "三档",
      "5000+ руб.",
      "≥5000",
    ],
    required: true,
  },
  {
    field: "rfbs",
    keywords: ["rfbs", "fbs", "rfbs费率", "fbs费率", "配送费率", "delivery fee", "тариф rfbs"],
    required: false,
  },
];

// 物流表列关键词库
export const SHIPPING_COLUMN_KEYWORDS: ColumnKeywordConfig[] = [
  {
    field: "name",
    keywords: [
      "配送方式",
      "deliveryvariant",
      "метод",
      "物流方式",
      "配送方法",
      "delivery method",
      "shipping method",
      "渠道名称",
      "渠道",
    ],
    required: true,
  },
  {
    field: "serviceLevel",
    keywords: [
      "服务等级",
      "service level",
      "уровень сервиса",
      "服务级别",
      "配送等级",
      "物流等级",
    ],
    required: false,
  },
  {
    field: "tier",
    keywords: [
      "评分组",
      "scoring",
      "评级组",
      "评分等级",
      "tier",
      "评分",
      "рейтинг",
      "rating",
    ],
    required: false,
  },
  {
    field: "thirdParty",
    keywords: [
      "第三方物流",
      "3pl",
      "треть",
      "third party",
      "第三方",
      "物流商",
      "承运商",
    ],
    required: false,
  },
  {
    field: "rating",
    keywords: [
      "评级",
      "rating",
      "рейтинг",
      "评分",
      "ozon评分",
      "评分值",
    ],
    required: false,
  },
  {
    field: "deliveryTime",
    keywords: [
      "时效",
      "срок",
      "delivery time",
      "配送时效",
      "运输时效",
      "时效限制",
      "配送时间",
      "时效范围",
    ],
    required: false,
  },
  {
    field: "rate",
    keywords: [
      "费率",
      "ставк",
      "rate",
      "价格",
      "费用",
      "运费",
      "价格明细",
      "费率明细",
    ],
    required: false,
  },
  {
    field: "battery",
    keywords: [
      "电池",
      "battery",
      "батар",
      "含电池",
      "电池产品",
      "battery allowed",
    ],
    required: false,
  },
  {
    field: "liquid",
    keywords: [
      "液体",
      "liquid",
      "жидкост",
      "液体产品",
      "含液体",
      "liquid allowed",
    ],
    required: false,
  },
  {
    field: "dimension",
    keywords: [
      "尺寸限制",
      "размер",
      "dimension",
      "规格限制",
      "尺寸要求",
      "体积限制",
      "规格",
    ],
    required: false,
  },
  {
    field: "minWeight",
    keywords: [
      "最小重量",
      "min weight",
      "最小重",
      "重量下限",
      "重量限制最小",
    ],
    required: false,
  },
  {
    field: "maxWeight",
    keywords: [
      "最大重量",
      "max weight",
      "最大重",
      "重量上限",
      "重量限制最大",
    ],
    required: false,
  },
  {
    field: "valueRUB",
    keywords: [
      "货值限制卢布",
      "rub",
      "卢布限制",
      "货值卢布",
      "价值限制卢布",
      "value rub",
    ],
    required: false,
  },
  {
    field: "valueRMB",
    keywords: [
      "货值限制人民币",
      "rmb",
      "cny",
      "人民币限制",
      "货值人民币",
      "价值限制人民币",
      "value rmb",
    ],
    required: false,
  },
  {
    field: "billingType",
    keywords: [
      "计费类型",
      "billing",
      "计费方式",
      "计费模式",
      "billing type",
    ],
    required: false,
  },
  {
    field: "volumetricDivisor",
    keywords: [
      "体积重量",
      "volumetric",
      "体积系数",
      "体积重",
      "体积除数",
    ],
    required: false,
  },
];

/**
 * 模糊匹配列名
 * @param header 表头名称
 * @param keywords 关键词配置数组
 * @returns 匹配的字段名，如果没有匹配则返回 null
 */
export function fuzzyMatchColumn(
  header: string,
  keywords: ColumnKeywordConfig[]
): string | null {
  const headerLower = header.toLowerCase().trim();
  
  for (const config of keywords) {
    for (const keyword of config.keywords) {
      if (headerLower.includes(keyword.toLowerCase())) {
        return config.field;
      }
    }
  }
  
  return null;
}

/**
 * 批量映射表头到字段
 * @param headers 表头数组
 * @param keywords 关键词配置数组
 * @returns 字段到列索引的映射
 */
export function mapColumnsByKeywords(
  headers: string[],
  keywords: ColumnKeywordConfig[]
): Record<string, number> {
  const mapping: Record<string, number> = {};
  
  headers.forEach((header, index) => {
    const field = fuzzyMatchColumn(header, keywords);
    if (field && !(field in mapping)) {
      mapping[field] = index;
    }
  });
  
  return mapping;
}

/**
 * 检查必需字段是否都已映射
 * @param mapping 字段映射
 * @param keywords 关键词配置数组
 * @returns 缺失的必需字段列表
 */
export function checkRequiredFields(
  mapping: Record<string, number>,
  keywords: ColumnKeywordConfig[]
): string[] {
  const missing: string[] = [];
  
  for (const config of keywords) {
    if (config.required && !(config.field in mapping)) {
      missing.push(config.field);
    }
  }
  
  return missing;
}
