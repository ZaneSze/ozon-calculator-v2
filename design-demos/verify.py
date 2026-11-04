"""在 Windows Edge 检查单文件原型，生成供选择的截图。"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
SHOTS = ROOT / "screenshots"
SHOTS.mkdir(exist_ok=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="msedge")
    for direction in (1, 2, 3):
        source = (ROOT / f"dir-{direction}.html").resolve().as_uri()
        context = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.goto(source)
        assert page.locator('[data-out="highEquivalent"]').inner_text() == "等效倍数 2.50 倍"
        assert page.locator('[data-out="strikeEquivalent"]').inner_text() == "等效倍数 1.67 倍"
        assert page.locator('[data-out="profit"]').first.text_content() == "¥57.12"
        page.screenshot(path=str(SHOTS / f"dir-{direction}.png"), animations="disabled")
        page.screenshot(path=str(SHOTS / f"dir-{direction}-full.png"), animations="disabled", full_page=True)
        page.get_by_role("button", name="按倍数", exact=True).click()
        assert page.locator('[data-out="highEquivalent"]').inner_text() == "等效折扣 4.00 折"
        assert page.locator('[data-out="high"]').inner_text() == "¥313.00"
        page.locator("#target").fill("100")
        page.locator("#highFactor").fill("2")
        page.locator("#strikeFactor").fill("1.25")
        assert page.locator('[data-out="high"]').inner_text() == "¥200.00"
        assert page.locator('[data-out="strike"]').inner_text() == "¥250.00"
        page.locator("#highFactor").fill("0")
        assert "暂按上次有效值" in page.locator("#factorHelp").inner_text()
        page.get_by_role("button", name="按折扣", exact=True).click()
        assert page.locator("#highFactor").input_value() == "5"
        assert page.locator("#strikeFactor").input_value() == "8"
        if direction == 2:
            page.get_by_role("button", name="下一步：选择物流", exact=True).click()
            assert page.locator("#truck").is_visible() and not page.locator("#price").is_visible()
            page.screenshot(path=str(SHOTS / "dir-2-shipping.png"), animations="disabled")
        page.get_by_role("button", name="卖家自送 选用", exact=True).click()
        assert page.get_by_role("button", name="卖家自送 已选", exact=True).is_visible()
        page.get_by_role("button", name="第三方物流", exact=True).click()
        assert page.locator('[data-out="available"]').inner_text() == "0 条可用"
        page.get_by_role("button", name="官方 OGL", exact=True).click()
        assert page.locator('[data-out="available"]').inner_text() == "2 条可用"
        if direction == 2:
            page.get_by_role("button", name="下一步：核对利润", exact=True).click()
            assert page.locator("#report").is_visible() and not page.locator("#truck").is_visible()
            page.screenshot(path=str(SHOTS / "dir-2-review.png"), animations="disabled")
        with page.expect_download() as event:
            page.get_by_role("button", name="导出试算", exact=True).first.click()
        csv = Path(event.value.path()).read_text(encoding="utf-8-sig")
        assert "最高价格,200" in csv and "划线价,250" in csv
        page.get_by_role("button", name="重置样例", exact=True).click()
        assert page.locator("#target").input_value() == "125"
        page.set_viewport_size({"width": 375, "height": 812})
        page.goto(source)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"方向 {direction} 手机端横向溢出"
        page.screenshot(path=str(SHOTS / f"dir-{direction}-mobile.png"), animations="disabled", full_page=True)
        assert not errors, errors
        print(f"方向 {direction}：桌面、手机、定价切换、物流、导出和重置均通过。")
        context.close()
    overview = browser.new_page(viewport={"width": 1440, "height": 760})
    overview.goto((ROOT / "index.html").resolve().as_uri())
    assert overview.locator(".preview img").evaluate_all("(images) => images.every(image => image.complete && image.naturalWidth)")
    overview.screenshot(path=str(SHOTS / "overview.png"), animations="disabled", full_page=True)
    browser.close()
