'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/format';

function pageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('ellipsis-' + p);
    out.push(p);
  });
  return out;
}

export default function Pagination({ page = 1, limit = 20, total = 0, totalPages, onPageChange, onLimitChange, pageSizeOptions = [20, 50, 100], label = 'records', className }) {
  const pages = totalPages || Math.max(1, Math.ceil(total / limit));
  if (!total || total <= limit) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  const canPrev = page > 1;
  const canNext = page < pages;

  const buttonClass = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--gov-border)] bg-white px-3 text-sm font-medium text-[var(--gov-muted)] transition-colors hover:bg-[#f6f8fb] disabled:cursor-not-allowed disabled:opacity-45';

  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border border-[var(--gov-border)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-sm text-[var(--gov-muted)]">Showing <span className="font-medium text-[var(--gov-text)]">{start}-{end}</span> of <span className="font-medium text-[var(--gov-text)]">{total}</span> {label}</p>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {onLimitChange && (
          <label className="mr-auto flex items-center gap-2 text-sm text-[var(--gov-muted)] sm:mr-2">
            <span className="hidden sm:inline">Rows per page</span>
            <select value={limit} onChange={e => onLimitChange(Number(e.target.value))} className="h-9 rounded-lg border border-[var(--gov-border)] bg-white px-2 text-sm outline-none focus:border-[var(--gov-primary)]">
              {pageSizeOptions.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        )}
        <button type="button" disabled={!canPrev} onClick={() => onPageChange(page - 1)} className={buttonClass} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span></button>
        <span className="px-2 text-sm font-medium text-[var(--gov-muted)] sm:hidden">{page} / {pages}</span>
        <div className="hidden items-center gap-1 sm:flex">
          {pageItems(page, pages).map(item => typeof item === 'number' ? (
            <button key={item} type="button" onClick={() => onPageChange(item)} aria-current={item === page ? 'page' : undefined} className={cn(buttonClass, item === page ? 'border-[var(--gov-primary)] bg-[#fff4f3] text-[var(--gov-primary)]' : '')}>{item}</button>
          ) : <span key={item} className="px-1 text-sm text-[var(--gov-subtle)]">...</span>)}
        </div>
        <button type="button" disabled={!canNext} onClick={() => onPageChange(page + 1)} className={buttonClass} aria-label="Next page"><span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
