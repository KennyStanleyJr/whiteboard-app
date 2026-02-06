# NASA Coding Guidelines (Adapted for This Project)

This project follows principles derived from **NASA's Power of 10** (JPL Laboratory for Reliable Software), **SWE-061**, and **MISRA/CERT**-style practices, adapted for TypeScript/JavaScript.

## Source References

- [NASA Power of 10 – Wikipedia](https://en.wikipedia.org/wiki/The_Power_of_10:_Rules_for_Developing_Safety-Critical_Code)
- [SWE-061 – Coding Standards (NASA SWE Handbook)](https://swehb.nasa.gov/display/SWEHBVB/SWE-061+-+Coding+Standards)
- [NASA Ten Rules (Klocwork)](https://help.klocwork.com/2025.3/en-us/concepts/nasapoweroften.htm)

## The Power of 10 (Original C/C++ Rules)

1. **Simple control flow** — No `goto`, no `setjmp`/`longjmp`, no direct or indirect recursion (where analyzable).
2. **Bounded loops** — Every loop has a fixed upper bound; static analysis can prove the bound.
3. **No dynamic memory after init** — No heap allocation after initialization.
4. **Function size** — No function longer than fits on one page (~60 lines); one statement/declaration per line.
5. **Assertions** — At least two assertions per function; side-effect free; explicit recovery on failure.
6. **Minimal scope** — Declare data at the smallest possible scope.
7. **Return and parameter checks** — Callers check non-void return values; callees validate parameters.
8. **Preprocessor** — Limit to includes and simple macros; no token pasting, varargs macros, or recursive macros.
9. **Pointers** — At most one level of dereference; no function pointers (in C).
10. **Zero warnings** — Compile with all warnings enabled; run static analysis; fix all warnings.

## How We Apply These in TypeScript/React

| NASA Rule | Our Practice |
|-----------|--------------|
| 1. Control flow | Prefer straightforward control flow; avoid deep recursion in core logic; document recursion if used. |
| 2. Bounded loops | Use bounded iterations (e.g. `for` with known limits, `.slice()` before loops); avoid unbounded `while (true)` without clear exit. |
| 3. Dynamic memory | Rely on language/runtime; avoid unnecessary dynamic structures in hot paths; prefer explicit limits for large collections. |
| 4. Function size | Keep functions small (~≤60 lines); extract helpers; one clear responsibility per function. React components may exceed this when the file is mostly JSX/structure; keep business logic in small helpers. |
| 5. Assertions | Use runtime checks and `assert`-style guards; validate invariants; handle failures explicitly (e.g. early return, error state). |
| 6. Minimal scope | Use `const`/`let` in the narrowest scope; avoid unnecessary module-level mutable state. |
| 7. Return/params | Check return values and validate function parameters; use TypeScript strict types; handle errors explicitly. |
| 8. Preprocessor | N/A (no C preprocessor); use minimal, clear configuration and feature flags. |
| 9. Pointers | N/A (no raw pointers); avoid deep/complex object graphs; keep data structures shallow where possible. |
| 10. Zero warnings | **TypeScript strict mode**; **ESLint** with strict rules; **no lint/compile warnings** in CI and before merge. |

## SWE-061 Principles We Follow

- **Code structure**: Clear project layout (e.g. `src/`, components, hooks, utils), consistent file and module organization.
- **Error handling**: Explicit error handling and reporting; no silent failures in critical paths.
- **Module size**: Keep modules and components focused; split when they grow too large.
- **Naming**: Consistent naming for variables, functions, components, and files.
- **Comments**: Comment non-obvious logic and invariants; keep code self-documenting where possible.
- **Verification**: Use TypeScript, ESLint, and (where applicable) static analysis; aim for zero warnings.

## Project Conventions

- **Lint and types**: Fix all TypeScript and ESLint errors and warnings before committing.
- **Reviews**: Code should be reviewable: small, clear units and minimal surprise.
- **Testing**: Critical paths and utilities should have tests; maintainability over time is a goal.
- **Bounded iteration**: Loops and recursion use explicit bounds (e.g. `MAX_STRIP_ITERATIONS`, `MAX_SANITIZE_DEPTH`) so control flow is analyzable.
