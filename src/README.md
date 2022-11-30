# src

Still need to add more documentation, but rough outline:
- `core.ts` - has basic business logic and types (dealing with the Rubik's cube colors, sides, movement notations, etc.)
- `solution.ts` - has the solution algorithms: it provides the moveset needed to solve a Rubik's cube represented in memory
- `index.ts` - webpack entrypoint; makes the page work (implements rendering, interactivity, and animations)
- `index.html` - declares the page layout; template webpack render