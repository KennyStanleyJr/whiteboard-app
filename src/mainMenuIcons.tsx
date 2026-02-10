/** Base SVG props for main menu icons (20x20, stroke-based). */
const MENU_ICON_PROPS = {
	width: 20,
	height: 20,
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 2,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	'aria-hidden': true,
} as const

export function CommandPaletteIcon() {
	return (
		<svg {...MENU_ICON_PROPS}>
			<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
		</svg>
	)
}

export function CopyAsJsonIcon() {
	return (
		<svg {...MENU_ICON_PROPS}>
			<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
			<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
		</svg>
	)
}
