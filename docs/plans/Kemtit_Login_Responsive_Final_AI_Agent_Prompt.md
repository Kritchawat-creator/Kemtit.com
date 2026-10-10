# Kemtit.com — Responsive Login UI Redesign Prompt
## Approved Direction: Lifestyle & Inspiring — Responsive Final Concept

You are working on the **Kemtit.com** codebase.

Your task is to redesign and implement the existing **Login page UI** based on the approved responsive concept shown in the latest visual mockup.

The final implementation must support:

- Desktop
- Tablet
- Mobile

The three viewport families must **share the same visual identity but use different compositions**.

Do NOT implement Desktop first and merely scale it down.

---

# 1. Goal

Create a polished, professional, production-ready login experience for Kemtit.

The visual direction is:

> **Modern Minimal + Lifestyle + Inspiring + Personal Productivity**

The login page should feel:

- Calm
- Professional
- Premium
- Personal
- Warm
- Trustworthy
- Modern
- Easy to understand
- Suitable for daily use

Avoid a generic SaaS/admin login appearance.

---

# 2. Approved Responsive Direction

Use these three compositions:

```text
Desktop >= 1152px
────────────────────────────
Lifestyle / Brand panel | Login panel


Tablet 768px – 1151px
────────────────────────────
Brand + lifestyle hero
Illustration
Login card below


Mobile <= 767px
────────────────────────────
Compact brand
Compact lifestyle hero
Small illustration
Soft login card
```

Important:

> Desktop, Tablet, and Mobile are intentionally different compositions.

Do not force the same layout into all screen sizes.

---

# 3. Scope Guardrails

## DO NOT change

Do not modify:

- Authentication architecture
- Authentication providers
- OTP logic
- Email authentication logic
- Google authentication logic
- API behavior
- Supabase behavior
- Redirect rules
- Existing validation rules
- Session handling
- Database behavior
- Existing authentication routes
- Existing registration logic
- Security behavior

This task is primarily:

```text
UI
UX presentation
responsive layout
spacing
hierarchy
visual consistency
```

Preserve existing functionality.

---

# 4. Existing Login Flow

The current Login page includes concepts such as:

```text
เข้าสู่ระบบ

รับรหัสยืนยัน 6 หลักทางอีเมล
ไม่ต้องใช้รหัสผ่าน

อีเมล
[email input]

ส่งรหัสยืนยัน

หรือ

เข้าสู่ระบบด้วย Google

privacy / consent copy

เริ่มใช้งานครั้งแรก?
สมัครใช้งาน
```

Preserve this authentication flow.

Do not introduce a password field if the application currently uses email OTP.

Do not add fake social providers.

---

# 5. Brand Header

The Kemtit brand area should contain:

```text
[Brand Logo] Kemtit
             เปลี่ยนเป้าใหญ่ทั้งปี
             ให้เป็นสิ่งที่ต้องทำวันนี้
```

or the existing localized equivalent.

Use the project's existing `BrandLogo` component where possible.

## Brand sizing

### Desktop
- Logo icon: 48–56px
- Brand name: 28–32px, semibold/bold

### Tablet
- Logo: 40–48px
- Brand name: 22–26px

### Mobile
- Logo: 36–42px
- Brand name: 20–24px

Do not allow the logo block to dominate the Mobile screen.

---

# 6. Main Lifestyle Message

Use the core message:

```text
ก้าวเล็ก ๆ
ชีวิตที่ดีขึ้น
```

English equivalent may be:

```text
Small steps.
A better life.
```

or approved existing translation.

## Typography hierarchy

### Desktop
- First line: 40–48px, `text-text-primary`
- Second line: 44–52px, `text-brand-500` / `brand-600`

### Tablet
- 34–40px

### Mobile
- 28–32px

The second line should carry the brand accent.

Do not use gradient text.

---

# 7. Lifestyle Supporting Copy

Use a concise lifestyle message.

Example:

```text
จัดการเวลา เป้าหมาย และทุกเรื่องในชีวิต
ในแบบของคุณ
```

For Tablet/Mobile this can be shortened to:

```text
จัดการชีวิตในแบบของคุณ
ทุกที่ ทุกเวลา
```

Avoid long marketing paragraphs.

---

# 8. Lifestyle Benefits

Desktop may show 3–4 benefit rows.

Example:

