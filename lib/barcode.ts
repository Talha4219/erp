// Code 128 barcode encoder — dependency-free, shared by label printing and any
// module that needs to render a scannable barcode (inventory, POS, GRN).
//
// Each symbol is 11 modules wide, encoded as 6 alternating bar/space widths.
// Index 0–102 are data symbols, 103–105 are the start codes, then the stop pattern.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232',
]
const STOP = '2331112'
const START_B = 104
const START_C = 105

export type BarcodeBar = { x: number; width: number }

/**
 * Render a value as a Code 128 barcode SVG markup string — for print windows
 * and anywhere React isn't rendering. Returns null for unencodable values.
 */
export function code128SvgString(
  value: string,
  { height = 48, moduleWidth = 2, showText = true }: { height?: number; moduleWidth?: number; showText?: boolean } = {}
): string | null {
  const encoded = encodeCode128(value)
  if (!encoded) return null
  const quiet = 10 // quiet zone (modules) each side, required by scanners
  const width = (encoded.totalWidth + quiet * 2) * moduleWidth
  const textHeight = showText ? 14 : 0
  const bars = encoded.bars
    .map((b) => `<rect x="${(b.x + quiet) * moduleWidth}" width="${b.width * moduleWidth}" height="${height}" fill="black"/>`)
    .join('')
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const text = showText
    ? `<text x="${width / 2}" y="${height + 11}" text-anchor="middle" font-size="11" font-family="monospace" fill="black">${escaped}</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + textHeight}" viewBox="0 0 ${width} ${height + textHeight}"><rect width="${width}" height="${height + textHeight}" fill="white"/>${bars}${text}</svg>`
}

/**
 * Encode a value as Code 128 (auto B/C) and return the black bars as
 * x-offset/width pairs in module units, plus the total width in modules.
 * Returns null if the value contains characters outside ASCII 32–126.
 */
export function encodeCode128(value: string): { bars: BarcodeBar[]; totalWidth: number } | null {
  if (!value) return null
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 32 || code > 126) return null
  }

  // All-digit even-length values pack two digits per symbol (code set C);
  // everything else uses code set B.
  const useC = /^\d+$/.test(value) && value.length % 2 === 0
  const symbols: number[] = [useC ? START_C : START_B]
  if (useC) {
    for (let i = 0; i < value.length; i += 2) symbols.push(parseInt(value.slice(i, i + 2), 10))
  } else {
    for (let i = 0; i < value.length; i++) symbols.push(value.charCodeAt(i) - 32)
  }

  let checksum = symbols[0]
  for (let i = 1; i < symbols.length; i++) checksum += symbols[i] * i
  symbols.push(checksum % 103)

  const widths = symbols.map((s) => PATTERNS[s]).join('') + STOP
  const bars: BarcodeBar[] = []
  let x = 0
  for (let i = 0; i < widths.length; i++) {
    const w = Number(widths[i])
    if (i % 2 === 0) bars.push({ x, width: w }) // even positions are bars, odd are spaces
    x += w
  }
  return { bars, totalWidth: x }
}
