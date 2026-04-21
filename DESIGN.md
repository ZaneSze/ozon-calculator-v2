# Ozon rFBS 跨境精算系统 - DESIGN.md

> Inspired by Linear - Ultra-minimal precision with developer-centric dark theme

## 1. Visual Theme & Atmosphere

### Mood
- **Precision-first**: Every number matters in financial calculations
- **Developer tool**: Dense information, functional over decorative
- **Professional**: Serious business tool for cross-border e-commerce

### Density
- High information density in dashboard and logistics views
- Compact cards with clear hierarchy
- Data-dense tables with hover states

### Philosophy
- "What you see is what you get" - transparent calculation logic
- No decorative elements - every pixel serves a purpose
- Instant feedback on parameter changes

---

## 2. Color Palette & Roles

### Semantic Colors

| Token | Hex | Role | Usage |
|-------|-----|-----|-------|
| `--primary` | `#6366F1` | Purple accent | Buttons, links, active states |
| `--foreground` | `#0F0F0F` | Primary text | Headings, key numbers |
| `--secondary-foreground` | `#3F3F46` | Body text | Descriptions, labels |
| `--muted-foreground` | `#71717A` | Secondary text | Hints, timestamps |
| `--profit-positive` | `#10B981` (emerald-500) | Profit indicator | Positive numbers, gains |
| `--profit-negative` | `#EF4444` (red-500) | Loss indicator | Negative numbers, losses |
| `--warning` | `#F59E0B` (amber-500) | Warnings | Alerts, boundary conditions |
| `--border` | `#E4E4E7` | Dividers | Cards, sections |

### Backgrounds

| Token | Hex | Role |
|-------|-----|------|
| `--background` | `#FFFFFF` | Page background |
| `--card` | `#FAFAFA` | Card surfaces |
| `--secondary` | `#F4F4F5` | Input backgrounds |
| `--muted` | `#F4F4F5` | Disabled states |

### Color Usage Rules

```
✅ DO:
  - Use profit-positive (green) for: net profit > 0, ROI > 0, margin > 0
  - Use profit-negative (red) for: net profit < 0,亏损, 超限
  - Use primary (purple) for: CTAs, selected states, links
  - Use warning (amber) for:计抛, 广告超支, 货值拦截

❌ DON'T:
  - Use red for "delete" actions (use outline variant)
  - Use gradient backgrounds on cards
  - Use color as primary decoration
```

---

## 3. Typography Rules

### Font Stack

```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-xs` | 11px | 500 | 1.4 | Badges, pills |
| `--text-sm` | 13px | 400 | 1.5 | Labels, secondary info |
| `--text-base` | 14px | 400 | 1.5 | Body text |
| `--text-lg` | 16px | 500 | 1.4 | Card titles |
| `--text-xl` | 18px | 600 | 1.3 | Section headers |
| `--text-2xl` | 24px | 700 | 1.2 | Page titles |

### Number Display

- Key numbers (净利, ROI, 售价): Use `--text-lg` / `--text-xl` bold
- Currency symbols: Small, muted color
- Large tables: Right-aligned, monospace variant available

### Chinese Typography

- Use system-ui for best CJK support
- Letter-spacing: -0.01em for Chinese headings
- Avoid justified text (use left-aligned)

---

## 4. Component Stylings

### Buttons

| Variant | Background | Text | Border | Use Case |
|---------|------------|------|--------|----------|
| `primary` | `--primary` (purple) | white | none | Primary CTAs |
| `outline` | transparent | `--foreground` | 1px `--border` | Secondary actions |
| `ghost` | transparent | `--foreground` | none | Toolbar actions |
| `destructive` | `--destructive` (red) | white | none | Danger actions |

**States:**
- Hover: 10% darker background
- Active: 15% darker
- Disabled: 50% opacity, no interactions
- Focus: 2px ring with `--primary` at 30% opacity

### Input Fields

```css
background: var(--secondary);
border: 1px solid var(--border);
border-radius: 6px;
padding: 8px 12px;
font-size: 14px;
```

