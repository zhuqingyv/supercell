# DataLens SQL 准确率 Benchmark

**版本**: v1.0
**日期**: 2026-04-02
**编写**: 老房、老李

---

## 1. 标准电商样本数据

### 1.1 orders.csv（订单表）

**Schema:**

| 列名 | 类型 | 说明 |
|------|------|------|
| order_id | TEXT | 订单ID（ORD-001 格式） |
| user_id | TEXT | 用户ID（U-001 格式） |
| product_id | TEXT | 商品ID（P-001 格式） |
| product_name | TEXT | 商品名称 |
| category | TEXT | 品类（数码/服饰/食品/家居/美妆） |
| quantity | INTEGER | 购买数量 |
| unit_price | REAL | 单价（元） |
| total_amount | REAL | 总金额（元） |
| order_date | TEXT | 订单日期（YYYY-MM-DD） |
| payment_method | TEXT | 支付方式（微信/支付宝/信用卡） |
| status | TEXT | 状态（completed/refunded/cancelled/pending） |
| region | TEXT | 地区（华东/华南/华北/西南/东北） |
| city | TEXT | 城市 |

**样本数据（30 行）：**

```csv
order_id,user_id,product_id,product_name,category,quantity,unit_price,total_amount,order_date,payment_method,status,region,city
ORD-001,U-001,P-001,iPhone 15 Pro,数码,1,7999.00,7999.00,2024-01-05,微信,completed,华东,上海
ORD-002,U-002,P-002,AirPods Pro 2,数码,2,1799.00,3598.00,2024-01-08,支付宝,completed,华南,广州
ORD-003,U-003,P-010,纯棉T恤,服饰,3,89.00,267.00,2024-01-10,微信,completed,华北,北京
ORD-004,U-001,P-005,有机坚果礼盒,食品,1,168.00,168.00,2024-01-12,信用卡,completed,华东,上海
ORD-005,U-004,P-003,MacBook Air M3,数码,1,8999.00,8999.00,2024-01-15,支付宝,completed,西南,成都
ORD-006,U-005,P-011,羽绒服,服饰,1,599.00,599.00,2024-01-18,微信,refunded,东北,哈尔滨
ORD-007,U-006,P-006,进口牛奶箱装,食品,2,75.00,150.00,2024-01-20,微信,completed,华东,杭州
ORD-008,U-002,P-012,运动鞋,服饰,1,459.00,459.00,2024-01-22,支付宝,completed,华南,深圳
ORD-009,U-007,P-007,智能台灯,家居,1,299.00,299.00,2024-01-25,微信,completed,华北,天津
ORD-010,U-008,P-020,精华液套装,美妆,1,399.00,399.00,2024-01-28,信用卡,completed,华东,南京
ORD-011,U-003,P-001,iPhone 15 Pro,数码,1,7999.00,7999.00,2024-02-01,微信,completed,华北,北京
ORD-012,U-009,P-013,瑜伽裤,服饰,2,159.00,318.00,2024-02-05,支付宝,cancelled,华南,广州
ORD-013,U-010,P-008,零食大礼包,食品,3,59.00,177.00,2024-02-08,微信,completed,西南,重庆
ORD-014,U-004,P-014,沙发靠垫,家居,4,49.00,196.00,2024-02-10,微信,completed,西南,成都
ORD-015,U-006,P-021,口红套装,美妆,1,299.00,299.00,2024-02-12,支付宝,completed,东北,哈尔滨
ORD-016,U-011,P-002,AirPods Pro 2,数码,1,1799.00,1799.00,2024-02-15,信用卡,completed,华东,上海
ORD-017,U-001,P-015,连衣裙,服饰,1,329.00,329.00,2024-02-18,微信,refunded,华东,上海
ORD-018,U-012,P-009,挂钟,家居,1,189.00,189.00,2024-02-20,微信,completed,华北,北京
ORD-019,U-013,P-022,面膜礼盒,美妆,2,128.00,256.00,2024-02-22,支付宝,completed,华南,广州
ORD-020,U-007,P-004,iPad mini 6,数码,1,3799.00,3799.00,2024-02-25,微信,completed,华北,天津
ORD-021,U-014,P-016,卫衣,服饰,2,199.00,398.00,2024-03-01,微信,completed,东北,沈阳
ORD-022,U-005,P-010,纯棉T恤,服饰,5,89.00,445.00,2024-03-03,支付宝,completed,东北,哈尔滨
ORD-023,U-015,P-023,防晒霜,美妆,1,169.00,169.00,2024-03-05,微信,completed,华南,深圳
ORD-024,U-008,P-007,智能台灯,家居,2,299.00,598.00,2024-03-08,信用卡,pending,华东,南京
ORD-025,U-016,P-005,有机坚果礼盒,食品,2,168.00,336.00,2024-03-10,微信,completed,西南,成都
ORD-026,U-003,P-024,眼影盘,美妆,1,259.00,259.00,2024-03-12,支付宝,completed,华北,北京
ORD-027,U-017,P-003,MacBook Air M3,数码,1,8999.00,8999.00,2024-03-15,信用卡,completed,华东,杭州
ORD-028,U-009,P-017,牛仔裤,服饰,1,289.00,289.00,2024-03-18,微信,refunded,华南,广州
ORD-029,U-018,P-006,进口牛奶箱装,食品,3,75.00,225.00,2024-03-20,微信,completed,华北,石家庄
ORD-030,U-010,P-009,挂钟,家居,1,189.00,189.00,2024-03-22,支付宝,completed,西南,重庆
```

