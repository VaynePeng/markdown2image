'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

type TableData = {
  headers: string[]
  rows: string[][]
}

function parseMarkdownTable(markdown: string): TableData | null {
  const lines = markdown
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
  if (lines.length < 2) return null
  const headerLine = lines[0]
  const delimiterLine = lines[1]
  if (!/\|/.test(headerLine) || !/-{3,}/.test(delimiterLine)) return null

  const normalize = (line: string) =>
    line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((s) => s.trim())

  const headers = normalize(headerLine)
  const rows = lines
    .slice(2)
    .map(normalize)
    .filter((cols) => cols.length > 1)

  return { headers, rows }
}

export default function Home() {
  const [markdown, setMarkdown] = useState(
    '| 品类 | 水果名称 | 价格 | 规格 | 性价比（20字内） | 日期 |\n| --- | --- | --- | --- | --- | --- |\n| 葡萄 | 阳光玫瑰（精品） | 15-18 元/斤 | 无 | 价稳，脆甜多汁，适合批量采购 | 12月19日 |\n| 葡萄 | 阳光玫瑰（普通） | 10-12 元/斤 | 无 | 价适中，清甜，流通性强，损耗低 | 12月19日 |\n| 芒果 | 桂七芒果（尾期） | 8-10 元/斤 | 无 | 价略高，香气浓，按需少量采购 | 12月19日 |\n| 芒果 | 小台农芒果 | 5-6 元/斤 | 无 | 价稳，甜糯，耐存储，批量优选 | 12月19日 |\n| 柑橘类 | 沃柑（精品） | 6-7 元/斤 | 无 | 价稳，酸甜适中，流通快，损耗少 | 12月19日 |\n| 柑橘类 | 砂糖橘 | 3-4 元/斤 | 按件（10斤净果） | 价低，清甜，适合批量囤货 | 12月19日 |\n| 柑橘类 | 粑粑柑 | 8-9 元/斤 | 无 | 价略高，果肉饱满，品质优 | 12月19日 |\n| 橙类 | 赣南脐橙 | 5-6 元/斤 | 无 | 价稳，多汁，耐存储，批量可行 | 12月19日 |'
  )
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)

  const tableData = useMemo(() => parseMarkdownTable(markdown), [markdown])

  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  const [viewportWidth, setViewportWidth] = useState<number>(1024)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setViewportWidth(window.innerWidth || 1024)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const clampNumber = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value))

  // 动态水印
  const [watermark, setWatermark] = useState('水果名片')
  const watermarkPattern = useMemo(() => {
    const textRaw =
      watermark && watermark.trim().length > 0 ? watermark : '水果名片'
    const fontSize = Math.round(clampNumber(viewportWidth * 0.02, 14, 20))
    const fontFamily = 'Arial'
    let textWidth = textRaw.length * fontSize * 0.65 // 近似兜底
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.font = `${fontSize}px ${fontFamily}`
        const metrics = ctx.measureText(textRaw)
        textWidth = metrics.width
      }
    }
    const textHeight = fontSize
    const angleDeg = 30
    const rad = (angleDeg * Math.PI) / 180
    const padding = 80
    const rotatedW = textWidth * Math.cos(rad) + textHeight * Math.sin(rad)
    const rotatedH = textWidth * Math.sin(rad) + textHeight * Math.cos(rad)
    const tileWidth = Math.ceil(rotatedW + padding)
    const tileHeight = Math.ceil(rotatedH + padding)
    const cx = tileWidth / 2
    const cy = tileHeight / 2
    const text = encodeURIComponent(textRaw)
    const svg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${tileWidth}' height='${tileHeight}' viewBox='0 0 ${tileWidth} ${tileHeight}'%3E%3Ctext x='${cx}' y='${cy}' text-anchor='middle' dominant-baseline='middle' font-family='${encodeURIComponent(
      fontFamily
    )}' font-size='${fontSize}' fill='%232b6cb0' fill-opacity='1' transform='rotate(-30 ${cx} ${cy})'%3E${text}%3C/text%3E%3C/svg%3E`
    return { url: svg, width: tileWidth, height: tileHeight }
  }, [watermark, viewportWidth])

  // 列宽可拖拽
  const [columnWidths, setColumnWidths] = useState<number[]>([])
  useEffect(() => {
    if (!tableData) return
    setColumnWidths((prev) => {
      if (prev.length === tableData.headers.length) return prev
      return new Array(tableData.headers.length).fill(160)
    })
  }, [tableData])

  const startXRef = useRef(0)
  const startWidthsRef = useRef<number[]>([])
  const resizingColRef = useRef<number | null>(null)

  const onMouseMove = (e: MouseEvent) => {
    const idx = resizingColRef.current
    if (idx == null) return
    const delta = e.clientX - startXRef.current
    setColumnWidths(() => {
      const base = startWidthsRef.current
      const copy = [...base]
      copy[idx] = Math.max(80, (base[idx] ?? 160) + delta)
      return copy
    })
  }

  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    resizingColRef.current = null
  }

  const onResizeMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    startWidthsRef.current = [...columnWidths]
    resizingColRef.current = index
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const exportAsImage = async () => {
    if (!containerRef.current) return
    const node = containerRef.current
    const cloneNode = node.cloneNode(true) as HTMLDivElement
    const offscreen = document.createElement('div')
    offscreen.style.position = 'fixed'
    offscreen.style.left = '-10000px'
    offscreen.style.top = '0'
    offscreen.style.zIndex = '-1'
    offscreen.style.pointerEvents = 'none'
    // 覆盖原容器上的 overflow-hidden，避免裁剪
    cloneNode.style.overflow = 'visible'
    // 先按原节点尺寸兜底，后续再根据内容修正
    cloneNode.style.width = `${node.scrollWidth}px`
    cloneNode.style.height = `${node.scrollHeight}px`
    offscreen.appendChild(cloneNode)
    document.body.appendChild(offscreen)

    const tableContainer = cloneNode.querySelector('.table-container') as HTMLElement
    if (tableContainer) {
      // 展开滚动容器的真实尺寸，确保全部内容可见
      const scrollW = tableContainer.scrollWidth
      const scrollH = tableContainer.scrollHeight
      tableContainer.style.overflow = 'visible'
      tableContainer.style.width = `${scrollW}px`
      tableContainer.style.height = `${scrollH}px`

      // 计算根容器的水平/垂直内边距与边框，确保包含 padding/border
      const rootStyle = window.getComputedStyle(cloneNode)
      const paddingX =
        parseFloat(rootStyle.paddingLeft || '0') +
        parseFloat(rootStyle.paddingRight || '0')
      const paddingY =
        parseFloat(rootStyle.paddingTop || '0') +
        parseFloat(rootStyle.paddingBottom || '0')
      const borderX =
        parseFloat(rootStyle.borderLeftWidth || '0') +
        parseFloat(rootStyle.borderRightWidth || '0')
      const borderY =
        parseFloat(rootStyle.borderTopWidth || '0') +
        parseFloat(rootStyle.borderBottomWidth || '0')

      // 根据展开后的布局，放大克隆根容器以容纳全部内容（含 padding/border）
      const neededW = scrollW + paddingX + borderX
      const neededH = scrollH + paddingY + borderY
      const totalW = Math.max(cloneNode.scrollWidth, neededW)
      const totalH = Math.max(cloneNode.scrollHeight, neededH)
      cloneNode.style.width = `${totalW}px`
      cloneNode.style.height = `${totalH}px`
    }
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

    // 使用克隆节点的真实边界尺寸（包含 padding 与边框）来导出，避免裁剪
    const rect = cloneNode.getBoundingClientRect()
    const exportWidth = Math.ceil(rect.width)
    const exportHeight = Math.ceil(rect.height)

    const dataUrl = await toPng(cloneNode, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#ffffff',
      width: exportWidth,
      height: exportHeight,
      canvasWidth: exportWidth,
      canvasHeight: exportHeight
    })
    const link = document.createElement('a')
    link.download = `${title || '表格'}.png`
    link.href = dataUrl
    link.click()
    // 清理离屏容器
    document.body.removeChild(offscreen)
  }

  const sanitizedNoteHtml = useMemo(() => {
    if (!isClient || !note) return ''
    const raw = marked.parseInline(note) as string
    return DOMPurify.sanitize(raw)
  }, [note, isClient])

  return (
    <div className="min-h-screen p-6 sm:p-10 bg-[#f5f7fb]">
      <div className="mx-auto max-w-6xl grid gap-6">
        <h1 className="text-2xl font-bold">Markdown 转表格并导出图片</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <textarea
            className="w-full h-72 p-4 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="粘贴 Markdown 表格..."
          />
          <div className="grid gap-3 content-start">
            <input
              className="w-full h-11 px-3 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="图片标题（可空）"
            />
            <input
              className="w-full h-11 px-3 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={watermark}
              onChange={(e) => setWatermark(e.target.value)}
              placeholder="水印文字（默认：水果名片）"
            />
            <input
              className="w-full h-11 px-3 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注支持 Markdown（可空）"
            />
            <button
              className="h-11 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              onClick={exportAsImage}
              disabled={!tableData}
            >
              下载为图片（含水印）
            </button>
          </div>
        </div>

        <div
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 relative overflow-hidden"
          ref={containerRef}
          style={{ resize: 'both' }}
        >
          <div
            className="watermark-overlay pointer-events-none"
            aria-hidden="true"
            suppressHydrationWarning
            style={{
              backgroundImage: isClient
                ? `url(${JSON.stringify(watermarkPattern.url)})`
                : undefined,
              backgroundSize: isClient
                ? `${watermarkPattern.width}px ${watermarkPattern.height}px`
                : undefined
            }}
          />
          <div className="relative z-30">
            <div className="relative">
              {title && (
                <div className="text-center text-xl font-bold mb-3">
                  {title}
                </div>
              )}

              {tableData ? (
                <div className="table-container overflow-x-auto">
                  <table className="w-full border-collapse custom-table">
                    {columnWidths.length === tableData.headers.length && (
                      <colgroup>
                        {tableData.headers.map((_, i) => (
                          <col
                            key={i}
                            style={{
                              width: columnWidths[i]
                                ? `${columnWidths[i]}px`
                                : undefined
                            }}
                          />
                        ))}
                      </colgroup>
                    )}
                    <thead>
                      <tr>
                        {tableData.headers.map((h, i) => (
                          <th
                            key={i}
                            className="text-center px-3 py-2 relative select-none"
                          >
                            {h}
                            <span
                              className="col-resizer absolute top-0 right-0 h-full w-2 cursor-col-resize"
                              onMouseDown={(e) => onResizeMouseDown(i, e)}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, r) => (
                        <tr key={r}>
                          {row.map((c, ci) => (
                            <td key={ci} className="px-3 py-3 align-top">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-gray-500">请输入有效的 Markdown 表格</div>
              )}

              {isClient && note && (
                <div
                  className="text-sm text-gray-600 mt-4"
                  dangerouslySetInnerHTML={{ __html: sanitizedNoteHtml }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
