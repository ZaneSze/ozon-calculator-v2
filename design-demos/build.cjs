// 从仓库内置样例取数据，生成可离线打开的单文件原型。
const fs = require("node:fs");
const path = require("node:path");
const { loadTsModule } = require("../scripts/ts-module-loader");
const { DEFAULT_SHIPPING_DATA, DEFAULT_COMMISSION_DATA } = loadTsModule("lib/default-data.ts");
const { DEFAULT_OGL_DATA } = loadTsModule("lib/ogl-default-data.ts");
const root = __dirname;
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const logoPath = path.join(root, "refs", "ozon-official.png");
const brand = fs.existsSync(logoPath) ? '<img alt="Ozon" width="74" height="24" src="data:image/png;base64,' + fs.readFileSync(logoPath).toString("base64") + '">' : '<span>Ozon</span>';
const channelFields = x => ({
  id:x.id, name:x.name, type:x.thirdParty === "OGL" ? "ogl" : "thirdParty",
  handoff:x.name.includes("自送") ? "dropoff" : "pickup",
  fixed:x.fixFee, perGram:x.varFeePerGram, min:x.minValue ?? 0, max:x.maxValue,
  minWeight:x.minWeight, maxWeight:x.maxWeight, time:x.deliveryTimeMin + "–" + x.deliveryTimeMax + " 天",
  tier:x.serviceTier, billing:x.billingType, divisor:x.volumetricDivisor,
});
const sample = {
  channels:[...DEFAULT_OGL_DATA, ...["ZTO", "ATC", "RETS"].map(name=>DEFAULT_SHIPPING_DATA.find(x=>x.name===name+" Express Small"))].map(channelFields),
  tiers:DEFAULT_COMMISSION_DATA.find(x=>x.primaryCategory==="电子产品" && x.secondaryCategory==="电子产品配饰").tiers
};
const icons = {
  price:'<path d="M3 10V4h6l8 8-6 6z"/><circle cx="6.5" cy="7" r="1"/>',
  truck:'<path d="M2 5h11v10H2zM13 8h3l3 3v4h-6"/><circle cx="6" cy="15" r="2"/><circle cx="16" cy="15" r="2"/>',
  report:'<path d="M4 3h12v16H4zM7 8h6m-6 4h6m-6 3h4"/>',
  reset:'<path d="M4 9a6 6 0 1 1 1 6M4 4v5h5"/>',
  download:'<path d="M10 2v11m-4-4 4 4 4-4M3 14v4h14v-4"/>',
};
const icon = name => '<svg class="icon" viewBox="0 0 21 21" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
const action = (key, label, extra="") => '<button type="button" data-action="'+key+'" '+extra+'>'+icon(key)+label+'</button>';
const steps = [["price","定价参数"],["truck","物流渠道"],["report","利润拆解"]];
const nav = (kind, first="price") => '<nav aria-label="工作区导航" class="'+kind+'">'+steps.map(([key,label],i)=>kind==="step-nav"
  ? '<button type="button" data-step="'+key+'" aria-current="'+(key===first ? 'step':'false')+'"><span class="step-no">'+(i+1)+'</span><span><b>'+label+'</b><small>'+["设定三档价格","挑选可发方案","核对单件成本"][i]+'</small></span></button>'
  : '<a href="#'+key+'">'+icon(key)+label+'</a>').join("")+'</nav>';
const header = () => '<header class="top"><div class="top-inner"><a class="wordmark" href="thumbs.html" aria-label="返回设计方向总览"><span class="brand">'+brand+'</span><strong>跨境精算工作台</strong></a><div class="top-actions"><span class="demo"><i></i>样例试算</span>'+action("reset","重置样例")+action("download","导出试算",'class="primary"')+'</div></div></header>';
const meta = '<div class="meta"><span>中国卖家 rFBS</span><span>电子产品配饰</span><span>20 × 15 × 10 cm</span><span>300 g</span></div>';
const field = (id,label,value,unit,min="0") => '<label class="field" for="'+id+'"><span>'+label+'</span><span class="field-box"><input id="'+id+'" type="number" inputmode="decimal" min="'+min+'" step="any" value="'+value+'"><span class="unit">'+unit+'</span></span></label>';
const form = () => '<div class="price-form"><div class="heading"><div><h2>定价参数</h2><p>从目标售价推算最高价格和划线价。</p></div></div><div class="field-pair">'
  + field("target","目标售价","125","CNY") + '<div class="fx-display"><span>折合卢布</span><strong data-out="targetRub">₽1,500</strong><small data-out="exchangeNote">1 CNY = 12.00 RUB</small></div></div>'
  + '<div class="factor-heading"><h3>计算方式</h3><div class="seg" role="group" aria-label="计算方式"><button type="button" data-mode="multiplier">按倍数</button><button type="button" data-mode="discount">按折扣</button></div></div>'
  + '<div class="field-pair factor-pair">'+field("highFactor","最高价格系数","4","折","0")+field("strikeFactor","划线价系数","6","折","0")
  +'<p class="hint">以目标售价为基准<br><span data-out="highEquivalent">等效倍数 2.50 倍</span></p><p class="hint">以最高价格为基准<br><span data-out="strikeEquivalent">等效倍数 1.67 倍</span></p></div>'
  + '<p id="factorHelp" class="inline-feedback" role="status" hidden></p><details><summary>商品成本与汇率</summary><div class="field-pair detail-fields">'+field("purchase","采购成本","30","CNY")+field("domestic","国内头程","3","CNY")+field("pack","包装费","2","CNY")+field("exchange","人民币兑卢布","12","RUB","0.01")+'</div></details></div>';