### 1.2 traffic.csv（流量表）

**Schema:**

| 列名 | 类型 | 说明 |
|------|------|------|
| date | TEXT | 日期（YYYY-MM-DD） |
| channel | TEXT | 渠道（直接访问/搜索引擎/社交媒体/付费广告/邮件营销） |
| sessions | INTEGER | 会话数 |
| page_views | INTEGER | 页面浏览量 |
| unique_visitors | INTEGER | 独立访客 |
| bounce_rate | REAL | 跳出率（0-1） |
| avg_session_duration | REAL | 平均会话时长（秒） |

**样本数据（25 行）：**

```csv
date,channel,sessions,page_views,unique_visitors,bounce_rate,avg_session_duration
2024-01-01,直接访问,1200,3600,980,0.35,185.5
2024-01-01,搜索引擎,2800,8400,2100,0.28,210.3
2024-01-01,社交媒体,1500,3750,1200,0.42,120.8
2024-01-01,付费广告,800,2000,650,0.38,155.2
2024-01-01,邮件营销,400,1200,350,0.25,230.0
2024-01-15,直接访问,1350,4050,1100,0.33,190.2
2024-01-15,搜索引擎,3200,9600,2400,0.26,220.5
2024-01-15,社交媒体,1800,4500,1400,0.40,130.5
2024-01-15,付费广告,950,2375,780,0.36,160.8
2024-01-15,邮件营销,450,1350,380,0.23,240.1
2024-02-01,直接访问,1100,3300,900,0.37,175.3
2024-02-01,搜索引擎,2600,7800,1950,0.30,200.8
2024-02-01,社交媒体,1400,3500,1100,0.44,115.2
2024-02-01,付费广告,750,1875,600,0.40,148.5
2024-02-01,邮件营销,380,1140,320,0.27,225.3
2024-02-15,直接访问,1280,3840,1050,0.34,188.0
2024-02-15,搜索引擎,3000,9000,2250,0.27,215.8
2024-02-15,社交媒体,1650,4125,1300,0.41,125.3
2024-02-15,付费广告,880,2200,720,0.37,158.0
2024-02-15,邮件营销,420,1260,360,0.24,235.5
2024-03-01,直接访问,1400,4200,1150,0.32,195.8
2024-03-01,搜索引擎,3500,10500,2600,0.25,225.3
2024-03-01,社交媒体,2000,5000,1550,0.38,140.2
2024-03-01,付费广告,1050,2625,850,0.34,170.5
2024-03-01,邮件营销,500,1500,420,0.22,245.0
```

