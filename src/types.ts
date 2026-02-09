import type { ComponentProps } from 'react'
import { Excalidraw, THEME } from '@excalidraw/excalidraw'

export type ExcalidrawTheme = typeof THEME.LIGHT | typeof THEME.DARK

type ExcalidrawOnChange = NonNullable<
	ComponentProps<typeof Excalidraw>['onChange']
>
export type OnChangeParams = Parameters<ExcalidrawOnChange>