- Focus: border changes to `--primary`
- Error: border changes to `--destructive`, show error message below
- Disabled: muted background, no interaction

### Cards

```css
background: var(--card);
border: 1px solid var(--border);
border-radius: 8px;
padding: 16px;
```

- Hover: subtle shadow (0 2px 8px rgba(0,0,0,0.08))
- Selected: 2px `--primary` border

### Badges / Pills

```css
background: var(--secondary);
border-radius: 9999px; /* full */
padding: 2px 8px;
font-size: 11px;
font-weight: 500;
```

- Profit-positive variant: 10% green background, green text
- Profit-negative variant: 10% red background, red text

---

## 5. Layout Principles

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Inline spacing |
| `--space-2` | 8px | Component padding |
| `--space-3` | 12px | Section gaps |
| `--space-4` | 16px | Card padding |
| `--space-5` | 20px | Section margins |
| `--space-6` | 24px | Major sections |

### Grid System

- **12-column grid** for main layout
- **3-column** for dashboard widgets
- **4-column** for card grids
- Gutter: 12px (compact) or 16px (default)

### Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| `sm` | 640px | Single column, stacked |
| `md` | 768px | Two column |
| `lg` | 1024px | Full three-column |
| `xl` | 1280px | Full with expanded sidebar |

### Header

- **Height**: 48px (compact, sticky)
- **Background**: white with 80% opacity + blur
- **Border bottom**: 1px subtle border

---

## 6. Depth & Elevation

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12);
```

### Overlay

- Dialogs: backdrop blur 8px, background rgba(0,0,0,0.3)
- Dropdowns: shadow-lg, no backdrop blur

---

## 7. Do's and Don'ts

### Do

✅ **DO:**
- Use semantic colors for profit/loss indicators
- Keep header compact and information-dense
- Show all key metrics in header (净利, ROI, 毛利率, 成本, 售价)
- Provide instant feedback on input changes
- Use purple for primary actions and selections
- Keep logistics cards compact with critical info

### Don't

❌ **DON'T:**
- Use gradients (except gradient text for branding)
- Add decorative illustrations
- Use bright saturated colors beyond semantic tokens
- Add animations that slow down interactions
- Create modal dialogs for simple confirmations
- Hide calculation logic behind "advanced" toggles

---

## 8. Responsive Behavior

### Touch Targets

- Minimum touch target: 44px × 44px
- Button padding: 8px 16px minimum

### Collapsing Strategy

```
Desktop (>1024px):
  [Input Panel — 25%] [Dashboard — 42%] [Logistics — 33%]

Tablet (768-1024px):
  [Input Panel — Full] [Dashboard — Half] [Logistics — Half]

Mobile (<768px):
  Stacked layout: Input → Dashboard → Logistics
```

### Scroll Behavior

- Use scrollable containers with custom scrollbars
- Sticky header on scroll
- Smooth scroll disabled for performance

---

## 9. Agent Prompt Guide

### Quick Color Reference

```
Profit colors (use these for financial indicators):
- #10B981 (emerald) = positive profit / good
- #EF4444 (red) = negative profit / loss / error
- #F59E0B (amber) = warning / caution

Primary accent:
- #6366F1 (indigo/purple) = actions / selection
```

### Usage Examples

```
Good:
  "Make the net profit display emerald-500 when > 0"
  "Add a red pill badge when results show 亏损"
  "Style the selected logistics card with purple border"

Bad:
  "Add a gradient background to the header"
  "Use rainbow colors for different metrics"
  "Add bounce animation to the card"
```

---

## 10. Design Tokens (CSS Variables)

```css
:root {
  /* Colors */
  --primary: 252 91% 55%;
  --foreground: 240 10% 3.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
  --profit-positive: 142 71% 45%;
  --profit-negative: 0 72% 50%;
  --warning: 38 92% 50%;
  
  /* Spacing */
  --radius: 0.375rem;
  
  /* Typography */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```