### 1.3 products.csv（商品表）

**Schema:**

| 列名 | 类型 | 说明 |
|------|------|------|
| product_id | TEXT | 商品ID |
| product_name | TEXT | 商品名称 |
| category | TEXT | 品类 |
| brand | TEXT | 品牌 |
| cost_price | REAL | 成本价（元） |
| selling_price | REAL | 售价（元） |
| stock | INTEGER | 库存 |
| listing_date | TEXT | 上架日期 |
| rating | REAL | 评分（1-5） |

**样本数据（24 行）：**

```csv
product_id,product_name,category,brand,cost_price,selling_price,stock,listing_date,rating
P-001,iPhone 15 Pro,数码,Apple,5500.00,7999.00,150,2023-09-15,4.8
P-002,AirPods Pro 2,数码,Apple,900.00,1799.00,300,2023-09-20,4.7
P-003,MacBook Air M3,数码,Apple,6200.00,8999.00,80,2024-01-01,4.9
P-004,iPad mini 6,数码,Apple,2600.00,3799.00,120,2023-03-10,4.6
P-005,有机坚果礼盒,食品,良品铺子,85.00,168.00,500,2023-11-01,4.3
P-006,进口牛奶箱装,食品,安佳,40.00,75.00,800,2023-06-15,4.5
P-007,智能台灯,家居,小米,150.00,299.00,200,2023-08-01,4.4
P-008,零食大礼包,食品,三只松鼠,30.00,59.00,1000,2023-12-01,4.1
P-009,挂钟,家居,北欧风,80.00,189.00,150,2023-07-20,4.2
P-010,纯棉T恤,服饰,优衣库,35.00,89.00,600,2023-05-01,4.3
P-011,羽绒服,服饰,波司登,280.00,599.00,100,2023-10-15,4.5
P-012,运动鞋,服饰,Nike,220.00,459.00,250,2023-04-01,4.6
P-013,瑜伽裤,服饰,Lululemon,80.00,159.00,400,2023-06-01,4.4
P-014,沙发靠垫,家居,MUJI,20.00,49.00,350,2023-09-01,4.0
P-015,连衣裙,服饰,ZARA,150.00,329.00,180,2024-01-10,4.2
P-016,卫衣,服饰,Champion,90.00,199.00,300,2023-11-15,4.3
P-017,牛仔裤,服饰,Levi's,130.00,289.00,220,2023-08-20,4.5
P-020,精华液套装,美妆,兰蔻,180.00,399.00,160,2023-10-01,4.7
P-021,口红套装,美妆,MAC,120.00,299.00,250,2023-07-01,4.4
P-022,面膜礼盒,美妆,SK-II,55.00,128.00,400,2023-11-20,4.3
P-023,防晒霜,美妆,安耐晒,70.00,169.00,350,2023-05-15,4.6
P-024,眼影盘,美妆,Tom Ford,110.00,259.00,200,2023-09-10,4.5
```

---

## 2. Benchmark 查询集（55 条）

### 分类说明

| 难度 | 编号范围 | 数量 | 准确率阈值 |
|------|----------|------|-----------|
| 简单 | Q01-Q25 | 25 条 | >= 90% |
| 中等 | Q26-Q45 | 20 条 | >= 75% |
| 复杂 | Q46-Q55 | 10 条 | >= 60%（参考） |

### 2.1 简单查询（Q01-Q25）

#### 单表聚合（Q01-Q08）