```text
จัดการเวลาได้ดีขึ้น
ดูแลสุขภาพและความสมดุล
ทำเป้าหมายให้เป็นจริง
สร้างชีวิตที่คุณต้องการ
```

Use small icons.

Use subtle semantic accent colors.

Do NOT make this look like sidebar navigation.

---

# 9. Lifestyle Illustration

The latest approved direction includes a soft landscape / sunrise illustration.

Preferred visual theme:

```text
sunrise
soft mountains
lavender / blue landscape
small natural foliage
calm editorial illustration
```

Possible subtle handwritten decorative phrase:

```text
Small Steps
Brighter Days
```

or:

```text
A Better You,
Everyday
```

The illustration must:
- Support the brand
- Stay visually soft
- Avoid dominating the form
- Remain low contrast behind text
- Never reduce accessibility
- Not look like a gaming splash screen
- Not look like an advertisement

If no approved static image exists in the repository, prefer CSS shapes, lightweight SVG illustration, or a locally stored optimized asset. Do not introduce a heavy remote stock photo.

---

# 10. Desktop Layout

Breakpoint:

```text
>= 1152px
```

Use a two-column fullscreen composition.

Suggested:

```text
grid-template-columns:
  minmax(0, 1.1fr)
  minmax(460px, 0.9fr)
```

or approximately:

```text
58% / 42%
```

The lifestyle panel should be visually wider than the form panel.

---

# 11. Desktop — Left Panel

The left panel includes:

```text
Brand
Tagline

Small eyebrow:
A BETTER YOU, EVERYDAY

Main lifestyle headline

Supporting copy

Benefit list

Lifestyle illustration
```

Use the illustration toward the bottom.

The left side should feel like a cohesive visual scene.

Avoid placing everything inside separate cards.

---

# 12. Desktop — Right Login Panel

The login form occupies the right panel.

The background can remain `bg-bg-surface` or a slightly differentiated neutral surface.

Suggested card:
- Width: 420–480px
- Padding: 28–36px
- Border radius: 18–24px
- Border: subtle
- Shadow: restrained

Do not create a giant floating card.

---

# 13. Desktop Form Hierarchy

Structure:

```text
เข้าสู่ระบบ

รับรหัสยืนยัน 6 หลักทางอีเมล
ไม่ต้องใช้รหัสผ่าน

อีเมล
[input]

[ส่งรหัสยืนยัน]

────── หรือ ──────

[Google login]

privacy / consent text

ยังไม่มีบัญชี?
สมัครใช้งาน
```

Recommended spacing:
- Header → description: 8px
- Description → fields: 24–28px
- Label → input: 6–8px
- Input → CTA: 16–20px
- CTA → divider: 24–28px
- Divider → Google: 20px
- Google → consent: 24px
- Consent → register: 28–32px

---

# 14. Tablet Layout

Breakpoint:

```text
768px – 1151px
```

Tablet must NOT use a squeezed Desktop split layout.

Instead, use:

```text
Brand header
Lifestyle hero
Illustration
Login card below
```

Example:

