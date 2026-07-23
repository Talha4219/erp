'use client'

import { encodeCode128 } from '@/lib/barcode'

/**
 * Renders a scannable Code 128 barcode as an inline SVG.
 * Used on product labels and anywhere a barcode needs to be displayed/printed.
 */
export function BarcodeSvg({
  value,
  height = 48,
  moduleWidth = 2,
  showText = true,
  className,
}: {
  value: string
  height?: number
  moduleWidth?: number
  showText?: boolean
  className?: string
}) {
  const encoded = encodeCode128(value)
  if (!encoded) return <span className="text-xs text-red-500">Invalid barcode</span>

  const quiet = 10 // quiet zone (modules) each side, required by scanners
  const width = (encoded.totalWidth + quiet * 2) * moduleWidth
  const textHeight = showText ? 14 : 0

  return (
    <svg
      className={className}
      width={width}
      height={height + textHeight}
      viewBox={`0 0 ${width} ${height + textHeight}`}
      role="img"
      aria-label={`Barcode ${value}`}
    >
      <rect x={0} y={0} width={width} height={height + textHeight} fill="white" />
      {encoded.bars.map((bar, i) => (
        <rect
          key={i}
          x={(bar.x + quiet) * moduleWidth}
          y={0}
          width={bar.width * moduleWidth}
          height={height}
          fill="black"
        />
      ))}
      {showText && (
        <text
          x={width / 2}
          y={height + 11}
          textAnchor="middle"
          fontSize={11}
          fontFamily="monospace"
          fill="black"
        >
          {value}
        </text>
      )}
    </svg>
  )
}
