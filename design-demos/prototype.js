// 独立原型只模拟样例单品，不读取或写入现有应用的数据。
const $ = id => document.getElementById(id);
const all = selector => Array.from(document.querySelectorAll(selector));
const initial = { mode:"discount", type:"ogl", selected:null, target:125, high:2.5, strike:1/0.6, purchase:30, domestic:3, pack:2, exchange:12 };
let state = { ...initial };
let result;
let messageTimer;
const numberKeys = ["target","purchase","domestic","pack","exchange"];
const cny = new Intl.NumberFormat("zh-CN",{style:"currency",currency:"CNY",minimumFractionDigits:2});
const rub = new Intl.NumberFormat("zh-CN",{maximumFractionDigits:0});
const money = value => Number.isFinite(value) ? cny.format(value).replace("CN¥","¥") : "—";
const rubles = value => Number.isFinite(value) ? "₽"+rub.format(value) : "—";
const ceil = value => Math.abs(value-Math.round(value)) <= Math.abs(value)*Number.EPSILON ? Math.round(value) : Math.ceil(value);
const set = (name, text) => all('[data-out="'+name+'"]').forEach(el=>el.textContent=text);
const getFactor = multiplier => state.mode==="discount" ? 10/multiplier : multiplier;
const otherFactor = multiplier => state.mode==="discount" ? "等效倍数 "+multiplier.toFixed(2)+" 倍" : "等效折扣 "+(10/multiplier).toFixed(2)+" 折";
const displayFactor = value => String(Number(value.toPrecision(10)));
const billWeight = ch => /取大|max|体积/.test(ch.billing) && ch.divisor ? Math.max(300,3000/ch.divisor*1000) : 300;
const shipping = ch => ch.fixed+ch.perGram*billWeight(ch);
const eligible = ch => state.target>0 && state.target>=ch.min && state.target<=ch.max && 300>=ch.minWeight && 300<=ch.maxWeight;
const fareDistance = ch => Math.max(ch.min-state.target,state.target-ch.max,0)+Math.max(ch.minWeight-300,300-ch.maxWeight,0);
function candidates(){
  if(state.type==="thirdParty")return SAMPLE.channels.filter(ch=>ch.type==="thirdParty").sort((a,b)=>shipping(a)-shipping(b));
  return ["pickup","dropoff"].map(handoff=>{
    const group=SAMPLE.channels.filter(ch=>ch.type==="ogl"&&ch.handoff===handoff).sort((a,b)=>fareDistance(a)-fareDistance(b)||shipping(a)-shipping(b));
    return group.find(eligible)||group[0];
  }).filter(Boolean);
}
function render(resetFields=false){
  if(resetFields)numberKeys.forEach(key=>{$(key).value=state[key];$(key).removeAttribute("aria-invalid");});
  const factorIds=[["highFactor","high"],["strikeFactor","strike"]];
  const discount=state.mode==="discount";
  factorIds.forEach(([id,key])=>{
    const input=$(id);
    if(resetFields||document.activeElement!==input) {
      input.value=displayFactor(getFactor(state[key]));
      input.removeAttribute("aria-invalid");
    }
    input.min=discount?"0":"1"; if(discount)input.max="10";else input.removeAttribute("max");
    input.parentElement.querySelector(".unit").textContent=discount?"折":"倍";
    input.setAttribute("aria-describedby","factorHelp");
  });
  all("[data-mode]").forEach(el=>el.setAttribute("aria-pressed",String(el.dataset.mode===state.mode)));
  all("[data-logistics]").forEach(el=>el.setAttribute("aria-pressed",String(el.dataset.logistics===state.type)));
  const price=state.target, fx=state.exchange;
  const shown=price>0;
  const high=shown?ceil(price*state.high):NaN, strike=shown?ceil(high*state.strike):NaN;
  set("targetCny",money(shown?price:NaN)); set("targetRub",rubles(shown?price*fx:NaN));
  set("exchangeNote","1 CNY = "+fx.toFixed(2)+" RUB"); set("high",money(high));set("highRub",rubles(high*fx));set("strike",money(strike));set("strikeRub",rubles(strike*fx));
  set("highEquivalent",otherFactor(state.high));set("strikeEquivalent",otherFactor(state.strike));
  const rows=candidates();
  const active=rows.filter(eligible);
  const selected=active.find(ch=>ch.id===state.selected)||active[0];
  state.selected=selected?.id ?? null;
  const body=$("channelRows");
  const rowKey=JSON.stringify(rows.map(ch=>[ch.id,eligible(ch),ch.id===state.selected]));
  if(body.dataset.key!==rowKey){
    body.dataset.key=rowKey;
    const focusedId=document.activeElement?.dataset.channel;
    body.replaceChildren(...rows.map(ch=>{
      const tr=document.createElement("tr");
      const on=ch.id===state.selected, valid=eligible(ch);
      if(on)tr.className="selected";
      const shortName=ch.type==="ogl"?(ch.handoff==="pickup"?"上门取件":"卖家自送"):ch.name.split(" ")[0]+" 快线";
      const first=tr.insertCell(); first.textContent=shortName;
      const info=document.createElement("small");info.textContent=ch.tier;first.append(info);
      tr.insertCell().textContent=ch.time;
      tr.insertCell().textContent=money(shipping(ch));
      const action=tr.insertCell(), button=document.createElement("button");
      button.type="button";button.dataset.channel=ch.id;button.disabled=!valid;
      button.textContent=on?"已选":valid?"选用":"超限";
      button.setAttribute("aria-label",shortName+" "+button.textContent);
      button.setAttribute("aria-pressed",String(on)); action.append(button);
      return tr;
    }));
    if(focusedId)all("[data-channel]").find(btn=>btn.dataset.channel===focusedId&&!btn.disabled)?.focus({preventScroll:true});
  }
  set("available",active.length+" 条可用");
  set("selectedName",selected?.name??"未匹配");
  set("shippingNote",!selected?(shown?"当前货值或重量超出此样例的渠道限制。暂不显示可发利润。":"填入目标售价后匹配渠道。"):
    state.type==="ogl"?"当前选择："+selected.name+"。电子服务费单独列入成本。":"当前选择："+selected.name+"。采用项目内置旧费率样例。");
  const transport=selected?shipping(selected):NaN;
  const oglFee=selected?(selected.type==="ogl"?Math.min(200,Math.max(15,price*fx*0.02))/fx:0):NaN;
  const goods=state.purchase+state.domestic+state.pack;
  const priceRub=Math.round(price*fx*100)/100;
  const commissionRate=(SAMPLE.tiers.find(t=>priceRub>=t.min&&(t.max==null||priceRub<=t.max))??SAMPLE.tiers.at(-1)).rate/100;
  const market=price*commissionRate+(price-price*commissionRate)*0.015+price*0.01;
  const returnCost=(state.purchase+state.domestic+transport)*0.05;
  const cost=goods+market+transport+oglFee+returnCost;
  const profit=price-cost;
  result={high,strike,transport,oglFee,goods,market,returnCost,cost,profit};
  set("profit",money(profit));set("margin",selected?(100*profit/price).toFixed(1)+"%":"—");
  set("cost",money(cost));set("shippingTotal",money(transport+oglFee));
  set("status",!selected?"缺少可用渠道":profit<0?"亏损预估":"可发试算");
  set("goods",money(goods));set("market",money(shown?market:NaN));set("transport",money(transport));set("oglFee",money(oglFee));set("return",money(returnCost));
  const bars={goods,market,shipping:transport+oglFee,return:returnCost,profit:Math.max(profit,0)};
  const total=Math.max(price,cost);
  all("[data-bar]").forEach(el=>{el.style.width=selected?(100*bars[el.dataset.bar]/total)+"%":"0%";});
  all('[data-action="download"]').forEach(btn=>btn.disabled=!selected);
}
function showStep(key,focus=false) {
  all("[data-panel]").forEach(el=>el.hidden=el.dataset.panel!==key);
  all(".step-nav [data-step]").forEach(el=>el.setAttribute("aria-current",el.dataset.step===key?"step":"false"));
  if(focus){
    const heading=$(key)?.querySelector("h2");if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    const top=document.querySelector(".step-nav").getBoundingClientRect().top+window.scrollY-12;
    if(window.scrollY>top+15)window.scrollTo({top,behavior:"instant"});
  }
}
function clearFeedback(){ $("factorHelp").hidden=true; }
document.addEventListener("input",event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement))return;
  const value=input.valueAsNumber;
  const mode=state.mode;
  if(input.id==="highFactor"||input.id==="strikeFactor"){
    const multiplier=mode==="discount"?10/value:value;
    const valid=Number.isFinite(multiplier)&&multiplier>=1&&(mode!=="discount"||value>0);
    input.setAttribute("aria-invalid",String(!valid));
    $("factorHelp").hidden=valid;
    $("factorHelp").textContent=(mode==="discount"?"请输入大于 0、且不超过 10 的折数。":"请输入至少 1 倍。")+"暂按上次有效值试算。";
    if(!valid)return;
    state[input.id==="highFactor"?"high":"strike"]=multiplier;
  }else if(numberKeys.includes(input.id)){
    const v=input.id==="target"&&!input.value?0:value;
    const valid=Number.isFinite(v)&&v>=Number(input.min);
    input.setAttribute("aria-invalid",String(!valid));
    if(!valid)return;
    state[input.id]=v;
  }else return;
  render();
});
document.addEventListener("focusout",event=>{
  const el=event.target;
  if(el instanceof HTMLInputElement&&el.getAttribute("aria-invalid")==="true"){
    if(el.id==="highFactor"||el.id==="strikeFactor"){el.value=displayFactor(getFactor(state[el.id==="highFactor"?"high":"strike"]));clearFeedback();}
    else if(numberKeys.includes(el.id))el.value=state[el.id];
    el.removeAttribute("aria-invalid");
  }
});
document.addEventListener("click",event=>{
  const button=event.target.closest("button");
  if(!button||button.disabled)return;
  if(button.dataset.mode){state.mode=button.dataset.mode;clearFeedback();render(true);}
  if(button.dataset.logistics){state.type=button.dataset.logistics;state.selected=null;render();}
  if(button.dataset.channel){state.selected=button.dataset.channel;render();}
  if(button.dataset.step)showStep(button.dataset.step,true);
  if(button.dataset.action==="reset"){state={...initial};clearFeedback();render(true);if(document.body.classList.contains("b"))showStep("price");}
  if(button.dataset.action==="download"){
    const rows=[["样例项目","金额（CNY）"],["目标售价",state.target],["最高价格",result.high],["划线价",result.strike],["物流运输费",result.transport.toFixed(2)],["OGL电子服务费",result.oglFee.toFixed(2)],["总成本",result.cost.toFixed(2)],["预估净利润",result.profit.toFixed(2)]];
    const data="\ufeff"+rows.map(row=>row.join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([data],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="跨境精算试算样例.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
function syncRail(){
  const current=window.location.hash||"#truck";
  all(".rail-nav a").forEach(link=>{
    if(link.getAttribute("href")===current)link.setAttribute("aria-current","location");
    else link.removeAttribute("aria-current");
  });
}
window.addEventListener("hashchange",syncRail);
syncRail();
render(true);