```text
┌───────────────────────────────┐
│ Kemtit               ไทย     │
│                               │
│ ก้าวเล็ก ๆ                    │
│ ชีวิตที่ดีขึ้น                 │
│                               │
│ จัดการชีวิตในแบบของคุณ        │
│ ทุกที่ ทุกเวลา                 │
│                               │
│      soft sunrise artwork     │
│                               │
│ ┌───────────────────────────┐ │
│ │ เข้าสู่ระบบ               │ │
│ │                           │ │
│ │ Email                     │ │
│ │ [____________________]    │ │
│ │                           │ │
│ │ [   ส่งรหัสยืนยัน   ]     │ │
│ │                           │ │
│ │ -------- หรือ --------    │ │
│ │                           │ │
│ │ [ Google Login ]          │ │
│ │                           │ │
│ │ Consent                   │ │
│ │ Register                  │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

---

# 15. Tablet Content Width

Tablet page max-width:

```text
760–900px
```

The login card should use:

```text
max-width: 620–720px
```

or visually balanced relative to the page.

Do not keep the form at 420px on a 1024px tablet if it leaves excessive empty side space.

---

# 16. Tablet Hero

The hero should not feel like text floating above a card.

The top section should form a complete composition:

```text
Brand
headline
support copy
illustration
```

The illustration should visually connect the hero to the login card.

The login card may slightly overlap the visual hero region using a small negative top margin, around -24px to -40px, only if it remains responsive and accessible.

---

# 17. Tablet Card

Tablet Login card:
- `bg-bg-surface`
- `rounded-2xl`
- `border-border`
- `shadow-sm`
- Padding: 28–36px

Do not make the card excessively tall.

Do not center every text block unnecessarily.

Form content should mostly remain left aligned.

---

# 18. Mobile Layout

Breakpoint:

```text
<= 767px
```

Mobile must prioritize the login task.

Use:

```text
Compact brand
Compact lifestyle hero
Small illustration
Soft login card
```

Example:

```text
┌───────────────────────┐
│ ◉ Kemtit          ☰   │
│ tagline               │
│                       │
│ ก้าวเล็ก ๆ            │
│ ชีวิตที่ดีขึ้น         │
│                       │
│ จัดการชีวิตในแบบของคุณ│
│ ทุกที่ ทุกเวลา        │
│                       │
│   soft sunrise art    │
│                       │
│ ╭───────────────────╮ │
│ │ เข้าสู่ระบบ        │ │
│ │                   │ │
│ │ Email             │ │
│ │ [______________]  │ │
│ │                   │ │
│ │ [ ส่งรหัสยืนยัน ] │ │
│ │                   │ │
│ │ ------ หรือ ----- │ │
│ │                   │ │
│ │ [ Google ]        │ │
│ │                   │ │
│ │ Consent           │ │
│ │                   │ │
│ │ สมัครใช้งาน       │ │
│ ╰───────────────────╯ │
└───────────────────────┘
```

---

# 19. Mobile Card Strategy

Do NOT use the current plain form directly on the page background.

The approved design requires a **Soft Authentication Surface**.

Recommended:
- Background: `bg-bg-surface`
- Border: `border-border`
- Border radius: 18–24px
- Shadow: `shadow-sm`
- Page horizontal padding: 16–20px
- Card padding: 20–24px

The card should visually group all authentication controls.

---

# 20. Mobile Hero Height

Mobile must not waste vertical space.

Keep the branding and lifestyle area compact.

Approximate vertical budget before the login card:

```text
260–340px
```

depending on device height.

For very short screens (`<= 700px` height), reduce or hide decorative illustration elements.

Functionality has priority.

---

# 21. Mobile Illustration

Use only a small illustration slice.

Example:

```text
soft mountain horizon
small sunrise
minimal foliage
```

Do not show the full large Desktop artwork.

The artwork should act as transition between hero and form.

---

# 22. Mobile Form Width

Use:

```text
width: 100%
```

No artificial narrow max-width.

Inputs and buttons should fill available width.

Minimum touch target:

```text
44px
```

Recommended input/button height:

```text
46–50px
```

---

# 23. Small Mobile

For:

```text
<= 390px
```

reduce:
- hero font size
- card padding
- brand tagline width
- decorative artwork height

Suggested:
- Page padding: 16px
- Card padding: 18–20px
- Headline: 28px

No horizontal overflow.

---

# 24. Large Mobile

For:

```text
391px – 767px
```

allow:
- slightly larger illustration
- slightly larger card padding
- more breathing room

But do not make it look like Tablet.

---

# 25. Input Styling

Use the existing input component.

Ensure:
- Height: 46–50px
- `rounded-lg`
- `border-border`
- `bg-bg-surface`
- Focus: `border-brand-500`, `ring-brand-500/15`
- Text: `text-text-primary`
- Placeholder: `text-text-muted`

Maintain proper icon alignment if an email icon exists.

---

# 26. Primary CTA

Use:
- `bg-brand-500`
- `text-neutral-0`
- Hover: `bg-brand-600`
- Pressed: `bg-brand-700`
- Width: 100%
- Height: 48px
- `rounded-lg`
- `font-semibold`

Do not use a strong gradient.

---

# 27. Google Login Button

Use a secondary button style:
- `bg-bg-surface`
- `border-border`
- `text-text-primary`

Keep Google icon aligned consistently.

The button should be the same height as the primary CTA or slightly smaller.

Do not make Google visually stronger than the email login CTA.

---

# 28. Divider

Use:

```text
line — หรือ — line
```

Style:
- `text-caption`
- `text-text-secondary`
- `border-border`

Keep it visually quiet.

---

# 29. Consent / Privacy Copy

The consent text should remain readable but secondary.

Suggested style:
- `text-xs` / `text-caption`
- `text-text-muted`
- relaxed line-height

Do not make it visually compete with the form.

If a privacy policy link exists, distinguish the link.

---

# 30. Registration Prompt

Use:

```text
ยังไม่มีบัญชี?
สมัครใช้งาน
```

Style:
- Regular text → `text-text-secondary`
- Link → `text-brand-600`

Do not create a second large CTA unless current UX explicitly requires it.

---

# 31. Language Selector

If the page already supports Thai / English:

- Desktop: top-right
- Tablet: top-right
- Mobile: compact top-right control

Do not let it compete with the brand.

---

# 32. Responsive Breakpoints

Target behavior:

```text
>= 1152px:
Desktop two-panel