| 编号 | 自然语言问题 | 标准 SQL | 预期结果描述 |
|------|-------------|----------|-------------|
| Q01 | 总共有多少笔订单？ | `SELECT COUNT(*) AS total_orders FROM orders;` | 30 |
| Q02 | 所有订单的总销售额是多少？ | `SELECT SUM(total_amount) AS total_sales FROM orders;` | 50,205.00 |
| Q03 | 平均订单金额是多少？ | `SELECT ROUND(AVG(total_amount), 2) AS avg_amount FROM orders;` | 1673.50 |
| Q04 | 最贵的一笔订单金额是多少？ | `SELECT MAX(total_amount) AS max_amount FROM orders;` | 8999.00 |
| Q05 | 一共卖出了多少件商品？ | `SELECT SUM(quantity) AS total_quantity FROM orders;` | 50 |
| Q06 | 有多少个不同的用户下过单？ | `SELECT COUNT(DISTINCT user_id) AS unique_users FROM orders;` | 18 |
| Q07 | 退款订单有几笔？ | `SELECT COUNT(*) AS refund_count FROM orders WHERE status = 'refunded';` | 3 |
| Q08 | 商品平均评分是多少？ | `SELECT ROUND(AVG(rating), 2) AS avg_rating FROM products;` | 4.45 |

#### 排序查询（Q09-Q14）

| 编号 | 自然语言问题 | 标准 SQL | 预期结果描述 |
|------|-------------|----------|-------------|
| Q09 | 金额最高的5笔订单 | `SELECT order_id, product_name, total_amount FROM orders ORDER BY total_amount DESC LIMIT 5;` | ORD-027, ORD-005, ORD-001, ORD-011, ORD-020 |
| Q10 | 评分最高的3个商品 | `SELECT product_name, rating FROM products ORDER BY rating DESC LIMIT 3;` | MacBook Air M3(4.9), iPhone 15 Pro(4.8), AirPods Pro 2/精华液套装(4.7) |
| Q11 | 库存最少的5个商品 | `SELECT product_name, stock FROM products ORDER BY stock ASC LIMIT 5;` | MacBook Air M3(80), 羽绒服(100), iPad mini 6(120), 挂钟/精华液(150) |
| Q12 | 单价最低的商品是哪个？ | `SELECT product_name, selling_price FROM products ORDER BY selling_price ASC LIMIT 1;` | 沙发靠垫(49.00) |
| Q13 | 利润率最高的商品 | `SELECT product_name, ROUND((selling_price - cost_price) / cost_price * 100, 1) AS margin_pct FROM products ORDER BY margin_pct DESC LIMIT 1;` | 纯棉T恤(154.3%) |
| Q14 | 最近5笔订单是什么？ | `SELECT order_id, product_name, order_date FROM orders ORDER BY order_date DESC LIMIT 5;` | ORD-030到ORD-026 |

#### 条件筛选（Q15-Q20）

| 编号 | 自然语言问题 | 标准 SQL | 预期结果描述 |
|------|-------------|----------|-------------|
| Q15 | 华东地区的所有订单 | `SELECT * FROM orders WHERE region = '华东';` | 8 条记录 |
| Q16 | 数码品类的订单 | `SELECT * FROM orders WHERE category = '数码';` | 7 条记录 |
| Q17 | 金额超过1000元的订单 | `SELECT * FROM orders WHERE total_amount > 1000;` | 7 条记录 |
| Q18 | 用微信支付的订单有多少？ | `SELECT COUNT(*) FROM orders WHERE payment_method = '微信';` | 16 |
| Q19 | 已取消的订单 | `SELECT * FROM orders WHERE status = 'cancelled';` | 1 条（ORD-012） |
| Q20 | 库存大于300的商品 | `SELECT product_name, stock FROM products WHERE stock > 300;` | 8 个商品 |

#### 简单计算（Q21-Q25）

