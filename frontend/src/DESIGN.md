# SastaGram Design Conventions

All feature components must follow these conventions so the app reads as one product.
The shell (MainLayout / LeftSidebar / TopBar / BottomNav) already implements them.

## Color (Instagram dark — the light theme is retired)

The app is dark-only: pure black surfaces with subtle zinc borders, exactly
like instagram.com's dark web UI. `body` is `background:#000; color:#f5f5f5`
(set in `index.css`).

| Role                          | Class(es)                                    |
| ----------------------------- | -------------------------------------------- |
| Page / card background        | `bg-black` (#000)                            |
| Raised surface (pill, bubble) | `bg-zinc-900`                                |
| Borders & dividers            | `border-zinc-800`                            |
| Primary text                  | `text-gray-100`                              |
| Secondary text (bio, meta)    | `text-zinc-400`                              |
| Tertiary text (timestamps)    | `text-zinc-500`                              |
| Action / links (Follow, etc.) | `text-blue-400`, hover `text-blue-300`       |
| Primary buttons               | `bg-blue-500 hover:bg-blue-600 text-white`   |
| Likes, unread badges, danger  | `text-red-500` / `bg-red-500`                |
| Hover surface (nav, menus)    | `hover:bg-zinc-900`                          |
| Skeletons                     | `animate-pulse bg-zinc-800`                  |
| Inputs                        | `bg-transparent` or `bg-zinc-900`, `border-zinc-800`, `placeholder:text-zinc-500` |
| Footer / legal text           | `text-zinc-600` at 11px                      |

Avatar/online-dot rings sit on black: use `ring-black`. Chat bubbles: theirs
`bg-zinc-800 text-gray-100`, mine `bg-blue-500 text-white`. Toasts render with
`theme="dark"` on the sonner `<Toaster>`. Never reintroduce light-theme classes
(`bg-white`, `text-gray-900`, `border-gray-200`) or other accent hues.

## Typography

- Base body: `text-sm text-gray-100`.
- Usernames: `text-sm font-semibold`.
- Section headings: `text-base font-semibold` (page titles `text-xl font-bold`).
- Meta/timestamps: `text-xs text-zinc-500` (compact `timeAgo`, e.g. "14h").
- Logo wordmark: "SastaGram", `font-bold text-xl tracking-tight`.

## Spacing & Layout

- Feed column: `w-full max-w-[470px] mx-auto` — every feed-style page centers on this.
- Cards (dialog-style panels): `bg-black border border-zinc-800 rounded-lg`;
  internal padding `p-3`/`p-4`.
- Feed posts are NOT cards: full-bleed on black with no side border and no
  rounding — just `border-b border-zinc-800 pb-4 mb-4` between posts.
  (Rounded corners are kept inside dialogs.)
- Vertical rhythm between cards: `mb-4` (or `space-y-4` on the list).
- Content pages render inside `<Outlet/>`; MainLayout already applies sidebar
  offsets (`md:pl-[72px] min-[1264px]:pl-[244px]`) and mobile top/bottom bar
  padding (`pt-14 pb-16` below `md`). Pages should NOT add their own margins for
  the shell — just center their own content.
- Right sidebar (my profile row + "Suggested for you" + footer links) is 320px
  and only rendered on Home at `min-[1160px]:block`. Suggestion rows use a
  textual `text-blue-400` Follow link (`FollowButton variant="link"`), not a
  button.
- Floating "Messages" pill (`MessagesPill`): fixed bottom-right on Home,
  desktop `min-[1264px]` and logged-in only, `bg-zinc-900 border-zinc-800`
  with a red unread badge.

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
- Loading: skeletons with `animate-pulse bg-zinc-800 rounded` blocks sized to
  the final content; spinners (`Loader2` + `animate-spin`) only for actions.

## Interaction

- Every clickable row: `cursor-pointer rounded-lg hover:bg-zinc-900 transition-colors`.
- Active nav route: `font-bold` label + filled/thicker icon.
- Unread counts: red dot/pill `bg-red-500 text-white text-[11px] font-semibold rounded-full`.
