"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Info, XCircle, Ruler, Lightbulb, Sparkles } from "lucide-react";
import { ParsedData, FieldMapping, SizeConstraints } from "@/lib/smart-parser";

interface PreviewMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedData: ParsedData;
  dataType: "commission" | "shipping";
  onConfirm: (mappings: FieldMapping[]) => void;
  onCancel: () => void;
}

export function PreviewMappingDialog({
  open,
  onOpenChange,
  parsedData,
  dataType,
  onConfirm,
  onCancel,
}: PreviewMappingDialogProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>(parsedData.mappings);
  
  // 🔹 字段分级定义
  const FIELD_TIER: {
    REQUIRED: Record<"commission" | "shipping", string[]>;
    ENHANCED: Record<"commission" | "shipping", string[]>;
  } = {
    // 核心字段：必须映射才能计算
    REQUIRED: {
      commission: ["primaryCategory", "secondaryCategory", "tier1Rate", "tier2Rate", "tier3Rate"],
      shipping: ["name", "rate"],
    },
    // 增强字段：可选，支持智能拦截
    ENHANCED: {
      commission: [],
      shipping: [
        "sizeConstraints",
        "batteryAllowed",
        "liquidAllowed",
        "maxValueRUB",
        "minWeight",
        "maxWeight",
      ],
    },
  };
  
  // 🔹 智能分析特性提示
  const SMART_FEATURES: Record<string, { icon: string; label: string }> = {
    sizeConstraints: {
      icon: "📐",
      label: "支持智能拆解：自动识别边长总和与长边限制",
    },
    rate: {
      icon: "🧮",
      label: "支持公式解析：自动识别首重+续重逻辑",
    },
    batteryAllowed: {
      icon: "🔋",
      label: "支持属性联动：根据商品带电属性自动筛选",
    },
    liquidAllowed: {
      icon: "💧",
      label: "支持属性联动：根据商品带液体属性自动筛选",
    },
    maxValueRUB: {
      icon: "💰",
      label: "支持货值过滤：根据售价自动筛选",
    },
  };
  
  // 获取字段级别
  const getFieldTier = (field: string): "required" | "enhanced" | "optional" => {
    if (FIELD_TIER.REQUIRED[dataType]?.includes(field)) return "required";
    if (FIELD_TIER.ENHANCED[dataType]?.includes(field)) return "enhanced";
    return "optional";
  };
  
  // 获取字段状态
  const getFieldStatus = (mapping: FieldMapping): "success" | "warning" | "error" | "ignored" => {
    const tier = getFieldTier(mapping.systemField);
    
    // 核心字段必须映射
    if (tier === "required") {
      if (mapping.columnIndex === -1) return "error";
      if (mapping.confidence >= 0.9) return "success";
      if (mapping.confidence >= 0.7) return "warning";
      return "error";
    }
    
    // 增强字段和可选字段
    if (mapping.columnIndex === -1) return "ignored"; // 未映射
    if (mapping.confidence >= 0.9) return "success";
    if (mapping.confidence >= 0.7) return "warning";
    return "error";
  };
  
  // 更新单个映射
  const updateMapping = (systemField: string, columnIndex: number) => {
    setMappings(prev => prev.map(m => 
      m.systemField === systemField 
        ? { 
            ...m, 
            columnIndex, 
            csvColumn: parsedData.headers[columnIndex] || null,
            manual: true,
            confidence: 1.0,
          }
        : m
    ));
  };
  
  // 渲染字段状态图标
  const renderStatusIcon = (status: "success" | "warning" | "error" | "ignored") => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "ignored":
        return <Info className="h-4 w-4 text-gray-400" />;
    }
  };
  
  // 获取字段中文名称
  const getFieldLabel = (systemField: string): string => {
    const labels: Record<string, string> = {
      primaryCategory: "一级类目",
      secondaryCategory: "二级类目",
      tier1Rate: "阶梯1 (0-1500 RUB)",
      tier2Rate: "阶梯2 (1500-5000 RUB)",
      tier3Rate: "阶梯3 (5000+ RUB)",
      name: "配送方式",
      thirdParty: "物流商",
      serviceLevel: "服务等级",
      rate: "费率",
      minWeight: "最小重量",
      maxWeight: "最大重量",
      maxLength: "最大长度",
      maxWidth: "最大宽度",
      maxHeight: "最大高度",
      deliveryTime: "时效",
      sizeConstraints: "尺寸限制", // 🔹 新增
    };
    return labels[systemField] || systemField;
  };
  
  // 预览数据行（只显示前5行）
  const previewRows = parsedData.rows.slice(0, 5);
  
  // 计算识别率
  const recognizedCount = mappings.filter(m => m.confidence >= 0.7 && m.columnIndex !== -1).length;
  const mappedCount = mappings.filter(m => m.columnIndex !== -1).length;
  const totalCount = mappings.length;
  const recognitionRate = Math.round((recognizedCount / totalCount) * 100);
  
  // 🔹 检查是否可以确认（只检查核心字段）
  const requiredFields = FIELD_TIER.REQUIRED[dataType] || [];
  const missingRequired = requiredFields.filter(field => {
    const mapping = mappings.find(m => m.systemField === field);
    return !mapping || mapping.columnIndex === -1;
  });
  
  const canConfirm = missingRequired.length === 0 && parsedData.errors.length === 0;
  
  // 🔹 计算已启用功能
  const enabledFeatures = mappings
    .filter(m => m.columnIndex !== -1 && SMART_FEATURES[m.systemField])
    .map(m => m.systemField);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dataType === "commission" ? "📊 佣金表解析预览" : "🚚 物流费率表解析预览"}
          </DialogTitle>
          <DialogDescription>
            请检查字段映射是否正确，如有错误可手动修正
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* 解析状态 */}
          <div className={`p-4 rounded-lg border-2 ${
            recognitionRate >= 90 ? "bg-green-50 border-green-200" :
            recognitionRate >= 70 ? "bg-amber-50 border-amber-200" :
            "bg-red-50 border-red-200"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4" />
              <span className="font-bold">
                已自动识别 {recognizedCount}/{totalCount} 个核心字段 ({recognitionRate}%)
              </span>
            </div>
            
            {/* 错误提示 */}
            {parsedData.errors.length > 0 && (
              <div className="mt-3 space-y-1">
                {parsedData.errors.map((error, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* 警告提示 */}
            {parsedData.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {parsedData.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-amber-700">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* 字段映射表 */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left w-12">状态</th>
                  <th className="p-3 text-left">系统字段</th>
                  <th className="p-3 text-left">CSV 列名</th>
                  <th className="p-3 text-left">功能说明</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => {
                  const status = getFieldStatus(mapping);
                  const tier = getFieldTier(mapping.systemField);
                  const smartFeature = SMART_FEATURES[mapping.systemField];
                  
                  return (
                    <tr key={mapping.systemField} className={`border-t hover:bg-muted/50 ${
                      status === "error" ? "bg-red-50" : ""
                    }`}>
                      <td className="p-3">
                        {renderStatusIcon(status)}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getFieldLabel(mapping.systemField)}</span>
                            {/* 字段级别标识 */}
                            {tier === "required" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">
                                必填
                              </span>
                            )}
                            {tier === "enhanced" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                增强
                              </span>
                            )}
                            {tier === "optional" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                                可选
                              </span>
                            )}
                          </div>
                          
                          {/* 智能功能提示 */}
                          {smartFeature && mapping.columnIndex !== -1 && (
                            <div className="flex items-center gap-1 text-[10px] text-blue-600">
                              <Sparkles className="h-3 w-3" />
                              <span>{smartFeature.icon}</span>
                              <span className="italic">{smartFeature.label}</span>
                            </div>
                          )}
                          
                          {/* 状态说明 */}
                          {status === "ignored" && (
                            <div className="text-[10px] text-gray-500 italic">
                              仅作参考，不参与自动拦截
                            </div>
                          )}
                          {status === "success" && tier === "enhanced" && (
                            <div className="text-[10px] text-green-600 font-medium">
                              ✓ 已开启智能过滤功能
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Select
                          value={mapping.columnIndex.toString()}
                          onValueChange={(value) => updateMapping(mapping.systemField, parseInt(value))}
                        >
                          <SelectTrigger className={`w-full ${
                            status === "error" ? "border-red-300 bg-red-50" : ""
                          }`}>
                            <SelectValue placeholder="请选择列" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-1">
                              {tier === "required" ? "⚠️ 必须选择" : "不映射（跳过）"}
                            </SelectItem>
                            {parsedData.headers.map((header, index) => (
                              <SelectItem key={index} value={index.toString()}>
                                {header || `列 ${index + 1}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                mapping.confidence >= 0.9 ? "bg-green-500" :
                                mapping.confidence >= 0.7 ? "bg-amber-500" :
                                "bg-red-500"
                              }`}
                              style={{ width: mapping.columnIndex === -1 ? 0 : `${mapping.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {mapping.columnIndex === -1 ? "未映射" : `${Math.round(mapping.confidence * 100)}%`}
                          </span>
                          {mapping.manual && (
                            <span className="text-xs text-blue-600 font-medium">手动</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* 数据预览 */}
          <div>
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" />
              数据预览（前 5 行）
            </h3>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left border-r">#</th>
                    {parsedData.headers.map((header, i) => (
                      <th key={i} className="p-2 text-left border-r min-w-[120px]">
                        {header || `列 ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-muted/50">
                      <td className="p-2 border-r font-medium">{i + 1}</td>
                      {row.map((cell, j) => {
                        const isMapped = mappings.some(m => m.columnIndex === j);
                        const hasError = !cell || cell.trim() === "" || cell === "-";
                        return (
                          <td 
                            key={j} 
                            className={`p-2 border-r ${
                              hasError && isMapped ? "bg-red-50 text-red-700" : ""
                            }`}
                          >
                            {cell || <span className="text-muted-foreground">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* 🔹 尺寸约束解析结果 */}
          {dataType === "shipping" && parsedData.parsedConstraints && parsedData.parsedConstraints.size > 0 && (
            <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
              <h3 className="font-bold mb-3 flex items-center gap-2 text-blue-900">
                <Ruler className="h-4 w-4" />
                尺寸约束解析结果
              </h3>
              <div className="space-y-2 text-sm">
                {Array.from(parsedData.parsedConstraints.entries()).slice(0, 3).map(([rowKey, constraints]) => {
                  const rowIndex = parseInt(rowKey.replace("row_", ""));
                  const row = parsedData.rows[rowIndex];
                  const channelName = row ? row[0] : `渠道 ${rowIndex + 1}`;
                  
                  return (
                    <div key={rowKey} className="p-3 bg-white rounded border border-blue-100">
                      <div className="font-medium mb-1">{channelName}</div>
                      <div className="flex gap-4 text-xs text-gray-700">
                        {constraints.maxSum !== null && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            总和限 {constraints.maxSum}cm
                          </span>
                        )}
                        {constraints.maxLongEdge !== null && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            长边限 {constraints.maxLongEdge}cm
                          </span>
                        )}
                        {constraints.maxSum === null && constraints.maxLongEdge === null && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            未能识别，需手动输入
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {parsedData.parsedConstraints.size > 3 && (
                  <div className="text-xs text-muted-foreground italic">
                    ... 还有 {parsedData.parsedConstraints.size - 3} 个渠道的约束已解析
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2 flex-col items-stretch">
          {/* 🔹 状态摘要 */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
            <div className="flex items-center gap-4">
              <span>已映射: {mappedCount}/{totalCount}</span>
              {enabledFeatures.length > 0 && (
                <span className="text-blue-600">
                  ✓ 已启用 {enabledFeatures.length} 个智能功能
                </span>
              )}
            </div>
          </div>
          
          {/* 🔹 缺失必填字段提示 */}
          {missingRequired.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-red-700">缺少必填字段：</span>
                  <span className="text-red-700">
                    {missingRequired.map(f => getFieldLabel(f)).join("、")}
                  </span>
                  <div className="text-xs text-red-600 mt-1">
                    这些字段为运费计算必需，请务必映射
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 🔹 按钮区域 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              onClick={() => onConfirm(mappings)}
              disabled={!canConfirm}
              className="flex-1"
            >
              {canConfirm ? "确认导入" : "请映射必填字段"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
