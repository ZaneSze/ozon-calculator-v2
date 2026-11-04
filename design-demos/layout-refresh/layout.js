// 仅重排离线视觉稿中的 DOM，不连接工作台状态、计算、导入或导出。
const layout = document.body.dataset.layout;
const ui = (name, from = document) => from.querySelector('[data-ui="'+name+'"]');
const all = (selector, from = document) => [...from.querySelectorAll(selector)];
const make = (tag, className = "", text = "") => {
  const node = document.createElement(tag);
  if(className) node.className = className;
  if(text) node.textContent = text;
  return node;
};
const disclose = (title, nodes, className = "") => {
  const box = make("details","layout-details "+className);
  box.append(make("summary","",title));
  nodes.forEach(node=>{if(node)box.append(node);});
  return box;
};
const root = ui("root");
const left = ui("inputs");
const middle = ui("finance").firstElementChild;
const right = ui("shipping");
const settings = ui("price-settings");
const order = [...left.firstElementChild.firstElementChild.children];
const [product,cost,ads,price] = order;
const source = order[0].parentElement;
const pricing = settings.parentElement;
const [target,margin,,...secondaryPrice] = pricing.children;

// 低频设置收在同一区块内，已有设置和字段名称保留。
const advanced = disclose("竞品、预警、促销与税务",secondaryPrice,"layout-more-pricing");
pricing.append(advanced);
price.dataset.section="pricing";
product.dataset.section="product";
cost.dataset.section="cost";
ads.dataset.section="ads";
for(const box of [product,cost,ads])box.open=false;
price.open=true;
target.dataset.priority="target";
margin.dataset.priority="margin";
const explanation = [...settings.children].find(el=>el.tagName==="P"&&el.textContent.includes("反推"));
if(explanation)settings.insertBefore(disclose("系数怎么算",[explanation],"layout-formula"),settings.lastElementChild.nextSibling);
const coefficients = disclose("最高价格与划线价系数",[settings],"layout-coefficients");
const quotes = make("div","layout-quotes");
for(const label of ["最高价格","划线价"]){
  const valueLabel = all("div",settings).find(el=>el.childElementCount===0&&el.textContent.trim()===label);
  const amount = valueLabel?.nextElementSibling?.textContent.trim()||"—";
  const quote = make("div");
  quote.append(make("span","",label),make("strong","",amount));
  quotes.append(quote);
}
if(layout==="a"){
  pricing.insertBefore(settings,advanced); // 两段系数在首屏直接可见。
  source.append(price,product,cost,ads);
}else{
  coefficients.querySelector("summary").append(quotes);
  pricing.insertBefore(coefficients,advanced);
  if(layout==="b"){
    product.open=true;
    const rows = [...product.lastElementChild.firstElementChild.children];
    const category = disclose("类目与带电／带液",[rows[0],rows[1],rows[4]],"layout-product-extra");
    product.lastElementChild.firstElementChild.append(category);
    source.append(product,price,cost,ads);
  }else{
    source.append(price,cost,product,ads);
  }
}

