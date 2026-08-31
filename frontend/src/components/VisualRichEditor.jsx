// VisualRichEditor.jsx — Editor Teks Visual WYSIWYG (Seperti Word / Gmail)
// Bebas dari kode HTML (tanpa tag <em>, <strong>, <h2 style...>),
// dengan chip variabel interaktif dan toolbar format visual.

import React, { useEffect, useRef } from "react";
import { Bold, Italic, Underline, List, Heading1, Heading2, Type } from "lucide-react";
import { T } from "@/config/theme";

const PLACEHOLDERS = [
  { tag: "$nama", label: "Nama Kandidat", icon: "👤" },
  { tag: "$posisi", label: "Posisi Apply", icon: "💼" },
  { tag: "$tanggal", label: "Tanggal Interview", icon: "📅" },
  { tag: "$jam", label: "Jam Interview", icon: "⏰" },
  { tag: "$metode", label: "Metode Interview", icon: "💻" },
  { tag: "$penempatan", label: "Cabang Penempatan", icon: "📍" },
  { tag: "$link", label: "Link Online (Meet/Zoom)", icon: "🔗" },
  { tag: "$email_kandidat", label: "Email Kandidat", icon: "✉️" },
  { tag: "$no_hp", label: "No HP Kandidat", icon: "📱" },
];

// Konversi $nama -> Chip HTML visual untuk ditampilkan di editor
export function htmlToVisual(html) {
  if (!html) return "";
  let clean = html;

  // Ubah tag $variabel menjadi Chip visual berwarna
  PLACEHOLDERS.forEach((p) => {
    const regex = new RegExp(`\\${p.tag}`, "g");
    clean = clean.replace(
      regex,
      `<span class="var-chip inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700 font-semibold px-2 py-0.5 rounded text-xs select-none shadow-xs mx-0.5" contenteditable="false" data-tag="${p.tag}">` +
        `<span>${p.icon}</span><span>${p.label}</span>` +
        `</span>`
    );
  });

  return clean;
}

// Konversi Chip HTML visual -> $nama murni untuk disimpan di database
export function visualToHtml(html) {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Ganti semua chip variabel kembali menjadi $tag
  const chips = temp.querySelectorAll(".var-chip");
  chips.forEach((chip) => {
    const tag = chip.getAttribute("data-tag");
    if (tag) {
      const textNode = document.createTextNode(tag);
      chip.parentNode.replaceChild(textNode, chip);
    }
  });

  return temp.innerHTML;
}

export default function VisualRichEditor({ value, onChange, placeholder = "Ketik isi email..." }) {
  const editorRef = useRef(null);
  const isUpdatingRef = useRef(false);

  // Sync value dari luar ke contentEditable tanpa mengganggu kursor
  useEffect(() => {
    if (!editorRef.current) return;
    const currentVisual = editorRef.current.innerHTML;
    const targetVisual = htmlToVisual(value || "");

    if (currentVisual !== targetVisual && !isUpdatingRef.current) {
      editorRef.current.innerHTML = targetVisual;
    }
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    isUpdatingRef.current = true;
    const currentHtml = editorRef.current.innerHTML;
    const cleanOutput = visualToHtml(currentHtml);
    onChange(cleanOutput);
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 50);
  };

  const execCommand = (command, arg = null) => {
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  const insertVariableChip = (tag, label, icon) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const chipHtml = `<span class="var-chip inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700 font-semibold px-2 py-0.5 rounded text-xs select-none shadow-xs mx-0.5" contenteditable="false" data-tag="${tag}"><span>${icon}</span><span>${label}</span></span>&nbsp;`;

    const selection = window.getSelection();
    if (selection.getRangeAt && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      range.deleteContents();

      const el = document.createElement("div");
      el.innerHTML = chipHtml;
      const frag = document.createDocumentFragment();
      let node;
      let lastNode;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);

      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      editorRef.current.innerHTML += chipHtml;
    }
    handleInput();
  };

  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden shadow-xs">
      {/* Toolbar Atas (Seperti Word / Gmail) */}
      <div className="bg-slate-100 dark:bg-slate-900 p-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-1">
        {/* Format Text */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-slate-300 dark:border-slate-700">
          <button
            type="button"
            onClick={() => execCommand("bold")}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            title="Tebal (Bold)"
          >
            <Bold className="w-4 h-4 font-bold" />
          </button>
          <button
            type="button"
            onClick={() => execCommand("italic")}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            title="Miring (Italic)"
          >
            <Italic className="w-4 h-4 italic" />
          </button>
          <button
            type="button"
            onClick={() => execCommand("underline")}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            title="Garis Bawah (Underline)"
          >
            <Underline className="w-4 h-4" />
          </button>
        </div>

        {/* Headings / Style */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-slate-300 dark:border-slate-700">
          <button
            type="button"
            onClick={() => execCommand("formatBlock", "<h2>")}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1"
            title="Judul Besar"
          >
            <Heading1 className="w-4 h-4" /> Judul
          </button>
          <button
            type="button"
            onClick={() => execCommand("formatBlock", "<p>")}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs flex items-center gap-1"
            title="Teks Normal"
          >
            <Type className="w-4 h-4" /> Normal
          </button>
          <button
            type="button"
            onClick={() => execCommand("insertUnorderedList")}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            title="Daftar Poin"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Chip Variabel Baris Cepat */}
        <div className="flex flex-wrap items-center gap-1 pl-1">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">
            + Sisip Chip:
          </span>
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.tag}
              type="button"
              onClick={() => insertVariableChip(p.tag, p.label, p.icon)}
              className="px-2 py-0.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-1 shadow-2xs font-medium"
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor ContentEditable (Area Pengetikan Tanpa Tag HTML) */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-4 min-h-[220px] max-h-[400px] overflow-y-auto focus:outline-hidden prose dark:prose-invert max-w-none text-sm leading-relaxed"
        style={{ whiteSpace: "pre-wrap" }}
      />
    </div>
  );
}