768px – 1151px:
Tablet stacked hero + illustration + login card

<= 767px:
Mobile compact hero + soft login card

<= 390px:
Small Mobile compact adjustments
```

Prefer CSS responsive utilities over JS viewport detection.

---

# 33. Vertical Scrolling

The page must support:
- Short laptop displays
- Tablet landscape
- Mobile virtual keyboard
- Validation errors
- OTP states
- Longer localized text

Avoid:

```text
height: 100vh
overflow: hidden
```

Prefer:

```text
min-h-dvh
```

with natural scrolling.

---

# 34. Form States

Verify every existing authentication state.

At minimum:

## Initial
- Email input
- Send OTP button
- Google login

## Email validation
- Invalid email
- Required email

## Sending
- Loading button
- Disabled state

## OTP sent
- 6-digit OTP input
- Email reference
- Resend
- Change email

## Wrong OTP
- Error message

## Success
- Pending redirect / success state

## Google authentication
Existing behavior must remain intact.

---

# 35. OTP Screen Responsive Behavior

The OTP state must preserve the same page layout.

Do not redesign the page into a different structure after sending OTP.

Maintain:
- card width
- hierarchy
- spacing
- illustration
- responsive behavior

OTP fields must not overflow on 360px screens.

---

# 36. Validation Error Layout

Errors must appear near the field that caused them.

Do not shift the entire page excessively.

Allow the card to grow naturally.

Use semantic danger tokens.

Do not rely only on color.

---

# 37. Accessibility

Maintain WCAG AA where practical.

Requirements:
- Semantic labels
- Keyboard support
- Visible focus state
- Accessible Google button
- `aria-invalid`
- Connected error descriptions
- Minimum 44px touch areas
- Screen-reader compatible OTP fields
- Reduced motion support

Decorative images:

```text
aria-hidden="true"
```

unless meaningful.

---

# 38. Localization

Must support:

```text
Thai
English
```

Check:
- headline wrapping
- form labels
- validation messages
- privacy copy
- register text
- Google login label
- OTP messages

No text clipping or broken layout.

---

# 39. Design Tokens

Use Kemtit's existing semantic design tokens.

Examples:
- `bg-bg-page`
- `bg-bg-surface`
- `bg-bg-subtle`
- `text-text-primary`
- `text-text-secondary`
- `text-text-muted`
- `border-border`
- `border-border-strong`
- `brand-50`
- `brand-100`
- `brand-500`
- `brand-600`
- `brand-700`

Do not introduce arbitrary hex values into components unless absolutely necessary.

---

# 40. Color Distribution

Target roughly:

```text
75–80% neutral
15–20% indigo / brand
<= 5% peach / decorative accent
```

Do not create a rainbow interface.

The illustration may contain soft lavender / blue / peach tones, but form controls should remain restrained.

---

# 41. Card Hierarchy

There should be only ONE primary form card.

Avoid nested cards for:
- consent
- Google
- registration

Google remains a button, not another panel.

---

# 42. Shadows

Use restrained elevation:
- Prefer `shadow-sm`
- Consider `shadow-md` only for the primary card if needed

Avoid dramatic shadows.

---

# 43. Border Radius

Use existing Kemtit geometry.

Suggested:
- Form card: 18–24px
- Inputs: 10–12px
- Buttons: 10–12px

Avoid excessive pill styling.

---

# 44. Motion

Optional transitions may include:
- button hover
- focus state
- OTP content transition

Keep motion around 150–250ms.

No large entrance animations.

Respect `prefers-reduced-motion`.

---

# 45. Desktop QA

Test at minimum:

```text
1280 × 720
1366 × 768
1440 × 900
1728 × 1117
1920 × 1080
```

Check:
- panel ratio
- form width
- vertical fit
- landscape illustration
- headline wrapping
- no excessive empty area

---

# 46. Tablet QA

Test:

```text
768 × 1024
820 × 1180
834 × 1194
1024 × 1366
1024 × 768
```

Especially inspect:

```text
768 × 1024
1024 × 768
```

Tablet must look intentionally designed.

No narrow centered desktop card with huge unused margins.

---

# 47. Mobile QA

Test:

```text
360 × 800
375 × 812
390 × 844
393 × 852
430 × 932
```

Check:
- no horizontal overflow
- login card fits
- OTP field fits
- headline fits
- Google button fits
- consent wraps cleanly
- registration row fits
- artwork remains subtle

---

# 48. Short Height QA

Test:

```text
1280 × 720
1024 × 768
390 × 667
```

The page must scroll naturally.

No clipped CTA.

No hidden register link.

---

# 49. Implementation Process

Before modifying code:

1. Inspect current Login route.
2. Inspect existing auth components.
3. Inspect existing login form state logic.
4. Inspect current responsive CSS/classes.
5. Inspect translation keys.
6. Identify reusable components.
7. Preserve all functional behavior.

Then implement targeted changes.

Avoid unnecessary rewrites.

---

# 50. Recommended Component Structure

Reuse existing components where reasonable.

Possible structure:

```text
LoginPage
├── LoginBrandHeader
├── LifestyleHero
│   ├── HeroCopy
│   ├── Benefits
│   └── LifestyleIllustration
└── LoginCard
    ├── LoginFormHeader
    ├── ExistingAuthForm
    ├── AuthDivider
    ├── GoogleLogin
    ├── ConsentText
    └── RegisterLink