// 六档价格收成可对齐的清单；所有原始卡片保留在明细。
const [finance,matrix,simulation,risk,advice] = [...middle.children];
const matrixList = ui("matrix");
const tiers = all('[data-ui="tier"]',matrixList);
matrix.dataset.layoutModule="matrix";
finance.dataset.layoutModule="finance";
const table = make("table","layout-tier-table");
const head = table.createTHead().insertRow();
const tableCols = ["方案","目标售价","利润率","最高价格","划线价"];
tableCols.forEach(label=>{const cell=make("th","",label);cell.scope="col";head.append(cell);});
const rows = table.createTBody();
for(const tier of tiers){
  const tr = rows.insertRow();
  if(tier.hasAttribute("data-recommended"))tr.dataset.recommended="";
  const [name,values] = tier.children;
  const back = tier.lastElementChild.firstElementChild;
  const display = [
    name.firstElementChild.textContent.trim(),
    values.children[0]?.textContent.trim()||"—",
    values.children[1]?.textContent.replace("利润率","").trim()||"—",
    back.children[0]?.lastElementChild?.textContent.trim()||"—",
    back.children[1]?.lastElementChild?.textContent.trim()||"—",
  ];
  display.forEach((value,i)=>{
    const cell=tr.insertCell();
    cell.textContent=value;
    if(i===0&&tier.hasAttribute("data-recommended")&&!value.includes("推荐"))cell.append(make("small","layout-rec","推荐"));
  });
}
const matrixContent=matrixList.parentElement;
matrixContent.insertBefore(table,matrixList);
matrixContent.append(disclose("各档详细报价、利润及复制位置",[matrixList],"layout-tier-extra"));
const chart=ui("cost-fill");
const chartInner=chart.parentElement;
const costSummary=chart.nextElementSibling.nextElementSibling;
costSummary.dataset.layoutPart="cost-summary";
const costCaption=chartInner.lastElementChild;
if(costCaption!==costSummary){
  const info=disclose("费用口径说明",[costCaption],"layout-cost-note");
  chartInner.append(info);
}
const advancedProfit=disclose("利润演练、汇率风险与广告影响",[simulation,risk],"layout-advanced-profit");
const further=disclose("运营建议",[advice],"layout-advice");
if(layout==="c")middle.prepend(matrix);
middle.append(advancedProfit,further);

// 渠道入口位置不变，先展示可用项和费用，再看计费限制与说明。
const filter=ui("shipping-filter");
const rules=ui("ogl-info");
const [filterHeading,mode,,providers,sort,valuation]=[...filter.children];
const filters=disclose("物流商筛选、货值口径与 OGL 规则",[providers,valuation,rules],"layout-filter-extra");
filter.append(filters);
const summary=ui("channel-current");
if(summary){
  const pick=summary.querySelector(".font-black");
  if(pick){summary.dataset.layoutPart="selected-route";summary.querySelector(".truncate")?.removeAttribute("title");}
}
const channelList=right.lastElementChild;
channelList.dataset.layoutPart="channel-list";
const banner=channelList.firstElementChild;
if(!banner.hasAttribute("data-ui"))banner.dataset.layoutPart="recommendation-note";
for(const channel of all('[data-ui="channel-card"]',channelList)){
  const children=[...channel.children];
  const billing=children.find(el=>el.tagName==="DETAILS");
  const longParts=children.filter(el=>el.classList.contains("grid-cols-2")||el===billing);
  channel.append(disclose("计费、重量和尺寸限制",longParts,"layout-channel-details"));
}
const blocked=channelList.lastElementChild;
if(!blocked.hasAttribute("data-ui")&&blocked.textContent.includes("不可用渠道")){
  const matches=blocked.textContent.match(/不可用渠道\s*\(\d+\)/);
  channelList.append(disclose(matches?.[0]||"不可用渠道",[blocked],"layout-blocked"));
}
if(layout==="c"&&summary){summary.classList.add("layout-subtle-route");}

// 小屏用页内定位代替连续滑动，仍是同一页和同一组模块。
const mobileNav=make("nav","layout-mobile-nav");
mobileNav.setAttribute("aria-label","快速跳转到工作区");
for(const [part,id,label] of [[left,"layout-params","参数"],[ui("finance"),"layout-results","利润与定价"],[right,"layout-logistics","物流"]]){
  part.id=id;
  const link=make("a","",label);
  link.href="#"+id;
  mobileNav.append(link);
}
root.querySelector("main").prepend(mobileNav);

// 辅助阅读：鼠标和键盘可展开；数据动作在视觉稿中保持无副作用。
document.querySelectorAll("input").forEach(el=>el.readOnly=true);
document.querySelectorAll("button").forEach(button=>button.addEventListener("click",event=>event.preventDefault()));
document.querySelectorAll("a:not(.layout-mobile-nav a)").forEach(link=>link.addEventListener("click",event=>event.preventDefault()));
