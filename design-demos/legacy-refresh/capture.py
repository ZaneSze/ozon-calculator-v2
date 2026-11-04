"""从当前本地计算器捕获样例页面，为同一份 DOM 生成三个独立视觉稿。"""
import base64
import html
import re
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
SHOTS = ROOT / "screenshots"
ORIGIN = "http://127.0.0.1:3000/"
SKIN = (ROOT / "skin.css").read_text(encoding="utf-8")
LABELS = {"a": "紧凑规整", "b": "清晰分区", "c": "低彩专业"}
SHOTS.mkdir(exist_ok=True)

# 捕获数据来自干净浏览器上下文，不使用卖家已有数据或配置。
MARK = r"""() => {
    const main = document.querySelector('main');
    const [metrics,grid] = main.children;
    const [inputs,finance,shipping] = grid.children;
    const root = main.closest('.min-h-screen');
    const toolbar = root.querySelector('header');
    const tag = (el, mark) => { if(el) el.dataset.ui = mark; return el; };
    const activeBadge = (el) => {if(el)el.dataset.draftBadge='';};
    tag(root,'root');tag(toolbar,'toolbar');tag(metrics,'metrics');tag(grid,'grid');
    tag(inputs,'inputs');tag(finance,'finance');tag(shipping,'shipping');
    [inputs,finance,shipping].forEach(el=>el.dataset.column='');
    tag(shipping.children[0],'shipping-filter');
    if(shipping.children[1]?.textContent.includes('当前计算物流'))tag(shipping.children[1],'channel-current');
    const ogl = [...shipping.querySelectorAll('p')].find(el=>el.textContent.startsWith('费用 = 运输费'));
    tag(ogl?.parentElement,'ogl-info');
    for(const ch of shipping.querySelectorAll('div[aria-pressed]')){
      if(!ch.querySelector('h3'))continue;
      tag(ch,'channel-card');if(ch.getAttribute('aria-pressed')==='true'){
        ch.dataset.selected='';
        [...ch.querySelectorAll('span,div')].filter(el=>el.textContent.trim()==='当前计算'||el.textContent.trim()==='已选中').forEach(activeBadge);
        if(ch.firstElementChild?.getAttribute('aria-hidden')==='true')ch.firstElementChild.dataset.draftStripe='';
      }
      tag(ch.querySelector('h3')?.parentElement?.nextElementSibling?.firstElementChild,'amount');
    }
    const cards = [...finance.querySelectorAll('h3')];
    const cost = cards.find(e=>e.textContent==='核心财务指标')?.closest('.bg-card');
    if(cost){
      cost.dataset.slot='card';
      const fill = tag(cost.querySelector('.h-14'),'cost-fill');
      const legend = tag(fill?.nextElementSibling,'cost-legend');
      [...(fill?.children||[])].forEach((el,i)=>{
        const label=el.getAttribute('title')||'';
        const type=label.startsWith('净利润')?'profit':label.startsWith('采购')?'purchase':null;
        if(type){el.dataset.color=type;if(legend?.children[i]?.firstElementChild)legend.children[i].firstElementChild.dataset.color=type;}
      });
    }
    const tierTitle = cards.find(e=>e.textContent.startsWith('定价建议矩阵'));
    const tierCard = tierTitle?.closest('.bg-card');
    if(tierCard){
      tierCard.dataset.slot='card';
      const tiers = [...tierCard.querySelectorAll('[role=button]')];
      tag(tiers[0]?.parentElement,'matrix');
      tiers.forEach(t=>{
        tag(t,'tier');
        const badge=[...t.querySelectorAll('span')].find(el=>el.textContent==='推荐'||el.textContent==='当前');
        if(badge){t.dataset.recommended='';activeBadge(badge);}
        if(t.querySelector('.text-xl'))tag(t.querySelector('.text-xl'),'tier-price');
      });
    }
    for (const block of finance.querySelectorAll('div.bg-card')) if(block.querySelector('h3'))block.dataset.slot='card';
    tag([...inputs.querySelectorAll('fieldset')].find(e=>e.querySelector('legend')?.textContent.includes('划线价')),'price-settings');
    for(const button of root.querySelectorAll('button')){
      if(button.closest('#global-diagnostic-bar')||button.querySelector('svg.lucide-copy')||button.getAttribute('title')?.startsWith('复制'))continue;
      const currency=/^[¥₽]$/.test(button.textContent.trim()) && button.closest('[data-ui="inputs"]');
      if(button.closest('header')||button.hasAttribute('data-active')||button.hasAttribute('aria-pressed')||button.getAttribute('role')==='combobox'||currency){
        button.dataset.draftControl='';
      }
      if(button.hasAttribute('data-draft-control')&&(button.classList.contains('bg-blue-600')||button.classList.contains('bg-indigo-500')))button.dataset.draftActive='';
      if(button.querySelector('.lucide-rotate-ccw'))button.dataset.reset='';
    }
    return [root.outerHTML,document.body.className];
}"""

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="msedge")
    source = browser.new_page(viewport={"width": 1440, "height": 900})
    source.add_init_script("""localStorage.setItem('ozon_exchange_rate_cache',JSON.stringify({rate:12,timestamp:Date.now()}));""")
    source.goto(ORIGIN, wait_until="load")
    source.get_by_role("heading", name="核心财务指标", exact=True).wait_for()
    source.get_by_role("button", name="官方 OGL 物流", exact=True).click()
    source.get_by_text("当前计算物流", exact=True).wait_for()
    source.evaluate("document.fonts.ready")
    metrics_text = source.locator("main > section").first.inner_text()
    source.screenshot(path=str(SHOTS / "before.png"), animations="disabled")

    css = []
    for href in source.locator('link[rel="stylesheet"]').evaluate_all("(links) => links.map(x => x.href)"):
        raw = source.request.get(href).text()
        def embed(match):
            target = urljoin(href, match.group(1).strip("'\""))
            if not target.startswith(ORIGIN):
                return match.group(0)
            res = source.request.get(target)
            if not res.ok:
                raise RuntimeError("找不到样式资源：" + target)
            media = "font/woff2" if target.endswith(".woff2") else "application/octet-stream"
            return f"url(data:{media};base64,{base64.b64encode(res.body()).decode('ascii')})"
        css.append(re.sub(r"url\(([^)]+)\)", embed, raw))
    tree, body_class = source.evaluate(MARK)
    for key, label in LABELS.items():
        output = ROOT / f"{key}.html"
        doc = (
            '<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{label}｜旧版界面优化稿</title><style>{"".join(css)}\n{SKIN}</style>'
            f'<body class="{html.escape(body_class)}" data-look="{key}">{tree}'
            '<script>document.querySelectorAll("input").forEach(el=>{el.readOnly=true});'
            'document.querySelectorAll("a").forEach(el=>el.addEventListener("click",e=>e.preventDefault()));'
            '</script></body></html>'
        )
        output.write_text(doc, encoding="utf-8")
        page = browser.new_page(viewport={"width":1440,"height":900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(output.as_uri())
        page.evaluate("document.fonts.ready")
        page.locator('[data-ui="grid"] > [data-column]').last.wait_for(timeout=5000)
        assert page.locator('[data-ui="grid"] > [data-column]').count() == 3
        assert page.locator('[data-ui="tier"]').count() == 6
        assert page.locator('[data-ui="metrics"]').inner_text() == metrics_text
        assert page.get_by_role("button", name="官方 OGL 物流", exact=True).get_attribute("aria-pressed") == "true"
        assert page.locator('[data-ui="price-settings"]').get_by_text("等效倍数：1.67 倍").count() == 1
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        page.screenshot(path=str(SHOTS / f"{key}.png"), animations="disabled")
        page.locator('[data-ui="price-settings"]').evaluate("(el)=>el.scrollIntoView({block:'center'})")
        page.screenshot(path=str(SHOTS / f"{key}-pricing.png"), animations="disabled")
        product = page.locator('[data-ui="inputs"] details').first
        product.locator('summary').click()
        assert product.get_attribute("open") is None
        product.locator('summary').click()
        assert product.get_attribute("open") is not None
        page.set_viewport_size({"width":375,"height":812})
        page.reload()
        page.evaluate("document.fonts.ready")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "手机端发生横向溢出"
        page.screenshot(path=str(SHOTS / f"{key}-mobile.png"), animations="disabled")
        assert not errors, errors
        print(f"{key.upper()}：三栏、原有定价与物流位置、折叠及手机宽度均核对通过。")
        page.close()
    gallery = browser.new_page(viewport={"width":1440,"height":840})
    gallery.goto((ROOT / "index.html").as_uri())
    for key in ("b","c","a"):
        gallery.locator(f'[data-choice="{key}"]').click()
        assert gallery.locator("#layout-link").get_attribute("href") == f"{key}.html"
        gallery.locator("#draft-image").evaluate("(image)=>image.decode()")
    gallery.screenshot(path=str(SHOTS / "comparison.png"), animations="disabled", full_page=True)
    browser.close()