| 编号 | 自然语言问题 | 标准 SQL | 预期结果描述 |
|------|-------------|----------|-------------|
| Q21 | 每个品类有多少个商品？ | `SELECT category, COUNT(*) AS cnt FROM products GROUP BY category ORDER BY cnt DESC;` | 服饰(7), 美妆(5), 数码(4), 食品(3), 家居(3) |
| Q22 | 每种支付方式的订单数 | `SELECT payment_method, COUNT(*) AS cnt FROM orders GROUP BY payment_method ORDER BY cnt DESC;` | 微信(16), 支付宝(9), 信用卡(5) |
| Q23 | 每个地区的订单总额 | `SELECT region, SUM(total_amount) AS total FROM orders GROUP BY region ORDER BY total DESC;` | 华东/华北/华南/西南/东北 |
| Q24 | 搜索引擎渠道的总访客数 | `SELECT SUM(unique_visitors) AS total_uv FROM traffic WHERE channel = '搜索引擎';` | 11,300 |
| Q25 | 每个渠道的平均跳出率 | `SELECT channel, ROUND(AVG(bounce_rate), 3) AS avg_bounce FROM traffic GROUP BY channel ORDER BY avg_bounce ASC;` | 邮件营销最低，社交媒体最高 |

### 2.2 中等查询（Q26-Q45）

#### 多条件筛选（Q26-Q30）

| 编号 | 自然语言问题 | 标准 SQL | 预期结果描述 |
|------|-------------|----------|-------------|
| Q26 | 华东地区用微信支付且金额超过500的订单 | `SELECT * FROM orders WHERE region = '华东' AND payment_method = '微信' AND total_amount > 500;` | ORD-001, ORD-027 |
| Q27 | 非退款状态的数码品类订单总额 | `SELECT SUM(total_amount) FROM orders WHERE category = '数码' AND status != 'refunded';` | 全部数码都不是退款 |
| Q28 | 评分4.5以上且库存大于100的商品 | `SELECT product_name, rating, stock FROM products WHERE rating >= 4.5 AND stock > 100;` | iPhone 15 Pro, AirPods Pro 2, 进口牛奶, 运动鞋, 防晒霜等 |
| Q29 | 2024年2月的已完成订单 | `SELECT * FROM orders WHERE order_date BETWEEN '2024-02-01' AND '2024-02-28' AND status = 'completed';` | 过滤掉 ORD-012(cancelled) 和 ORD-017(refunded) |
| Q30 | 上海或北京的服饰订单 | `SELECT * FROM orders WHERE city IN ('上海', '北京') AND category = '服饰';` | ORD-003, ORD-017 |

#### 日期范围+聚合（Q31-Q35）

| 编号 | 自然语言问题 | 标准 SQL | 预期结果描述 |
|------|-------------|----------|-------------|
| Q31 | 2024年1月的总销售额 | `SELECT SUM(total_amount) FROM orders WHERE order_date >= '2024-01-01' AND order_date < '2024-02-01';` | 1月所有订单总额 |
| Q32 | 每个月的订单量趋势 | `SELECT SUBSTR(order_date, 1, 7) AS month, COUNT(*) AS order_count FROM orders GROUP BY month ORDER BY month;` | 1月10笔, 2月10笔, 3月10笔 |
| Q33 | 每个月的销售额趋势 | `SELECT SUBSTR(order_date, 1, 7) AS month, SUM(total_amount) AS monthly_sales FROM orders GROUP BY month ORDER BY month;` | 3个月的销售额 |
| Q34 | 3月份各品类销售额占比 | `SELECT category, SUM(total_amount) AS sales FROM orders WHERE order_date >= '2024-03-01' AND order_date < '2024-04-01' GROUP BY category ORDER BY sales DESC;` | 数码最高 |
| Q35 | 每半个月的流量变化 | `SELECT date, SUM(sessions) AS total_sessions FROM traffic GROUP BY date ORDER BY date;` | 5个时间点的会话总数 |

#### TOP-N 排序（Q36-Q40）

