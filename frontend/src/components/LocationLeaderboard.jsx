'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/format';
import { Award, ChevronRight, Trophy } from 'lucide-react';

const LEADERBOARD_LEVELS = [
  { value: 'ward', label: 'Ward', minResponses: 1 },
  { value: 'municipality', label: 'Municipality', minResponses: 2 },
  { value: 'province', label: 'Province', minResponses: 3 },
];

const RANK_STYLES = [
  { className: 'bg-amber-100 text-amber-700', icon: Trophy },
  { className: 'bg-slate-100 text-slate-600', icon: Award },
  { className: 'bg-orange-100 text-orange-700', icon: Award },
];

function buildLeaderboard(rows, level, limit) {
  const groups = new Map();
  for (const r of rows) {
    if (!r.province || !r.municipality) continue;
    let key, label, sub;
    if (level === 'ward') {
      if (!r.ward) continue;
      key = `${r.province}|${r.district}|${r.municipality}|${r.ward}`;
      label = `Ward ${r.ward}`;
      sub = `${r.municipality}, ${r.district}`;
    } else if (level === 'municipality') {
      key = `${r.province}|${r.district}|${r.municipality}`;
      label = r.municipality;
      sub = `${r.district}, ${r.province}`;
    } else {
      key = r.province;
      label = r.province;
      sub = 'Province';
    }
    if (!groups.has(key)) groups.set(key, { key, label, sub, yes: 0, partially: 0, no: 0, total: 0 });
    const g = groups.get(key);
    g.total += 1;
    g[r.feedbackType] = (g[r.feedbackType] || 0) + 1;
  }
  const minResponses = LEADERBOARD_LEVELS.find(l => l.value === level)?.minResponses || 1;
  const ranked = [...groups.values()]
    .filter(g => g.total >= minResponses)
    .map(g => ({ ...g, score: (g.yes + g.partially * 0.5) / g.total }))
    .sort((a, b) => b.score - a.score || b.total - a.total);
  return limit ? ranked.slice(0, limit) : ranked;
}

// "Who's earning citizen trust" board with a Ward / Municipality / Province
// switcher. Takes the already-merged real+demo feedback rows as a prop, so
// it stays in sync automatically wherever a new submission is fetched from -
// currently only used on the Authorities page's "Budget Leaderboard" tab,
// fed by the same useNationalFeedback() hook that powers the Public Budget
// feedback board. `limit` caps how many ranked locations are shown per
// level - omit it (or pass 0) to show the complete ranking.
export default function LocationLeaderboard({ rows, onViewAll, viewAllLabel = 'View all feedback', limit = 0, title = 'Top Rated Locations', subtitle = 'Best citizen approval' }) {
  const [level, setLevel] = useState('ward');
  const data = useMemo(() => buildLeaderboard(rows, level, limit), [rows, level, limit]);

  return (
    <div className="rounded-lg border border-[#ded6c8] bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#dc143c]">{title}</p>
      <h3 className="mt-0.5 text-sm font-black text-[#102a2b]">{subtitle}</h3>
      <p className="mt-0.5 text-[11px] text-[#8c8272]">Ranked from Public Budget community feedback - updates as citizens submit new responses.</p>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-[#f7f2ea] p-1">
        {LEADERBOARD_LEVELS.map(l => (
          <button key={l.value} onClick={() => setLevel(l.value)} className={cn('rounded-md py-1.5 text-[11px] font-black transition-colors', level === l.value ? 'bg-[#0f3d3e] text-white' : 'text-[#65706c] hover:text-[#0f3d3e]')}>
            {l.label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <p className="mt-4 rounded-lg bg-[#f8fbfd] p-3 text-center text-xs text-[#65706c]">Not enough feedback yet at this level.</p>
      ) : (
        <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-0.5">
          {data.map((g, i) => {
            const rank = RANK_STYLES[i] || { className: 'bg-[#f7f2ea] text-[#8c8272]', icon: null };
            const RankIcon = rank.icon;
            const rating = (g.score * 5).toFixed(1);
            return (
              <div key={g.key} className="flex items-center gap-2.5 rounded-lg border border-[#eee6d8] p-2.5">
                <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black', rank.className)}>
                  {RankIcon ? <RankIcon className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-[#102a2b]">{g.label}</p>
                  <p className="truncate text-[10px] text-[#8c8272]">{g.sub}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="flex items-center justify-end gap-0.5 text-xs font-black text-[#102a2b]">★ {rating}</p>
                  <p className="text-[10px] text-[#8c8272]">{g.total} {g.total === 1 ? 'response' : 'responses'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onViewAll && (
        <button onClick={onViewAll} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-[#ded6c8] py-2 text-xs font-black text-[#0f3d3e] hover:bg-[#eef6f4]">
          {viewAllLabel} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}