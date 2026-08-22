// Navigasi halaman untuk tabel kandidat.
// `info` = { total, page, pages, per_page } dari GET /api/candidates.

import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { T } from "@/config/theme";

export default function Pagination({ info, onChange, disabled = false }) {
  const { total = 0, page = 1, pages = 1, per_page: perPage = 0 } = info || {};
  if (!total) return null;

  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between gap-3 mt-3 px-1" data-testid="pagination">
      <div className={T.hint} data-testid="pagination-info">
        Menampilkan <span className="text-slate-300">{first}–{last}</span> dari{" "}
        <span className="text-slate-300">{total}</span> kandidat
      </div>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={disabled || page <= 1}
            onClick={() => onChange(page - 1)} data-testid="btn-prev-page"
            className={T.btnOutline}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
          </Button>
          <span className={`${T.hint} tabular-nums`} data-testid="pagination-page">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={disabled || page >= pages}
            onClick={() => onChange(page + 1)} data-testid="btn-next-page"
            className={T.btnOutline}>
            Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