| 编号 | 自然语言问题 | 标准 SQL | 预期结果描述 |
|------|-------------|----------|-------------|
| Q36 | 消费总额最高的3个用户 | `SELECT user_id, SUM(total_amount) AS total_spend FROM orders GROUP BY user_id ORDER BY total_spend DESC LIMIT 3;` | U-001, U-004, U-017 等 |
| Q37 | 卖得最好的3个品类（按销售额） | `SELECT category, SUM(total_amount) AS sales FROM orders GROUP BY category ORDER BY sales DESC LIMIT 3;` | 数码 > 服饰 > ... |
| Q38 | 流量最高的3个渠道 | `SELECT channel, SUM(sessions) AS total_sessions FROM traffic GROUP BY channel ORDER BY total_sessions DESC LIMIT 3;` | 搜索引擎 > 社交媒体 > 直接访问 |
| Q39 | 复购次数最多的用户 | `SELECT user_id, COUNT(*) AS order_count FROM orders GROUP BY user_id ORDER BY order_count DESC LIMIT 5;` | 多次购买的用户 |
| Q40 | 每个地区销售额最高的订单 | `SELECT region, MAX(total_amount) AS max_order FROM orders GROUP BY region ORDER BY max_order DESC;` | 5个地区各自的最大订单 |

#### 分组统计+HAVING（Q41-Q45）

| 编号 | 自然语言问题 | 标准 SQL | 预期结果描述 |
|------|-------------|----------|-------------|
| Q41 | 订单数超过2笔的用户 | `SELECT user_id, COUNT(*) AS cnt FROM orders GROUP BY user_id HAVING cnt > 2;` | 多次购买的用户列表 |
| Q42 | 平均订单金额超过1000的品类 | `SELECT category, ROUND(AVG(total_amount), 2) AS avg_amt FROM orders GROUP BY category HAVING avg_amt > 1000;` | 数码 |
| Q43 | 每个渠道中跳出率低于0.3的记录有几条 | `SELECT channel, COUNT(*) AS low_bounce_count FROM traffic WHERE bounce_rate < 0.3 GROUP BY channel HAVING low_bounce_count >= 1 ORDER BY low_bounce_count DESC;` | 搜索引擎和邮件营销表现好 |
| Q44 | 销售额超过500且订单数超过1的品类 | `SELECT category, SUM(total_amount) AS sales, COUNT(*) AS cnt FROM orders GROUP BY category HAVING sales > 500 AND cnt > 1;` | 所有品类都满足 |
| Q45 | 退款率超过10%的品类 | `SELECT category, ROUND(SUM(CASE WHEN status='refunded' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS refund_rate FROM orders GROUP BY category HAVING refund_rate > 10;` | 服饰退款率较高 |

### 2.3 复杂查询（Q46-Q55）

> 注：复杂查询涉及跨表 JOIN 和嵌套子查询，MVP 可能不支持多表关联，但 benchmark 需要覆盖以建立基线。