const quotes = () => '<div class="quote-ladder" aria-label="三档价格">'
  + [["目标售价","targetCny","targetRub"],["最高价格","high","highRub"],["划线价","strike","strikeRub"]].map(([label,key,rub])=>'<div class="quote"><span>'+label+'</span><strong data-out="'+key+'"></strong><small data-out="'+rub+'"></small></div>').join("")+'</div>';
const logistics = () => '<div class="heading"><div><h2>物流渠道</h2><p>按当前货值与 300 g 样例包裹匹配。</p></div><span class="badge" data-out="available"></span></div>'
  + '<div class="seg shipping-tabs" role="group" aria-label="物流类型"><button type="button" data-logistics="ogl">官方 OGL</button><button type="button" data-logistics="thirdParty">第三方物流</button></div>'
  + '<div class="table-wrap"><table><thead><tr><th scope="col">发运方案</th><th scope="col">时效</th><th scope="col">运输费</th><th scope="col">选择</th></tr></thead><tbody id="channelRows"></tbody></table></div>'
  + '<p class="channel-note" data-out="shippingNote"></p>';
const profit = () => '<div class="profit-box"><div class="profit-top"><h2>单件预估净利润</h2><span class="badge" data-out="status"></span></div><strong class="profit-number" data-out="profit"></strong>'
  + '<div class="profit-meta"><div><span>利润率</span><b data-out="margin"></b></div><div><span>总成本</span><b data-out="cost"></b></div><div><span>物流总费</span><b data-out="shippingTotal"></b></div></div>'
  + '<div class="profit-meter" aria-label="售价构成"><div data-bar="goods"></div><div data-bar="market"></div><div data-bar="shipping"></div><div data-bar="return"></div><div data-bar="profit"></div></div>'
  + '<div class="meter-legend"><span>成本与费用</span><span>净利润</span></div></div>';
const report = () => '<div class="heading"><div><h2>利润拆解</h2><p>单件金额（人民币）</p></div></div><dl class="ledger">'
  + [["goods","采购、头程与包装"],["market","佣金及支付／提现手续费"],["transport","物流运输费"],["oglFee","OGL 电子服务费"],["return","退货损耗预估"]].map(([key,label])=>'<div><dt>'+label+'</dt><dd data-out="'+key+'"></dd></div>').join("")+'</dl>'
  + '<p class="ledger-note">净利润 = 目标售价 − 总成本。样例未开启广告和税务模拟。</p>';
const intro = (title, subtitle) => '<div class="intro"><div><h1>'+title+'</h1><p>'+subtitle+'</p></div>'+meta+'</div>';
const foot = '<footer><a href="index.html">返回三版对比</a><span>独立原型，只使用内置样例，不写入现有工作台。</span></footer>';
const layouts = [
  {key:"a",label:"并排工作台",html:header()+'<main>'+intro("单品定价","调整售价、比较物流，同时核对每一笔成本。")+
    '<div class="a-grid"><div class="a-editor"><section id="price" class="surface">'+form()+quotes()+'</section><section id="truck" class="surface">'+logistics()+'</section></div><aside class="a-result">'+profit()+'<section id="report" class="surface">'+report()+'</section></aside></div>'+foot+'</main>'},
  {key:"b",label:"分步定价",html:header()+'<main>'+intro("单品定价流程","从报价到发货，再核对这件商品能留下多少利润。")+nav("step-nav")+
    '<div class="steps"><section id="price" class="step-panel" data-panel="price"><div class="b-price-grid">'+form()+'<aside class="b-quote"><h2>价格单</h2>'+quotes()+'<p>每一档价格按前一档反推，向上取整到元。</p></aside></div><div class="step-actions"><button class="primary" data-step="truck">下一步：选择物流</button></div></section>'+
    '<section id="truck" class="step-panel" data-panel="truck" hidden>'+logistics()+'<div class="step-actions"><button data-step="price">返回定价</button><button class="primary" data-step="report">下一步：核对利润</button></div></section>'+
    '<section id="report" class="step-panel" data-panel="report" hidden><div class="b-review">'+profit()+'<div>'+report()+'</div></div><div class="step-actions"><button data-step="truck">返回物流</button>'+action("download","导出试算",'class="primary"')+'</div></section></div>'+
    '<div class="b-live"><div><span>目标售价</span><b data-out="targetCny"></b></div><div><span>当前物流</span><b data-out="selectedName"></b></div><div><span>预估净利</span><b data-out="profit"></b></div></div>'+foot+'</main>'},
  {key:"c",label:"渠道控制台",html:header()+'<div class="c-shell"><aside class="rail"><p>单品试算</p>'+nav("rail-nav")+'<div class="rail-context"><span>电子产品配饰</span><strong>300 g</strong><small>20 × 15 × 10 cm</small></div></aside><main>'+intro("发货方案比较","切换物流口径，对照报价与单件利润。")+
    '<div class="c-grid"><section id="truck" class="surface">'+logistics()+'</section><aside class="c-profit">'+profit()+'</aside><section id="price" class="surface">'+form()+quotes()+'</section><section id="report" class="surface">'+report()+'</section></div>'+foot+'</main></div>'}
];
for (const [index, layout] of layouts.entries()) {
  const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+layout.label+'｜跨境精算原型</title><style>'+read("prototype.css")+'</style></head><body class="'+layout.key+'">'+layout.html+'<script>const SAMPLE='+JSON.stringify(sample)+';\n'+read("prototype.js")+'</script></body></html>';
  fs.writeFileSync(path.join(root,"dir-"+(index+1)+".html"),html);
}
