# 样例事实与来源

- 本轮页面针对工作区的 Ozon 利润计算器，基线为当前仓库与本地页面截图；已有定价名称、两段系数、倍数／折扣切换及两位等效显示。
- 官方 Ozon 平台及品牌通过 [Ozon 企业站](https://corp.ozon.com/media) 和 [Brandlab](https://brandlab.ozon.ru/en) 核对。这个原型是卖家工作台概念，不是官方 Ozon 页面。
- 佣金、第三方运费与 OGL 运费均读取仓库现有样例数据，分别在 `lib/default-data.ts` 和 `lib/ogl-default-data.ts`。原始 OGL 工作簿在 `public/data/OGL_2026-08-24.xlsx`。本轮没有核验费率最新版本，样例不用于真实报价。
- 默认场景选 OGL 上门取件，运输费 ¥10.31、电子服务费 ¥2.50、总成本约 ¥67.88、预估净利 ¥57.12。样例费率与状态按试算输入变化；超限时不展示可发利润。
- 设计事实参照：[Linear Board layout 官方文档](https://linear.app/docs/board-layout)。已查看并本地保存其看板分组截图；借用分组和进度的组织方式。