| 编号 | 难度 | 自然语言问题 | 标准 SQL | 预期结果描述 |
|------|------|-------------|----------|-------------|
| Q46 | 复杂 | 每个品牌的总销售额（需关联 orders 和 products） | `SELECT p.brand, SUM(o.total_amount) AS sales FROM orders o JOIN products p ON o.product_id = p.product_id GROUP BY p.brand ORDER BY sales DESC;` | Apple 最高 |
| Q47 | 复杂 | 利润最高的5笔订单（需要成本价） | `SELECT o.order_id, o.product_name, o.total_amount - (p.cost_price * o.quantity) AS profit FROM orders o JOIN products p ON o.product_id = p.product_id WHERE o.status = 'completed' ORDER BY profit DESC LIMIT 5;` | 高价数码产品利润最高 |
| Q48 | 复杂 | 库存周转率（销量/库存） | `SELECT p.product_name, COALESCE(SUM(o.quantity), 0) AS sold, p.stock, ROUND(COALESCE(SUM(o.quantity), 0) * 1.0 / p.stock, 2) AS turnover FROM products p LEFT JOIN orders o ON p.product_id = o.product_id GROUP BY p.product_id ORDER BY turnover DESC;` | 各商品周转率排名 |
| Q49 | 复杂 | 高价值用户（总消费 > 5000）买了哪些品类 | `SELECT DISTINCT o.category FROM orders o WHERE o.user_id IN (SELECT user_id FROM orders GROUP BY user_id HAVING SUM(total_amount) > 5000);` | 高消费用户偏好品类 |
| Q50 | 复杂 | 平均会话时长最长的渠道对应的跳出率 | `SELECT channel, ROUND(AVG(avg_session_duration), 1) AS avg_dur, ROUND(AVG(bounce_rate), 3) AS avg_bounce FROM traffic GROUP BY channel ORDER BY avg_dur DESC LIMIT 1;` | 邮件营销 |
| Q51 | 复杂 | 每月销售额环比增长率 | `WITH monthly AS (SELECT SUBSTR(order_date,1,7) AS m, SUM(total_amount) AS s FROM orders GROUP BY m) SELECT m, s, ROUND((s - LAG(s) OVER(ORDER BY m)) * 100.0 / LAG(s) OVER(ORDER BY m), 1) AS growth_pct FROM monthly;` | 各月环比增长 |
| Q52 | 复杂 | 客单价高于品类平均值的订单 | `SELECT o.* FROM orders o JOIN (SELECT category, AVG(total_amount) AS avg_amt FROM orders GROUP BY category) ca ON o.category = ca.category WHERE o.total_amount > ca.avg_amt;` | 高于品类均值的订单列表 |
| Q53 | 复杂 | 从未被购买过的商品 | `SELECT p.product_name FROM products p WHERE p.product_id NOT IN (SELECT DISTINCT product_id FROM orders);` | 没有出现在订单表中的商品 |
| Q54 | 复杂 | RFM 分析：最近一次购买时间 + 购买频次 + 总金额 | `SELECT user_id, MAX(order_date) AS last_purchase, COUNT(*) AS frequency, SUM(total_amount) AS monetary FROM orders WHERE status = 'completed' GROUP BY user_id ORDER BY monetary DESC;` | 用户 RFM 排名 |
| Q55 | 复杂 | 流量转化率：每个渠道的访客数 vs 对应时段订单数 | `SELECT t.channel, SUM(t.unique_visitors) AS visitors, (SELECT COUNT(*) FROM orders WHERE order_date IN (SELECT date FROM traffic)) AS orders_in_period FROM traffic t GROUP BY t.channel;` | 各渠道流量与订单对照（注：此查询为近似，精确转化需要归因模型） |

---

## 3. 评测方法

### 3.1 自动化评测流程

```
1. 初始化：将 3 个 CSV 导入 SQLite 数据库
2. 遍历 benchmark 查询集：
   a. 将自然语言问题输入 DataLens
   b. 提取 AI 生成的 SQL
   c. 在标准 SQLite 上执行 AI 的 SQL
   d. 在标准 SQLite 上执行标准 SQL
   e. 对比结果集（行数 + 数值精度 ± 0.01）
3. 统计：
   - 总准确率
   - 分难度准确率
   - 分类型准确率（聚合/排序/筛选/分组/关联）
   - 失败用例列表及错误原因
```

### 3.2 准确率判定标准

| 级别 | 判定 |
|------|------|
| 完全正确 | 结果集行数相同，所有数值在 ± 0.01 内匹配 |
| 语义正确 | 结果语义等价（列名不同/排序不同但数据正确） |
| 部分正确 | 核心数据正确但缺少部分列或有多余列 |
| 错误 | 结果不一致或 SQL 执行报错 |

准确率统计时，"完全正确"和"语义正确"算通过。

### 3.3 回归策略

- 每次模型更换或 prompt 模板修改后，跑全量 55 条 benchmark
- 每次 SQL 引擎（SQLite/DuckDB）版本更新后，跑全量
- 结果存档，可追溯历史准确率变化趋势

---

## 4. 扩展计划

### 4.1 V2 追加查询

- 多 CSV JOIN 场景增加到 20 条
- 窗口函数查询（RANK/ROW_NUMBER/PARTITION BY）
- CTE（WITH 子句）复杂查询

### 4.2 数据扩展

- 生成 10 万行/100 万行版本用于性能测试
- 增加脏数据版本（空值/乱码/类型混乱）用于鲁棒性测试
- 增加英文版数据集用于多语言支持测试
