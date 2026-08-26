# UI Design Specification: Mindly AI Web Application

This document adapts the mobile UI design concept of **Mindly AI** into a responsive, desktop-first web application interface. It maintains the dark futuristic theme, neon color accents, and glassmorphism elements while optimizing the spatial layout for widescreen web layouts.

---

## 1. Design System & Tokens

### 1.1 Color Palette
*   **Primary Background:** `#090B0B` (Deep absolute matte black)
*   **Secondary Surface:** `#141717` (Dark charcoal for card structures)
*   **Accent Primary:** `#CFA921` (High-visibility cyber neon gold)
*   **Accent Secondary:** `#5C96A4` (Glow cyan / soft ambient blue)
*   **Text Primary:** `#CFD6E3` (Bright crisp off-white for body/headings)
*   **Text Secondary:** `#AEB5C0` (Muted slate gray for secondary metadata)

### 1.2 Typography
*   **Font Family:** `Inter`, `Cabinet Grotesk`, or clean geometric Sans-Serif font configurations.
*   **Scale:**
    *   `Display Title:` 40px / Line Height: 1.2 (Hero text)
    *   `Heading 1:` 28px / Line Height: 1.3 (Section titles)
    *   `Heading 2:` 20px / Line Height: 1.4 (Card headers)
    *   `Body Text:` 15px / Line Height: 1.5 (Standard reading)
    *   `Micro/Label:` 12px / Line Height: 1.4 (Chips, tooltips, tags)

### 1.3 Visual Effects
*   **Glassmorphism Layering:**
    *   `Background Blur:` `backdrop-filter: blur(16px);`
    *   `Surface Tint:` `background: rgba(20, 23, 23, 0.65);`
    *   `Card Borders:` `1px solid rgba(207, 214, 227, 0.08);` (Subtle white gradient stroke)
*   **Ambient Glow System:** Use layered radial gradients behind containers to replicate the soft, colorful backlighting effect seen in the reference material.

---

## 2. Web Layout Architecture

Unlike the vertical mobile application workflow, the desktop web platform scales horizontally into a **Three-Column Dashboard Structure** to utilize wide aspect ratios efficiently.

