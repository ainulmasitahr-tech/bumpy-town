import { CarStyleId, LeaderboardEntry } from './types';

const LEADERBOARD_KEY = 'bumpy_town_leaderboard_v1';
const USED_NAMES_KEY = 'bumpy_town_used_names_v1';

function loadUsedNamesSet(): Set<string> {
  const names = new Set<string>();
  try {
    const raw = localStorage.getItem(USED_NAMES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const n of parsed) {
          if (typeof n === 'string' && n.trim()) {
            names.add(n.trim().toLowerCase());
          }
        }
      }
    }
  } catch {
    // ignore storage errors
  }

  for (const entry of loadLeaderboard()) {
    if (entry.name.trim()) {
      names.add(entry.name.trim().toLowerCase());
    }
  }
  return names;
}

export function hasNamePlayed(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return loadUsedNamesSet().has(normalized);
}

export function markNameUsed(name: string): void {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return;
  const set = loadUsedNamesSet();
  set.add(normalized);
  try {
    localStorage.setItem(USED_NAMES_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore storage errors
  }
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is LeaderboardEntry =>
          item &&
          typeof item.name === 'string' &&
          typeof item.score === 'number',
      )
      .sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

export function recordDriverScore(entry: {
  name: string;
  score: number;
  blockLevel: number;
  potholesHit: number;
  carColorCss: string;
  carStyle: CarStyleId;
}): LeaderboardEntry[] {
  const cleanName = entry.name.trim() || 'Driver';
  markNameUsed(cleanName);
  const current = loadLeaderboard();

  const existingIdx = current.findIndex(
    (item) => item.name.toLowerCase() === cleanName.toLowerCase(),
  );

  if (existingIdx >= 0) {
    const existing = current[existingIdx];
    if (entry.score >= existing.score) {
      current[existingIdx] = {
        ...entry,
        name: cleanName,
        updatedAt: Date.now(),
      };
    }
  } else {
    current.push({
      ...entry,
      name: cleanName,
      updatedAt: Date.now(),
    });
  }

  const sorted = current.sort((a, b) => b.score - a.score).slice(0, 20);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(sorted));
  } catch {
    // ignore storage errors
  }
  return sorted;
}
