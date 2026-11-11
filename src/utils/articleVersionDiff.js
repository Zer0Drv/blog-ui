import { sanitizeHtml } from './sanitize'

const BLOCK_TAG = />(?=<\/?(?:p|h[1-6]|ul|ol|li|pre|blockquote|div|table|tr|br|figure|hr)\b)/gi
const MAX_DIFF_CELLS = 300_000

export function articleVersionDiff(before, after) {
  const left = versionLines(before)
  const right = versionLines(after)
  const blocks = []
  function append(kind, line) {
    const last = blocks.at(-1)
    if (last?.kind === kind) last.lines.push(line)
    else blocks.push({ kind, lines: [line] })
  }

  let start = 0
  while (start < left.length && start < right.length && left[start] === right[start]) {
    append('same', left[start++])
  }
  let leftEnd = left.length
  let rightEnd = right.length
  while (leftEnd > start && rightEnd > start && left[leftEnd - 1] === right[rightEnd - 1]) {
    leftEnd--
    rightEnd--
  }

  const height = leftEnd - start
  const width = rightEnd - start
  const coarse = height > 0 && width > 0 && (height + 1) * (width + 1) > MAX_DIFF_CELLS
  if (coarse || height === 0 || width === 0) {
    for (let i = start; i < leftEnd; i++) append('removed', left[i])
    for (let j = start; j < rightEnd; j++) append('added', right[j])
  } else {
    const stride = width + 1
    const lengths = new Uint32Array((height + 1) * stride)
    for (let i = height - 1; i >= 0; i--) {
      for (let j = width - 1; j >= 0; j--) {
        const cell = i * stride + j
        lengths[cell] = left[start + i] === right[start + j]
          ? lengths[cell + stride + 1] + 1
          : Math.max(lengths[cell + stride], lengths[cell + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < height || j < width) {
      if (i < height && j < width && left[start + i] === right[start + j]) {
        append('same', left[start + i++])
        j++
      } else if (i < height && (j === width || lengths[(i + 1) * stride + j] >= lengths[i * stride + j + 1])) {
        append('removed', left[start + i++])
      } else {
        append('added', right[start + j++])
      }
    }
  }
  for (let i = leftEnd; i < left.length; i++) append('same', left[i])
  return { blocks, coarse, changed: height > 0 || width > 0 }
}

function versionLines(version) {
  const content = String(version.content ?? '').replace(/\r\n?/g, '\n')
  const text = version.editorType === 'RICHTEXT' ? sanitizeHtml(content).replace(BLOCK_TAG, '>\n') : content
  return text ? text.split('\n') : []
}
