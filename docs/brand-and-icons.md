# Brand and UI icon assets

`public/brand/kemtit-logo-v2.png` is the primary Kemtit compass mark used beside the existing wordmark. It was generated with the built-in image generation tool from a brief for a stylish, friendly, professional mark: a rounded compass with a full pink northeast needle, a lavender southwest needle, and a small pink sparkle on a square white background, with no text. Preserve the original 1254 × 1254 dimensions and white background. The earlier transparent concept remains at `public/brand/kemtit-logo.png` for reference.

The UI icon set is original Kemtit vector artwork, authored on a 24 × 24 grid in [`scripts/ui-icon-geometry.mjs`](../scripts/ui-icon-geometry.mjs). The shapes use a rounded outline and inherit `currentColor`. Run `pnpm icons:generate` to write standalone SVGs, the shared sprite, and the static review gallery to `public/icons/ui/`. `src/components/icons/ui-icons.tsx` exposes typed React components that reference that sprite.

The SVG artwork is not traced from Lucide. The existing `public/licenses/lucide-react-LICENSE.txt` applies to the installed Lucide package and does not describe or license these Kemtit assets.

## Final logo generation prompt

Tool: built-in `imagegen`, with a white background.

> Design ONE exceptionally polished logo mark for Kemtit, a premium personal planning app. Modern professional brand with a cute friendly touch. Show a bold rounded purple compass circle, with a soft coral pink upper-right needle, a pale lavender lower-left needle, small purple central disk, and a petite four-point pink sparkle at upper-right. Simplify it into perfectly clean flat vector artwork. The ring should have four rounded inward ticks. Smooth round corners on needles, delightful balanced proportions, understated luxury. Purple #6656E8, pink #F5648C, lavender #B9A7F5. White background. Square canvas. Large centered mark with 12 percent margin, one logo only. Clean immaculate solid shapes, absolutely no textures, no gradients, no shading, no blur, no pixel artifacts, no extra marks. No text, no mockup, no borders. Think high-end SaaS identity meets friendly stationery brand.
