#!/usr/bin/env node
/**
 * Generate PNG and ICO icons from public/favicon.svg.
 * Run: npm run generate-icons
 */
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import ico from 'sharp-ico'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SRC = join(ROOT, 'public', 'favicon.svg')
const OUT = join(ROOT, 'public')

const TARGETS = [
	{ name: 'pwa-64x64.png', size: 64 },
	{ name: 'pwa-192x192.png', size: 192 },
	{ name: 'pwa-512x512.png', size: 512 },
	{ name: 'apple-touch-icon-180x180.png', size: 180 },
	{ name: 'maskable-icon-512x512.png', size: 512 },
]

/** Dark default for PNG/ICO: desaturated dark bg with light border and dots. */
const DARK_BG = '#262626'
const LIGHT_COLOR = '#e5e5e5'

async function main() {
	let svg = await readFile(SRC, 'utf8')
	// Sharp ignores @media (prefers-color-scheme). Replace style with dark default for PNG/ICO.
	svg = svg.replace(
		/<style>[\s\S]*?<\/style>/,
		`<style>.bg { fill: ${DARK_BG}; }.border { fill: none; stroke-width: 2; stroke: ${LIGHT_COLOR}; }.sq { fill: ${LIGHT_COLOR}; }</style>`,
	)

	const pipeline = sharp(Buffer.from(svg))

	// Generate PNGs
	for (const { name, size } of TARGETS) {
		await pipeline
			.clone()
			.resize(size, size)
			.png()
			.toFile(join(OUT, name))
		console.log(`Generated ${name}`)
	}

	// Generate favicon.ico (16, 32, 48); explicit .png() for consistent format.
	const sharp48 = pipeline.clone().resize(48, 48).png()
	await ico.sharpsToIco([sharp48], join(OUT, 'favicon.ico'), { sizes: [16, 32, 48] })
	console.log('Generated favicon.ico')

	console.log('Done.')
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
