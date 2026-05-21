import type { ColumnSchema } from "./text-to-sql.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PresetQuestion {
  id: string;
  question: string;
  category: string;
  chartType: "line" | "bar" | "pie" | "scatter" | "table";
  /** Brief description of expected output */
  outputHint: string;
}

// ── E-commerce Preset Questions ──────────────────────────────────────────────

const ECOMMERCE_SALES: PresetQuestion[] = [
  {
    id: "ec-sales-trend-30d",
    question: "最近30天的销售额趋势",
    category: "销售概览",
    chartType: "line",
    outputHint: "→ 生成每日销售额折线图",
  },
  {
    id: "ec-sales-mom",
    question: "本月与上月的销售额对比，增长率是多少",
    category: "销售概览",
    chartType: "bar",
    outputHint: "→ 生成月度对比柱状图",
  },
  {
    id: "ec-top10-products",
    question: "销售额TOP10商品",
    category: "销售概览",
    chartType: "bar",
    outputHint: "→ 生成横向柱状图排行",
  },
  {
    id: "ec-avg-order-value",
    question: "客单价的变化趋势（按周）",
    category: "销售概览",
    chartType: "line",
    outputHint: "→ 生成周均客单价折线图",
  },
];

const ECOMMERCE_PRODUCT: PresetQuestion[] = [
  {
    id: "ec-product-profit",
    question: "哪些商品销量高但利润率低（需要调价）",
    category: "商品分析",
    chartType: "scatter",
    outputHint: "→ 生成销量vs利润率散点图",
  },
  {
    id: "ec-return-rate",
    question: "退货率最高的商品TOP10",
    category: "商品分析",
    chartType: "bar",
    outputHint: "→ 生成退货率排行柱状图",
  },
  {
    id: "ec-zero-sales",
    question: "过去30天零销售的商品有多少",
    category: "商品分析",
    chartType: "table",
    outputHint: "→ 生成滞销商品列表",
  },
  {
    id: "ec-category-revenue",
    question: "各品类的销售额占比",
    category: "商品分析",
    chartType: "pie",
    outputHint: "→ 生成品类占比饼图",
  },
];

const ECOMMERCE_TIME: PresetQuestion[] = [
  {
    id: "ec-weekday-sales",
    question: "一周中哪天销售最好",
    category: "时间维度",
    chartType: "bar",
    outputHint: "→ 生成星期销售分布柱状图",
  },
  {
    id: "ec-hourly-orders",
    question: "一天中哪个时段下单最多",
    category: "时间维度",
    chartType: "bar",
    outputHint: "→ 生成小时维度订单分布",
  },
  {
    id: "ec-weekly-trend",
    question: "过去12周的销售趋势，是否有周期性",
    category: "时间维度",
    chartType: "line",
    outputHint: "→ 生成周销售额趋势折线图",
  },
];

const ECOMMERCE_CUSTOMER: PresetQuestion[] = [
  {
    id: "ec-new-vs-old",
    question: "新客与老客的订单占比和客单价差异",
    category: "客户分析",
    chartType: "bar",
    outputHint: "→ 生成新客/老客分组对比柱状图",
  },
  {
    id: "ec-repurchase-rate",
    question: "复购率是多少",
    category: "客户分析",
    chartType: "table",
    outputHint: "→ 计算复购率数值",
  },
  {
    id: "ec-top-customers",
    question: "累计消费最高的TOP10客户",
    category: "客户分析",
    chartType: "table",
    outputHint: "→ 生成高价值客户列表",
  },
];

const ECOMMERCE_CHANNEL: PresetQuestion[] = [
  {
    id: "ec-channel-conversion",
    question: "各流量渠道的转化率对比",
    category: "渠道分析",
    chartType: "bar",
    outputHint: "→ 生成渠道转化率对比柱状图",
  },
  {
    id: "ec-channel-revenue",
    question: "各渠道带来的销售额占比",
    category: "渠道分析",
    chartType: "pie",
    outputHint: "→ 生成渠道销售额饼图",
  },
  {
    id: "ec-channel-trend",
    question: "各渠道销售额的月度变化趋势",
    category: "渠道分析",
    chartType: "line",
    outputHint: "→ 生成多渠道趋势对比折线图",
  },
];

const ALL_ECOMMERCE_QUESTIONS: PresetQuestion[] = [
  ...ECOMMERCE_SALES,
  ...ECOMMERCE_PRODUCT,
  ...ECOMMERCE_TIME,
  ...ECOMMERCE_CUSTOMER,
  ...ECOMMERCE_CHANNEL,
];

// ── Generic Preset Questions (fallback) ──────────────────────────────────────

const GENERIC_QUESTIONS: PresetQuestion[] = [
  {
    id: "gen-row-count",
    question: "这个数据集有多少行",
    category: "基础统计",
    chartType: "table",
    outputHint: "→ 统计总行数",
  },
  {
    id: "gen-summary",
    question: "各列的基本统计（均值、最大、最小）",
    category: "基础统计",
    chartType: "table",
    outputHint: "→ 生成各列统计摘要",
  },
  {
    id: "gen-top10",
    question: "数量最多的前10个类别",
    category: "基础统计",
    chartType: "bar",
    outputHint: "→ 生成TOP10排行柱状图",
  },
  {
    id: "gen-distribution",
    question: "各类别的数据分布",
    category: "基础统计",
    chartType: "pie",
    outputHint: "→ 生成分布饼图",
  },
  {
    id: "gen-trend",
    question: "数据随时间的变化趋势",
    category: "基础统计",
    chartType: "line",
    outputHint: "→ 生成时间趋势折线图",
  },
];

// ── Field Detection & Matching ───────────────────────────────────────────────

/** Keywords that indicate e-commerce data */
const ECOMMERCE_FIELD_PATTERNS = [
  /订单|order/i,
  /商品|product|sku|item/i,
  /金额|amount|revenue|price|价格|单价|销售/i,
  /渠道|channel|source|来源/i,
  /客户|customer|用户|user|buyer/i,
  /退货|return|退款|refund/i,
  /类目|category|品类/i,
  /支付|payment|pay/i,
];

/** Detect if the dataset looks like e-commerce data */
function isEcommerceData(columns: ColumnSchema[]): boolean {
  const colNames = columns.map((c) => c.name.toLowerCase());
  let matchCount = 0;
  for (const pattern of ECOMMERCE_FIELD_PATTERNS) {
    if (colNames.some((name) => pattern.test(name))) {
      matchCount++;
    }
  }
  // Match if 3+ e-commerce field patterns found
  return matchCount >= 3;
}

/**
 * Get recommended preset questions based on the data schema.
 * Returns e-commerce questions if fields match, otherwise generic questions.
 */
export function getPresetQuestions(columns: ColumnSchema[]): {
  isEcommerce: boolean;
  questions: PresetQuestion[];
} {
  if (isEcommerceData(columns)) {
    return { isEcommerce: true, questions: ALL_ECOMMERCE_QUESTIONS };
  }
  return { isEcommerce: false, questions: GENERIC_QUESTIONS };
}

export { ALL_ECOMMERCE_QUESTIONS, GENERIC_QUESTIONS };
