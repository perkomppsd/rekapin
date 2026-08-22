import React from "react";
import { Star } from "lucide-react";

export default function StarRating({ value = 0, onChange, readOnly = false, size = 16, testid }) {
  const v = Number(value) || 0;
  return (
    <div className="inline-flex items-center gap-0.5" data-testid={testid}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          disabled={readOnly}
          onClick={() => !readOnly && onChange && onChange(n === v ? 0 : n)}
          className={`transition-transform ${readOnly ? "cursor-default" : "hover:scale-110"}`}
          data-testid={testid ? `${testid}-star-${n}` : undefined}
          aria-label={`${n} bintang`}
        >
          <Star
            size={size}
            className={n <= v ? "fill-amber-400 stroke-amber-400" : "stroke-slate-600"}
          />
        </button>
      ))}
    </div>
  );
}
