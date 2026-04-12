/**
 * 标准模板导出功能
 * 提供佣金表和物流表的标准CSV模板
 */

/**
 * 生成并下载标准佣金表模板
 */
export function downloadCommissionTemplate(): void {
  const headers = [
    "一级类目",
    "二级类目",
    "佣金率(0-1500卢布)",
    "佣金率(1500-5000卢布)",
    "佣金率(5000+卢布)",
  ];

  const exampleData = [
    ["电子产品", "电子产品配饰", "12%", "20%", "20%"],
    ["电子产品", "智能手机和平板电脑", "11.5%", "11.5%", "11.5%"],
    ["家居与汽车用品", "家具", "10%", "10%", "10%"],
    ["美容", "美容与健康", "12%", "14%", "18%"],
  ];

  const csvContent = [
    headers.join(","),
    ...exampleData.map(row => row.join(",")),
  ].join("\n");

  downloadCSV(csvContent, "ozon_commission_template.csv");
}

/**
 * 生成并下载标准物流表模板
 */
export function downloadShippingTemplate(): void {
  const headers = [
    "配送方式",
    "服务等级",
    "评分组",
    "第三方物流",
    "评级",
    "时效(天)",
    "费率(固定+变动)",
    "电池",
    "液体",
    "尺寸限制",
    "最小重量(g)",
    "最大重量(g)",
    "货值限制-卢布",
    "货值限制-人民币",
    "计费类型",
  ];

  const exampleData = [
    [
      "RETS Express Extra Small",
      "Express",
      "Extra Small",
      "RETS",
      "1",
      "5-14",
      "¥3.12 + ¥0.0468/1g",
      "禁止",
      "禁止",
      "边长总和≤90cm,长边≤60cm",
      "1",
      "500",
      "1-1500",
      "0.01-135",
      "实际重量",
    ],
    [
      "CDEK Standard Big",
      "Standard",
      "Big",
      "CDEK",
      "3",
      "10-25",
      "¥5.00 + ¥0.0600/1g",
      "允许",
      "允许",
      "边长总和≤250cm,长边≤100cm",
      "1",
      "30000",
      "1-100000",
      "0.01-8200",
      "实际重量",
    ],
  ];

  const csvContent = [
    headers.join(","),
    ...exampleData.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  downloadCSV(csvContent, "ozon_shipping_template.csv");
}

/**
 * 下载CSV文件的通用函数
 */
function downloadCSV(content: string, filename: string): void {
  // 添加 BOM 以支持中文
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
