# Design System — "Terminal Chic" Landing Page

Reference doc based on analysis of a monospace-driven tech-brutalist landing page, adapted with a new color palette.

## Color Palette

| Role | Original | New |
|---|---|---|
| Background | `#F3F3EE` (warm off-white) | `#1774EE` (bold blue) |
| Accent | Orange-red (~`#FF4500`) | `#FDE74C` (bright yellow) |
| Primary text (UI/nav) | Near-black | Near-white / off-white (for contrast on blue bg) |
| Secondary text (headline copy) | Muted warm gray | Muted light blue-gray (for contrast on blue bg) |

> **Note:** Swapping the background from a light cream to a saturated blue changes the contrast needs. The original design paired dark text on a light background — on `#1774EE`, text colors should flip to light/white tones to stay legible. The accent (`#FDE74C` yellow) will pop strongly against the blue, arguably even more than the original orange did against cream, since yellow-on-blue is a very high-contrast complementary pairing.

## Typography

- **UI / system font:** Monospace (nav links, announcement ticker, CTA button, labels). Reinforces an engineering/terminal feel.
- **Display font:** Rounded, humanist sans-serif for large headline copy. Soft and friendly, deliberately contrasting with the monospace UI chrome.
- Two-tier system: hard/technical mono for functional UI, warm/human sans for message-driven copy.

## Layout Structure

1. **Top bar:** Thick 1–2px solid border across the very top of the viewport.
2. **Nav row:** Logo (left) + monospace nav links (right) + pill-style outlined CTA button (accent-colored border and text, transparent fill).
3. **Announcement ticker:** Thin horizontal bar below nav, monospace text, with an accent-colored "Read more >" link.
4. **Hero content area:** Large open canvas with generous negative space.
   - Left-aligned stacked text lines, one short sentence per line.
   - Progressive fade: earlier/entry lines slightly more opaque, later lines fade lighter — implies scroll-triggered reveal animation.
   - Big line-height between sentence groups to create rhythm/pacing.
5. **Decorative elements:** Small accent-colored rectangles/squares scattered asymmetrically around the canvas (varying sizes, no strict grid alignment) — evokes circuit traces or falling data bits.

## Component Notes

- **CTA button:** Pill/outline style — transparent background, accent-colored border and label text, monospace font, rounded corners.
- **Ticker bar:** Full-width, bordered top and bottom with hairlines, monospace uppercase text, accent-colored link on the right.
- **Headline text block:** No containers/cards — pure typography on open background, left-aligned, one clause per line.

## Style Classification

A blend of:
- **Neo-brutalism / tech-brutalism** — raw borders, monospace UI chrome, unpolished functional look.
- **Swiss/International Typographic Style** — strict grid discipline, generous whitespace, left-aligned type stacks.
- **Terminal/engineering aesthetic** — monospace fonts and status-bar layouts borrowed from developer tools, common among AI-infrastructure brands to signal a build-for-engineers identity.

## Implementation Checklist

- [ ] Set page background to `#1774EE`
- [ ] Set all accent elements (CTA border/text, ticker link, decorative rectangles, logo mark) to `#FDE74C`
- [ ] Flip primary/secondary text colors to light tones for contrast against the new blue background
- [ ] Apply monospace font to nav, ticker, and buttons
- [ ] Apply rounded humanist sans-serif to hero headline copy
- [ ] Build hero as stacked left-aligned lines with scroll-fade-in behavior
- [ ] Scatter small accent-colored rectangles asymmetrically across the hero canvas