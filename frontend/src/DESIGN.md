# SastaGram Design Conventions

All feature components must follow these conventions so the app reads as one product.
The shell (MainLayout / LeftSidebar / TopBar / BottomNav) already implements them.

## Color

| Role                          | Class(es)                                    |
| ----------------------------- | -------------------------------------------- |
| Page / card background        | `bg-white` (#fff)                            |
| Borders & dividers            | `border-gray-200`                            |
| Primary text                  | `text-gray-900`                              |
| Secondary text (bio, meta)    | `text-gray-500`                              |
| Tertiary text (timestamps)    | `text-gray-400`                              |
| Action / links (Follow, etc.) | `text-blue-500`, hover `text-blue-700`       |
| Primary buttons               | `bg-blue-500 hover:bg-blue-600 text-white`   |
| Likes, unread badges, danger  | `text-red-500` / `bg-red-500`                |
| Hover surface (nav, menus)    | `hover:bg-gray-100`                          |

Never introduce slate/stone/zinc grays or other accent hues in feature components.

## Typography

- Base body: `text-sm text-gray-900`.
- Usernames: `text-sm font-semibold`.
- Section headings: `text-base font-semibold` (page titles `text-xl font-bold`).
- Meta/timestamps: `text-xs text-gray-400`.
- Logo wordmark: "SastaGram", `font-bold text-xl tracking-tight`.

## Spacing & Layout

- Feed column: `w-full max-w-[470px] mx-auto` — every feed-style page centers on this.
- Cards: `bg-white border border-gray-200 rounded-lg`; internal padding `p-3`/`p-4`.
- Vertical rhythm between cards: `mb-4` (or `space-y-4` on the list).
- Content pages render inside `<Outlet/>`; MainLayout already applies sidebar
  offsets (`md:pl-[72px] min-[1264px]:pl-[244px]`) and mobile top/bottom bar
  padding (`pt-14 pb-16` below `md`). Pages should NOT add their own margins for
  the shell — just center their own content.
- Right sidebar (suggested users) is 320px and only rendered on Home at
  `min-[1160px]:block`.

## Breakpoints (arbitrary variants, no config changes)

- `< 768px` (below `md`): TopBar + BottomNav, no sidebar.
- `md` – `1263px`: 72px icon rail sidebar.
- `min-[1264px]:`: full 244px sidebar with labels.
- `min-[1160px]:`: RightSidebar visible on Home.

## Avatars

Use shadcn `Avatar` (`components/ui/avatar`) with these sizes:

- `h-8 w-8` (32px) — comments, nav, suggested users
- `h-11 w-11` (44px) — post headers, notification rows
- `h-[77px] w-[77px]` — profile header (mobile)
- `h-[150px] w-[150px]` — profile header (desktop)

Fallback: first letter(s) of username, e.g. `<AvatarFallback>CN</AvatarFallback>`.

## Components

- Buttons: shadcn `Button` (`components/ui/button`). Primary actions:
  `<Button className="bg-blue-500 hover:bg-blue-600 h-8">`; secondary:
  `variant="secondary"`; text-only: `variant="ghost"` or a `text-blue-500` span.
- Dialogs: shadcn `Dialog`; inputs: shadcn `Input` / `Textarea` / `Label`.
- Toasts: `toast.success()` / `toast.error()` from `sonner` — never `alert()`.
- Icons: `lucide-react`, default `size={24}` in nav, `20` inline. "Filled"
  active state: pass `strokeWidth={2.5}` (and `fill="currentColor"` for Heart).
- Loading: skeletons with `animate-pulse bg-gray-200 rounded` blocks sized to
  the final content; spinners (`Loader2` + `animate-spin`) only for actions.

## Interaction

- Every clickable row: `cursor-pointer rounded-lg hover:bg-gray-100 transition-colors`.
- Active nav route: `font-bold` label + filled/thicker icon.
- Unread counts: red dot/pill `bg-red-500 text-white text-[11px] font-semibold rounded-full`.
