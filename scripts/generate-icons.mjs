#!/usr/bin/env node
/**
 * Generate PNG and ICO icons from public/favicon.svg.
 * Run: npm run generate-icons
 */
import { readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import toIco from 'to-ico'

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

/** Neutral stroke for PNG/ICO: visible on both light (#f0f2f5) and dark (#1e293b) theme backgrounds. */
const UNIVERSAL_STROKE = '#6b6b6b'

async function main() {
	let svg = await readFile(SRC, 'utf8')
	// Sharp ignores @media (prefers-color-scheme). Strip media query and use a universal stroke
	// so generated icons look correct on both light and dark backgrounds (PWA, favicon.ico).
	svg = svg.replace(
		/<style>[\s\S]*?<\/style>/,
		`<style>.sq { fill: none; stroke-width: 2; stroke: ${UNIVERSAL_STROKE}; }</style>`,
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

	// Generate favicon.ico (16, 32, 48)
	const png48 = await pipeline.clone().resize(48, 48).png().toBuffer()
	const icoBuf = await toIco([png48], { resize: true, sizes: [16, 32, 48] })
	await writeFile(join(OUT, 'favicon.ico'), icoBuf)
	console.log('Generated favicon.ico')

	console.log('Done.')
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
