"""生成三份离线排版原型，并用 Edge 验证高频区、折叠和手机端。"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent.resolve()
SHOTS = ROOT / "screenshots"
SHOTS.mkdir(exist_ok=True)
original = (ROOT.parent / "legacy-refresh" / "a.html").read_text(encoding="utf-8")
css = (ROOT / "layout.css").read_text(encoding="utf-8")
js = (ROOT / "layout.js").read_text(encoding="utf-8")
names = {"a": "报价与利润同屏", "b": "商品参数先行", "c": "六档方案先行"}

for key, name in names.items():
    doc = re.sub(r"<title>.*?</title>", f"<title>{name}｜紧凑布局初稿</title>", original, count=1)
    doc = doc.replace('data-look="a"', f'data-look="a" data-layout="{key}"', 1)
    doc = doc.replace("</style>", css + "</style>", 1)
    doc = doc.replace("</body>", f"<script>{js}</script></body>", 1)
    (ROOT / f"{key}.html").write_text(doc, encoding="utf-8")

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="msedge")
    for key, name in names.items():
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto((ROOT / f"{key}.html").as_uri())
        page.evaluate("document.fonts.ready")
        assert page.locator('[data-ui="grid"]>[data-column]').count() == 3
        assert page.locator(".layout-tier-table tbody tr").count() == 6
        assert page.locator('[data-ui="channel-card"]').count() == 2
        assert page.locator('[data-ui="metrics"]').get_by_text("¥57.1", exact=True).count() == 1
        assert page.locator("#target-price-rmb").input_value() == "125"
        # 三个独立栏都不能靠滚动才能看到主要数据。
        for sel in ["#target-price-rmb", ".layout-tier-table tbody tr:last-child", '[data-ui="channel-card"]:last-of-type']:
            loc = page.locator(sel)
            if not loc.count():
                loc = page.locator('[data-ui="channel-card"]').last
            rect = loc.bounding_box()
            assert rect and rect["y"] >= 0 and rect["y"] + rect["height"] <= 900, f"{name}：{sel} 超出首屏"
        assert page.locator("[data-section=ads]").get_attribute("open") is None
        assert page.locator(".layout-more-pricing").get_attribute("open") is None
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        page.screenshot(path=str(SHOTS / f"{key}.png"), animations="disabled")
        page.locator(".layout-more-pricing > summary").click()
        assert page.locator(".layout-more-pricing").get_attribute("open") is not None
        page.locator(".layout-more-pricing > summary").click()
        page.locator(".layout-filter-extra > summary").click()
        assert page.locator(".layout-filter-extra").get_attribute("open") is not None
        page.locator(".layout-filter-extra > summary").click()
        if key != "a":
            page.locator(".layout-coefficients > summary").click()
            assert page.locator(".layout-coefficients").get_attribute("open") is not None
        page.set_viewport_size({"width": 375, "height": 812})
        page.reload()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"{name} 手机端横向溢出"
        page.get_by_role("navigation", name="快速跳转到工作区").get_by_role("link", name="物流", exact=True).click()
        assert page.evaluate("location.hash") == "#layout-logistics"
        page.goto((ROOT / f"{key}.html").as_uri())
        page.screenshot(path=str(SHOTS / f"{key}-mobile.png"), animations="disabled", full_page=True)
        assert not errors, errors
        page.close()
        print(f"{key.upper()}：首屏关键区、桌面三栏、折叠操作与手机宽度均通过。")
    if (ROOT / "index.html").exists():
        gallery = browser.new_page(viewport={"width":1440,"height":860})
        gallery.goto((ROOT / "index.html").as_uri())
        for key in ("b","c","a"):
            gallery.locator(f'[data-choice="{key}"]').click()
            assert gallery.locator("#open-draft").get_attribute("href") == f"{key}.html"
            gallery.locator("#preview").evaluate("(img)=>img.decode()")
        gallery.screenshot(path=str(SHOTS / "overview.png"), animations="disabled", full_page=True)
    browser.close()
