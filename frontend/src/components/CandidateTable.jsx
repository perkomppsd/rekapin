// Tabel kandidat generik.
//
// Kolom tiap tab diatur di config/tableViews.js — tidak ada JSX per tab lagi.
// Label kolom diambil dari /api/meta, jadi ganti nama kolom cukup di schema.py.

import React from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Ban, History, Mail } from "lucide-react";
import StarRating from "@/components/StarRating";
import { useMeta } from "@/context/MetaContext";
import { columnsFor } from "@/config/tableViews";
import { toneForStatus } from "@/config/statusTones";
import { T, tone } from "@/config/theme";

const RATING_FIELDS = ["nilai_wajah", "nilai_komunikasi", "nilai_kedisiplinan"];

// NIK sementara (kandidat yang KTP-nya belum dikumpulkan) ditampilkan samar
// dan diberi label, supaya kelihatan mana yang masih perlu ditindaklanjuti.
function NikCell({ value, tempPrefix }) {
  if (!value) return <span className="text-slate-500">—</span>;
  const sementara = tempPrefix && String(value).startsWith(tempPrefix);
  if (!sementara) return <span className="text-slate-300 font-mono text-xs">{value}</span>;
  return (
    <span className="inline-flex items-center gap-1.5" title="NIK sementara — ganti kalau KTP sudah ada">
      <span className="text-slate-500 font-mono text-xs">{value}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
        sementara
      </span>
    </span>
  );
}

function StatusPill({ fieldKey, value }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${tone(toneForStatus(fieldKey, value), "pill")}`}>
      {value || "—"}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

const ratingAverage = (row) => {
  const values = RATING_FIELDS.map((k) => row[k]).filter((n) => n);
  return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "—";
};

// Cara menampilkan sel. Tambah tampilan baru: tambah satu entri di sini.
const VARIANTS = {
  primary: (v) => <span className="font-medium text-slate-50">{v || "—"}</span>,
  text: (v) => <span className="text-slate-300">{v || "—"}</span>,
  mutedXs: (v) => <span className="text-slate-300 text-xs">{v || "—"}</span>,
  mono: (v) => <span className="text-slate-300 font-mono text-xs">{v || "—"}</span>,
  truncate: (v) => (
    <span className="text-slate-400 text-xs max-w-[200px] truncate block" title={v || ""}>
      {v || "—"}
    </span>
  ),
  date: (v) => <span className="text-slate-400 text-xs">{fmtDate(v)}</span>,
};

// Kolom khusus yang bukan field kandidat.
const SPECIAL_CELLS = {
  __rating_avg: (row) => (
    <span className="inline-flex items-center gap-1 text-amber-300 text-xs">★ {ratingAverage(row)}</span>
  ),
  __rating_stack: (row) => (
    <div className="flex flex-col gap-0.5">
      {RATING_FIELDS.map((k) => (
        <StarRating key={k} value={row[k] || 0} readOnly size={11} />
      ))}
    </div>
  ),
  __blacklist_info: (row) => (
    <div className="max-w-[320px]">
      <StatusPill fieldKey="status_blacklist" value={row.status_blacklist} />
      <div className="text-xs text-slate-300 mt-1 whitespace-pre-wrap break-words"
        title={row.alasan_blacklist}>
        {row.alasan_blacklist || <span className="text-slate-500">Tidak ada alasan</span>}
      </div>
    </div>
  ),
};

function Cell({ column, row, field, tempPrefix }) {
  const special = SPECIAL_CELLS[column.key];
  if (special) return special(row);

  const value = row[column.key] || (column.fallback ? row[column.fallback] : "");
  if (column.key === "nik") return <NikCell value={value} tempPrefix={tempPrefix} />;
  const variant = column.variant
    || (field?.type === "select" ? "status" : null)
    || "text";

  if (variant === "status") return <StatusPill fieldKey={column.key} value={value} />;
  return (VARIANTS[variant] || VARIANTS.text)(value);
}

function RowActions({ row, onEdit, onDelete, onBlacklist, onShowHistory, onSendEmail }) {
  const alreadyBlacklisted = (row.status_blacklist || "").toLowerCase().startsWith("ya");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid={`row-actions-${row.id}`}
          className="h-8 w-8 text-slate-400 hover:text-slate-50 hover:bg-slate-800">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-100">
        <DropdownMenuItem onClick={() => onEdit(row)} data-testid={`action-edit-${row.id}`}
          className="focus:bg-slate-800 focus:text-slate-50">
          <Pencil className="w-4 h-4 mr-2" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSendEmail && onSendEmail(row)}
          data-testid={`action-email-${row.id}`} className="focus:bg-slate-800 focus:text-slate-50">
          <Mail className="w-4 h-4 mr-2" /> Kirim Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShowHistory && onShowHistory(row)}
          data-testid={`action-history-${row.id}`} className="focus:bg-slate-800 focus:text-slate-50">
          <History className="w-4 h-4 mr-2" /> Riwayat
        </DropdownMenuItem>
        {!alreadyBlacklisted && (
          <DropdownMenuItem onClick={() => onBlacklist(row)} data-testid={`action-blacklist-${row.id}`}
            className="focus:bg-slate-800 focus:text-slate-50">
            <Ban className="w-4 h-4 mr-2" /> Blacklist
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem onClick={() => onDelete(row)} data-testid={`action-delete-${row.id}`}
          className="text-rose-400 focus:bg-rose-500/10 focus:text-rose-300">
          <Trash2 className="w-4 h-4 mr-2" /> Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function CandidateTable({
  rows, onEdit, onDelete, onBlacklist, onShowHistory, onSendEmail, view = "master",
}) {
  const meta = useMeta();

  if (!rows?.length) {
    return (
      <div className="border border-dashed border-slate-800 rounded-xl py-16 text-center">
        <p className="text-slate-400">Belum ada data kandidat.</p>
        <p className="text-slate-500 text-sm mt-1">
          Klik <span className="text-indigo-400">Tambah Kandidat</span> untuk mulai.
        </p>
      </div>
    );
  }

  const columns = columnsFor(view);

  return (
    <div className={`${T.panelSubtle} overflow-hidden`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-900/70 sticky top-0">
            <TableRow className="border-slate-800 hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.key} className={`${T.th} h-11`}>
                  {c.label || meta.labelOf(c.key)}
                </TableHead>
              ))}
              <TableHead className={`${T.th} h-11`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-testid={`row-candidate-${row.id}`}
                className="border-slate-800/70 hover:bg-slate-800/40 data-row">
                {columns.map((c) => (
                  <TableCell key={c.key}>
                    <Cell column={c} row={row} field={meta.fieldByKey?.[c.key]}
                      tempPrefix={meta.nik_temp_prefix} />
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <RowActions row={row} onEdit={onEdit} onDelete={onDelete}
                    onBlacklist={onBlacklist} onShowHistory={onShowHistory}
                    onSendEmail={onSendEmail} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
