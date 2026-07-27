<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Stack

- **Next.js 16** App Router — RSC enabled. Consult `node_modules/next/dist/docs/01-app/` for APIs.
- **TypeScript 5** — strict mode.
- **Tailwind CSS v4** — CSS-first config, NO `tailwind.config.*`. All theme tokens live in `app/globals.css` under `@theme inline { ... }` using `oklch` color values.
- **shadcn/ui** — style `base-nova` (not "default" or "new-york"). Run `bunx shadcn add <component>` to add components.
- **`@base-ui/react`** — headless primitive layer. **Not Radix UI.** Don't assume Radix-based APIs. See `components/ui/button.tsx` for a working example.
- **lucide-react** for icons.
- No state management library — use React state/context.
- No test framework installed.

## Path Aliases

`@/*` → `frontend/` root. Examples:
- `@/components/ui/button`
- `@/lib/utils` — exports `cn()` (clsx + tailwind-merge)
- `@/hooks/…`

## Key Files

| File              | Purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `app/globals.css` | Tailwind imports + all CSS custom properties / design tokens |
| `app/layout.tsx`  | Root layout, font setup (Geist Sans + Geist Mono)            |
| `lib/utils.ts`    | `cn()` helper                                                |
| `components/ui/`  | shadcn/ui generated components                               |
| `components.json` | shadcn config (icon library: lucide, aliases)                |

## Conventions

- Dark mode: class-based (`.dark`), via `@custom-variant dark (&:is(.dark *))` in CSS.
- Use `cn()` for conditional class merging — never string concatenation.
- All new components go in `components/`; shadcn-generated UI primitives in `components/ui/`.

