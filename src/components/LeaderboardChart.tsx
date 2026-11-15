import React from 'react';
import { Award, Trophy } from 'lucide-react';
import { LeaderboardEntry } from '../game/types';

interface LeaderboardChartProps {
  entries: LeaderboardEntry[];
  highlightName?: string;
  compact?: boolean;
}

export const LeaderboardChart: React.FC<LeaderboardChartProps> = ({
  entries,
  highlightName,
  compact = false,
}) => {
  const maxScore = Math.max(10, ...entries.map((e) => e.score));
  const visibleEntries = compact ? entries.slice(0, 5) : entries.slice(0, 8);

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/80 p-5 text-center">
        <Trophy className="mx-auto h-9 w-9 text-amber-500" />
        <div className="font-display mt-2 text-lg font-bold text-slate-800">
          No Top Drivers Yet!
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-600">
          Enter your name and complete your drive to put your score on the chart!
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
          <span className="font-display text-base sm:text-lg font-bold text-slate-900">
            Highest Points Chart
          </span>
        </div>
        <span className="text-[11px] sm:text-xs font-bold text-slate-500 whitespace-nowrap">
          1 Turn Per Player
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {visibleEntries.map((entry, idx) => {
          const widthPct = Math.max(12, Math.round((entry.score / maxScore) * 100));
          const isMe =
            highlightName &&
            entry.name.toLowerCase() === highlightName.trim().toLowerCase();

          return (
            <div
              key={`${entry.name}-${idx}`}
              className={`rounded-xl border-2 p-2 sm:p-2.5 ${
                isMe
                  ? 'border-sky-500 bg-sky-50/90'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span
                    className={`font-display flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      idx === 0
                        ? 'bg-[#FFE600] text-slate-900'
                        : idx === 1
                          ? 'bg-slate-200 text-slate-800'
                          : idx === 2
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {idx === 0 ? <Award className="h-3.5 w-3.5" /> : `#${idx + 1}`}
                  </span>
                  <span className="font-display truncate text-xs sm:text-sm font-bold text-slate-900">
                    {entry.name}
                  </span>
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-400 whitespace-nowrap">
                    · Block {entry.blockLevel}
                  </span>
                </div>
                <span className="font-display tabular-nums text-sm sm:text-base font-bold text-slate-900 whitespace-nowrap">
                  {entry.score} pts
                </span>
              </div>

              <div className="h-2.5 sm:h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: entry.carColorCss || '#00D4FF',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