```

Do not create excessive abstraction.

---

# 51. Desktop Composition Reference

```text
┌──────────────────────────────────────────────────────────────┐
│ Lifestyle / Brand Area          │ Authentication Area         │
│                                 │                             │
│ Kemtit                          │                             │
│ tagline                         │    ┌───────────────────┐    │
│                                 │    │ เข้าสู่ระบบ       │    │
│ A BETTER YOU, EVERYDAY          │    │                   │    │
│                                 │    │ email             │    │
│ ก้าวเล็ก ๆ                     │    │ [_______________] │    │
│ ชีวิตที่ดีขึ้น                  │    │                   │    │
│                                 │    │ [ส่งรหัสยืนยัน]    │    │
│ support copy                    │    │                   │    │
│                                 │    │ หรือ              │    │
│ ✓ benefit                       │    │                   │    │
│ ♥ benefit                       │    │ [Google]          │    │
│ ◎ benefit                       │    │                   │    │
│                                 │    │ privacy           │    │
│ lifestyle illustration          │    │ register          │    │
│                                 │    └───────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

# 52. Tablet Composition Reference

```text
┌──────────────────────────────────────┐
│ Kemtit                        ภาษา   │
│                                      │
│ ก้าวเล็ก ๆ                           │
│ ชีวิตที่ดีขึ้น                        │
│                                      │
│ จัดการชีวิตในแบบของคุณ               │
│                                      │
│      soft landscape artwork          │
│                                      │
│    ┌────────────────────────────┐    │
│    │ เข้าสู่ระบบ                │    │
│    │                            │    │
│    │ email                      │    │
│    │ [______________________]   │    │
│    │                            │    │
│    │ [    ส่งรหัสยืนยัน     ]   │    │
│    │                            │    │
│    │ -------- หรือ --------     │    │
│    │                            │    │
│    │ [ Google Login ]           │    │
│    │                            │    │
│    │ privacy                    │    │
│    │ register                   │    │
│    └────────────────────────────┘    │
└──────────────────────────────────────┘
```

---

# 53. Mobile Composition Reference

