# JSDoc Rules

Rules for writing JSDoc comments on exported symbols in a TypeScript package.
Apply every rule to every symbol you write or edit.

## Summary line

The first paragraph is the only part shown in editor tooltips, autocomplete
lists, and search indexes. Write it as one concise sentence describing what the
symbol does, so a reader scanning an autocomplete list can pick the right symbol
without opening anything else.

Put implementation details, caveats, and rationale in later paragraphs.

```ts
/** Replaces all spaces in a string with underscores. */
```

## Types

Carry type information in the TypeScript signature. Describe meaning in the
comment: what the value represents, its valid range, and any sentinel value.

```ts
/**
 * Finds a substring and returns the index of its first occurrence.
 *
 * @param value The string to search.
 * @param needle The substring to search for.
 * @returns The index of the first occurrence, or -1 when the needle is absent.
 */
declare function find(value: string, needle: string): number
```

Reserve `@param` and `@returns` for facts the signature cannot state — the `-1`
above is the case that earns the tag.

## Examples

Add `@example` for symbols with several parameters or non-obvious behaviour. The
text on the `@example` line is the title; the text below the code block is its
description. Include the `import` statement so the block runs when pasted.

````ts
/**
 * @example Basic usage
 * ```ts
 * import { move } from "@std/fs/move";
 *
 * await move("./foo", "./bar");
 * ```
 *
 * This moves `./foo` to `./bar` without overwriting.
 */
````

Write one example per distinct use case.

## Coverage

Document every exported symbol: functions, classes, interfaces, type aliases.
For classes and interfaces, document the symbol itself plus each constructor,
method, and property.

When a package exposes several modules, put a `@module` comment at the top of
each module file with a summary paragraph and a usage example. Its first
paragraph becomes the module's description on the package index.

```ts
/**
 * Contains the middleware application, the core concept of oak.
 *
 * @module
 */
```

## Markdown

Write comment bodies in Markdown: headings, bullet lists, bold, block quotes,
links, and inline code.

## Internal links

Link to other symbols in the package with `{@linkcode}` (renders as code),
`{@link}`, or `{@linkplain}`. These become clickable in editor tooltips and in
generated docs. References to built-in objects such as `ArrayBuffer` resolve to
MDN.

```ts
/** Options for styling text with the {@linkcode print} function. */
```

## Freshness

Edit the JSDoc in the same change as the code it describes.

This repo has no automated doc check: nothing type-checks `@example` blocks or
flags exported symbols without a comment. Coverage is a review concern — before
finishing a change, walk the exported symbols it touches and confirm each still
has a JSDoc block and that every `@example` carries its `import`.

## Renderer-dependent syntax

These render only on some documentation sites — confirm the target renderer
supports them before use:

- `> [!IMPORTANT]` alert blocks (JSR).
- `@example` title/description splitting (JSR renders it; plain JSDoc does not).
- `@typeParam` is a TSDoc tag; `@template` is the JSDoc equivalent. Use whichever
  the repo already uses, consistently.

## Applying these rules in react-preload-intent

- The package has a single entry, `src/index.tsx`. `@example` blocks import from
  `react-preload-intent`, never from `../src/index` as `examples/` does.
  Internal imports carry no extension (`moduleResolution: "Bundler"`).
- The overview comment at the top of `src/index.tsx` is plain prose without
  `@module`: with one entry there is no package index for it to feed.
- Write descriptions in Korean, matching the existing comments. Wrap every
  identifier, prop name, literal and the package name in backticks
  (`` `fetchPriority` ``, `` `"high"` ``, `` `react-preload-intent` ``) so it
  renders as code in tooltips.
- Start each hook's summary with its trigger name from the README's Triggers
  table (`Render trigger —`, `Intent trigger —`, `Viewport trigger —`,
  `Manual trigger —`), so the autocomplete list maps onto the README.
- Defaults set by destructuring (`delay = 50`, `rootMargin = '200px'`,
  `enabled = true`) are invisible in the type. State each one in its option's
  comment (`기본 50ms`).
- Options passed straight through to `react-dom`'s `preload()` (`crossOrigin`,
  `referrerPolicy`, `imageSrcSet`, `type`) only need what differs from React's
  own docs — link to [`preload()`](https://react.dev/reference/react-dom/preload)
  rather than restating it. Say when a value must match the rendered `<img>`.
- Behaviour that React already provides (dedup, `<head>` hoisting, automatic SSR
  preload of rendered `<img>`) or where a hook deliberately deviates from it
  (`fetchPriority` defaulting to `"high"`, skipping `data:` URLs) belongs in the
  comment — that is the non-obvious part of this library.
- Module-local helpers such as `callPreload` carry a JSDoc too: they hold the
  rationale for behaviour every trigger inherits.
- All comments are JSDoc (`/** */`); no `//` line comments explaining code.
- There is no JSR renderer, so avoid alert blocks; mark warnings with a leading
  `⚠️` as the existing comments do.
- Write `@example` in the Examples-section format: a short title on the tag
  line, then a ` ```tsx ` fence. The title reads as a plain line in VS Code
  tooltips, so keep it to a few words. Put `@param` / `@returns` before
  `@example`.
- oxfmt's JSDoc formatting is off (no `fmt.jsdoc` in `vite.config.ts`) because
  it breaks that format: it moves the title to its own line, strips the code's
  indentation, and on a second pass turns the opening fence into ` ;``` `. Do
  not turn it back on. The flip side is that nothing rewraps JSDoc prose — wrap
  lines by hand to match the width of the existing comments.
- Nothing type-checks `@example` code, so compile it by hand when you change
  it: copy each block into a scratch `.tsx` under `src/`, point the import at
  `../index`, and run `pnpm typecheck`.
- Point to a README section by its heading, e.g. README "Suspense + streaming
  함정" 참조, when the explanation is too long for a tooltip.
- Verify with `pnpm typecheck`, `pnpm test` and `pnpm check` in the same
  change.
