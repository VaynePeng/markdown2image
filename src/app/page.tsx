"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import DOMPurify from "dompurify";
import { marked } from "marked";

type TableData = {
  headers: string[];
  rows: string[][];
};

function parseMarkdownTable(markdown: string): TableData | null {
  const lines = markdown
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  const headerLine = lines[0];
  const delimiterLine = lines[1];
  if (!/\|/.test(headerLine) || !/-{3,}/.test(delimiterLine)) return null;

  const normalize = (line: string) =>
    line
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((s) => s.trim());

  const headers = normalize(headerLine);
  const rows = lines
    .slice(2)
    .map(normalize)
    .filter((cols) => cols.length > 1);

  return { headers, rows };
}

export default function Home() {
  const [markdown, setMarkdown] = useState(
    "| 品类 | 水果名称 | 价格 | 规格 | 性价比（20字内） | 日期 |\n| --- | --- | --- | --- | --- | --- |\n| 葡萄 | 阳光玫瑰（精品） | 15-18 元/斤 | 无 | 价稳，脆甜多汁，适合批量采购 | 12月19日 |\n| 葡萄 | 阳光玫瑰（普通） | 10-12 元/斤 | 无 | 价适中，清甜，流通性强，损耗低 | 12月19日 |\n| 芒果 | 桂七芒果（尾期） | 8-10 元/斤 | 无 | 价略高，香气浓，按需少量采购 | 12月19日 |\n| 芒果 | 小台农芒果 | 5-6 元/斤 | 无 | 价稳，甜糯，耐存储，批量优选 | 12月19日 |\n| 柑橘类 | 沃柑（精品） | 6-7 元/斤 | 无 | 价稳，酸甜适中，流通快，损耗少 | 12月19日 |\n| 柑橘类 | 砂糖橘 | 3-4 元/斤 | 按件（10斤净果） | 价低，清甜，适合批量囤货 | 12月19日 |\n| 柑橘类 | 粑粑柑 | 8-9 元/斤 | 无 | 价略高，果肉饱满，品质优 | 12月19日 |\n| 橙类 | 赣南脐橙 | 5-6 元/斤 | 无 | 价稳，多汁，耐存储，批量可行 | 12月19日 |"
  );
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  const tableData = useMemo(() => parseMarkdownTable(markdown), [markdown]);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 列宽可拖拽
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  useEffect(() => {
    if (!tableData) return;
    setColumnWidths((prev) => {
      if (prev.length === tableData.headers.length) return prev;
      return new Array(tableData.headers.length).fill(160);
    });
  }, [tableData]);

  const startXRef = useRef(0);
  const startWidthsRef = useRef<number[]>([]);
  const resizingColRef = useRef<number | null>(null);

  const onMouseMove = (e: MouseEvent) => {
    const idx = resizingColRef.current;
    if (idx == null) return;
    const delta = e.clientX - startXRef.current;
    setColumnWidths(() => {
      const base = startWidthsRef.current;
      const copy = [...base];
      copy[idx] = Math.max(80, (base[idx] ?? 160) + delta);
      return copy;
    });
  };

  const onMouseUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    resizingColRef.current = null;
  };

  const onResizeMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthsRef.current = [...columnWidths];
    resizingColRef.current = index;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const exportAsImage = async () => {
    if (!containerRef.current) return;
    const node = containerRef.current;
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });
    const link = document.createElement("a");
    link.download = `${title || "表格"}.png`;
    link.href = dataUrl;
    link.click();
  };

  const sanitizedNoteHtml = useMemo(() => {
    if (!isClient || !note) return "";
    const raw = marked.parseInline(note) as string;
    return DOMPurify.sanitize(raw);
  }, [note, isClient]);

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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 relative overflow-hidden" ref={containerRef} style={{ resize: "both" }}>
          <div className="watermark-overlay" aria-hidden="true"></div>
          <div className="relative z-10">

            <div className="relative">
              {title && (
                <div className="text-center text-xl font-bold mb-3">{title}</div>
              )}

              {tableData ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse custom-table">
                    {columnWidths.length === tableData.headers.length && (
                      <colgroup>
                        {tableData.headers.map((_, i) => (
                          <col key={i} style={{ width: columnWidths[i] ? `${columnWidths[i]}px` : undefined }} />
                        ))}
                      </colgroup>
                    )}
                    <thead>
                      <tr>
                        {tableData.headers.map((h, i) => (
                          <th key={i} className="text-center px-3 py-2 relative select-none">
                            {h}
                            <span
                              className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
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
  );
}