```text
┌─────────────────────────┐
│ Kemtit              ☰   │
│ tagline                 │
│                         │
│ ก้าวเล็ก ๆ              │
│ ชีวิตที่ดีขึ้น           │
│                         │
│ lifestyle copy          │
│                         │
│ ~ sunrise illustration  │
│                         │
│ ╭─────────────────────╮ │
│ │ เข้าสู่ระบบ          │ │
│ │                     │ │
│ │ email               │ │
│ │ [________________]  │ │
│ │                     │ │
│ │ [ ส่งรหัสยืนยัน ]   │ │
│ │                     │ │
│ │ ----- หรือ -----    │ │
│ │                     │ │
│ │ [ Google Login ]    │ │
│ │                     │ │
│ │ privacy             │ │
│ │                     │ │
│ │ สมัครใช้งาน         │ │
│ ╰─────────────────────╯ │
└─────────────────────────┘
```

---

# 54. Visual Acceptance Criteria

The redesign is complete only if:

- [ ] Desktop follows a true split-screen composition.
- [ ] Tablet uses its own stacked lifestyle composition.
- [ ] Mobile uses its own compact lifestyle composition.
- [ ] Tablet does not look like enlarged Mobile.
- [ ] Mobile does not look like compressed Desktop.
- [ ] Form remains the primary interactive focal point.
- [ ] Hero and Login title do not compete excessively.
- [ ] Illustration supports the page without overpowering it.
- [ ] Card is visually cohesive.
- [ ] No large dead spaces.
- [ ] No awkward floating text blocks.
- [ ] No excessive card nesting.
- [ ] No arbitrary colors.
- [ ] Kemtit branding feels distinctive.
- [ ] UI feels production-ready.

---

# 55. Functional Acceptance Criteria

- [ ] Existing email OTP flow remains unchanged.
- [ ] Existing Google login remains unchanged.
- [ ] Existing validation remains unchanged.
- [ ] Existing redirects remain unchanged.
- [ ] Existing registration flow remains unchanged.
- [ ] Existing authentication security remains unchanged.
- [ ] Loading state works.
- [ ] Error state works.
- [ ] OTP state works.
- [ ] Resend/change-email states work if already supported.

---

# 56. Responsive Acceptance Criteria

- [ ] 360px viewport has no horizontal overflow.
- [ ] 390px mobile looks intentional.
- [ ] 430px mobile does not become overly spacious.
- [ ] 768px Tablet uses Tablet composition.
- [ ] 1024px Tablet uses available space effectively.
- [ ] 1151px still uses Tablet design.
- [ ] 1152px switches cleanly to Desktop.
- [ ] 1280×720 does not clip content.
- [ ] Login card remains readable at all tested sizes.
- [ ] Illustration never causes overflow.

---

# 57. Accessibility Acceptance Criteria

- [ ] Form labels are semantic.
- [ ] Keyboard navigation works.
- [ ] Focus states are visible.
- [ ] Errors are connected to inputs.
- [ ] Contrast remains accessible.
- [ ] Buttons have adequate touch targets.
- [ ] OTP input works with keyboard and assistive tech.
- [ ] Decorative imagery is hidden from screen readers.
- [ ] Reduced-motion preference is respected.

---

# 58. Localization Acceptance Criteria

Verify both:

```text
TH
EN
```

Check:
- [ ] Brand tagline
- [ ] Hero headline
- [ ] Login description
- [ ] Email label
- [ ] CTA label
- [ ] Google label
- [ ] Consent
- [ ] Registration
- [ ] Validation errors
- [ ] OTP state

No text clipping or broken layout.

---

# 59. Self-Review Before Completion

Before declaring the task complete:

1. Run existing tests.
2. Verify Login manually.
3. Capture Desktop screenshot.
4. Capture Tablet screenshot.
5. Capture Mobile screenshot.
6. Compare all three views.
7. Fix:
   - alignment
   - spacing
   - oversized gaps
   - card width
   - hero balance
   - wrapping
   - overflow
   - visual hierarchy
8. Re-test auth states.

Do not stop after the first visually acceptable implementation.

---

# 60. Final Instruction

Implement this redesign directly in the existing Kemtit.com project.

Do not only produce a design proposal.

First inspect the current code and authentication flow.

Then:

```text
Review
→ Preserve functionality
→ Implement Desktop
→ Implement Tablet composition
→ Implement Mobile composition
→ Test auth states
→ Test TH/EN
→ Screenshot QA
→ Fix visual issues
→ Finish
```

The final page should feel like:

> **A professional Personal OS that welcomes users back into their life-planning workspace.**

Keep it clean, inspiring, calm, modern, and recognizably Kemtit.
