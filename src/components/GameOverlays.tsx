import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  Car,
  Check,
  Play,
  Trophy,
  UserPlus,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  CAR_COLORS,
  CAR_STYLES,
  CarStyleId,
  GameHUDState,
  LeaderboardEntry,
  UPGRADE_CATALOG,
  UpgradeDef,
  UpgradeId,
} from '../game/types';
import { LeaderboardChart } from './LeaderboardChart';

interface GameOverlaysProps {
  hud: GameHUDState;
  playerName: string;
  nameError: string | null;
  selectedCar: CarStyleId;
  selectedColorId: string;
  leaderboard: LeaderboardEntry[];
  muted: boolean;
  onToggleMute: () => void;
  onChangeName: (name: string) => void;
  onSelectCar: (style: CarStyleId) => void;
  onSelectColor: (colorId: string) => void;
  onStartGame: () => void;
  onPickUpgrade: (upgradeId: UpgradeId) => void;
  onResume: () => void;
  onBackToMenu: () => void;
}

export const GameOverlays: React.FC<GameOverlaysProps> = ({
  hud,
  playerName,
  nameError,
  selectedCar,
  selectedColorId,
  leaderboard,
  muted,
  onToggleMute,
  onChangeName,
  onSelectCar,
  onSelectColor,
  onStartGame,
  onPickUpgrade,
  onResume,
  onBackToMenu,
}) => {
  const [showChartModal, setShowChartModal] = useState(false);

  const upgradeChoices: UpgradeDef[] = useMemo(() => {
    if (hud.phase !== 'upgrade') return [];
    const pool = [...UPGRADE_CATALOG];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (hud.blockLevel * 7 + hud.score + i * 3) % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }, [hud.phase, hud.blockLevel, hud.score]);

  if (hud.phase === 'playing' || hud.phase === 'arrested') return null;

  // 1. START MENU (Unobstructed center viewport so player admires spinning 3D car)
  if (hud.phase === 'menu') {
    return (
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-6">
        {/* Top Header Strip */}
        <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
          <div className="pointer-events-auto rounded-2xl sm:rounded-3xl border-2 border-slate-900/15 border-b-4 bg-[#FFFDF5]/95 px-3.5 py-2 sm:px-5 sm:py-3 shadow-md max-w-[calc(100%-7.5rem)] sm:max-w-none">
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Bumpy Town!
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-[#FFE600] border border-amber-600" />
                Low +1 Pt
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-[#FF6D00] border border-orange-700" />
                Medium +3 (Rare)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-[#FF2E93] border border-pink-700" />
                High +5 &amp; +1 Honk
              </span>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowChartModal(true)}
              aria-label="Open Highest Points Chart"
              className="font-display flex h-11 sm:h-12 items-center gap-1.5 sm:gap-2 rounded-2xl border-2 border-amber-500 border-b-4 bg-[#FFE600] px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-900 hover:bg-yellow-300 active:translate-y-0.5 cursor-pointer whitespace-nowrap"
            >
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="sm:hidden">Chart</span>
              <span className="hidden sm:inline">Highest Points Chart</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
              className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border-2 border-slate-900/15 border-b-4 bg-[#FFFDF5]/95 text-slate-800 hover:bg-white active:translate-y-0.5 cursor-pointer"
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Bottom Group: Drag Hint + Car Picker Dock */}
        <div className="flex flex-col items-center gap-2">
          <div className="pointer-events-none rounded-xl bg-slate-900/55 px-3 py-1 text-[11px] sm:text-xs font-bold text-white">
            Drag left or right to spin your 3D car!
          </div>

          {/* Bottom Car Picker Dock: Name + Car Style + Car Color Swatches + Start Drive */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onStartGame();
            }}
            className="pointer-events-auto mx-auto w-full max-w-4xl max-h-[60dvh] overflow-y-auto sm:max-h-none rounded-2xl sm:rounded-3xl border-2 border-slate-900/15 border-b-8 bg-[#FFFDF5]/95 p-3 sm:p-5 shadow-xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-4 items-end">
              {/* Driver Name Input (1 turn per unique name) */}
              <div className="md:col-span-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label
                    htmlFor="driver-name-input"
                    className="text-xs font-bold text-slate-600"
                  >
                    Your Driver Name
                  </label>
                  <span className="text-[11px] font-bold text-sky-700">
                    1 turn per name
                  </span>
                </div>
                <input
                  id="driver-name-input"
                  type="text"
                  maxLength={18}
                  value={playerName}
                  onChange={(e) => onChangeName(e.target.value)}
                  placeholder="Enter a unique name..."
                  className={`font-display w-full rounded-xl sm:rounded-2xl border-2 bg-white px-3 py-2 sm:px-3.5 sm:py-2.5 text-sm sm:text-base font-bold text-slate-900 outline-none ${
                    nameError
                      ? 'border-[#FF2E63] focus:border-[#FF2E63]'
                      : 'border-sky-300 focus:border-sky-500'
                  }`}
                />
              </div>

              {/* Car Model Picker */}
              <div className="md:col-span-5">
                <div className="mb-1 text-xs font-bold text-slate-600">
                  Choose Car Style
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {CAR_STYLES.map((car) => {
                    const active = selectedCar === car.id;
                    return (
                      <button
                        key={car.id}
                        type="button"
                        onClick={() => onSelectCar(car.id)}
                        className={`font-display flex min-h-[44px] items-center justify-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl border-2 border-b-4 px-1.5 sm:px-2.5 py-2 text-[11px] sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                          active
                            ? 'border-sky-600 bg-sky-100 text-sky-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <Car className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span className="truncate">{car.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start Driving CTA */}
              <div className="md:col-span-3">
                <button
                  type="submit"
                  className="font-display flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl sm:rounded-2xl border-2 border-emerald-800 border-b-4 bg-[#38B000] py-2.5 sm:py-3.5 px-4 sm:px-5 text-base sm:text-lg font-bold text-white transition-transform hover:bg-emerald-500 active:translate-y-0.5 cursor-pointer whitespace-nowrap"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>Start Drive!</span>
                </button>
              </div>
            </div>

            {nameError && (
              <div
                role="alert"
                className="mt-2.5 flex items-center gap-2 rounded-xl border-2 border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-[#BE123C]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{nameError}</span>
              </div>
            )}

            {/* Car Paint Color Swatches */}
            <div className="mt-2.5 sm:mt-3.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-t border-slate-200/80 pt-2.5 sm:pt-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-xs font-bold text-slate-500 mr-0.5">
                  Car Color:
                </span>
                {CAR_COLORS.map((color) => {
                  const selected = selectedColorId === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      aria-label={`Select ${color.name} paint`}
                      title={color.name}
                      onClick={() => onSelectColor(color.id)}
                      style={{ backgroundColor: color.css }}
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border-2 transition-transform cursor-pointer ${
                        selected
                          ? 'scale-110 border-slate-900 shadow-sm'
                          : 'border-slate-900/20 hover:scale-105'
                      }`}
                    >
                      {selected && (
                        <Check className="h-4 w-4 text-slate-900 stroke-[3]" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] sm:text-xs font-bold text-slate-500">
                <span className="sm:hidden">Max 3-min challenge · Stop at Red Lights (Block 3+)</span>
                <span className="hidden sm:inline">
                  A/D Steer · W/Up Boost · S/Down Brake · Space Honk · Stop at Red Lights (Block 3+)
                </span>
              </div>
            </div>
          </form>
        </div>

        {/* Leaderboard Modal */}
        {showChartModal && (
          <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4">
            <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border-4 border-amber-400 border-b-8 bg-[#FFFDF5] p-4 sm:p-6 shadow-xl">
              <div className="mb-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowChartModal(false)}
                  aria-label="Close chart"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <LeaderboardChart
                entries={leaderboard}
                highlightName={playerName}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-slate-900/45">
      {/* 2. ITERATIVE BLOCK UPGRADE PICKER */}
      {hud.phase === 'upgrade' && (
        <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border-4 border-amber-400 border-b-8 bg-[#FFFDF5] p-4 sm:p-8 shadow-xl">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-[#FFE600] text-slate-900 border-b-4 border-amber-500">
              <Award className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold text-slate-900 text-balance">
              Block {hud.blockLevel} Complete!
            </h2>
            <p className="mt-1 text-xs sm:text-base font-semibold text-slate-600">
              Nice job, {hud.playerName}! Pick an upgrade for Block {hud.blockLevel + 1}:
            </p>
          </div>

          <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {upgradeChoices.map((upg) => (
              <button
                key={upg.id}
                type="button"
                onClick={() => onPickUpgrade(upg.id)}
                className="flex flex-col justify-between rounded-2xl border-2 border-slate-200 border-b-4 bg-white p-3.5 sm:p-4 text-left transition-all hover:-translate-y-1 hover:border-sky-500 hover:bg-sky-50/50 cursor-pointer"
              >
                <div>
                  <div
                    className="mb-2 sm:mb-3 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl text-white border-b-2 border-black/20"
                    style={{ backgroundColor: upg.color }}
                  >
                    <Zap className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="font-display text-base sm:text-lg font-bold text-slate-900">
                    {upg.title}
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">
                    {upg.description}
                  </p>
                </div>
                <div className="mt-3 sm:mt-4 pt-2 border-t border-slate-100 text-xs font-bold text-sky-700">
                  {upg.badgeText}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. PAUSE MENU (No Restart Option — 1 Turn Only) */}
      {hud.phase === 'paused' && (
        <div className="w-full max-w-sm rounded-3xl border-4 border-slate-900/15 border-b-8 bg-[#FFFDF5] p-5 sm:p-6 text-center shadow-xl">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Pit Stop!
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {hud.playerName} · <span className="tabular-nums font-bold">{hud.score}</span> pts · Block {hud.blockLevel}
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="font-display flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-800 border-b-4 bg-[#38B000] py-3 text-lg font-bold text-white hover:bg-emerald-500 active:translate-y-0.5 cursor-pointer"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>Keep Driving</span>
            </button>
            <button
              type="button"
              onClick={onBackToMenu}
              className="font-display flex min-h-[44px] w-full items-center justify-center rounded-2xl border-2 border-slate-300 border-b-4 bg-white py-3 text-base font-bold text-slate-700 hover:bg-slate-50 active:translate-y-0.5 cursor-pointer"
            >
              Exit to Main Menu
            </button>
          </div>
        </div>
      )}

      {/* 4. GAME OVER + HIGHEST POINTS CHART (No Play Again / Restart) */}
      {hud.phase === 'gameover' && (
        <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl border-4 border-rose-300 border-b-8 bg-[#FFFDF5] p-4 sm:p-7 text-center shadow-xl">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFE600] text-slate-900 border-b-4 border-amber-500">
            <Trophy className="h-7 w-7" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            {hud.gameOverReason === 'time'
              ? `Time's Up, ${hud.playerName}!`
              : `Arrested! Out of Hearts, ${hud.playerName}!`}
          </h2>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-600">
            {hud.gameOverReason === 'time'
              ? `3-minute limit reached at Block ${hud.blockLevel} with ${hud.potholesHit} potholes!`
              : `Police pulled you over at Block ${hud.blockLevel} after ${hud.potholesHit} potholes!`}
          </p>

          <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-2.5 sm:p-3">
              <div className="text-xs font-bold text-amber-800">Your Score</div>
              <div className="font-display tabular-nums mt-0.5 text-2xl sm:text-3xl font-bold text-slate-900">
                {hud.score}
              </div>
            </div>
            <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-2.5 sm:p-3">
              <div className="text-xs font-bold text-sky-800">All-Time Best</div>
              <div className="font-display tabular-nums mt-0.5 text-2xl sm:text-3xl font-bold text-slate-900">
                {hud.bestScore}
              </div>
            </div>
          </div>

          {/* Top Drivers Horizontal Bar Chart */}
          <div className="mt-4 sm:mt-5 text-left">
            <LeaderboardChart
              entries={leaderboard}
              highlightName={hud.playerName}
              compact
            />
          </div>

          <div className="mt-4 sm:mt-5">
            <button
              type="button"
              onClick={onBackToMenu}
              className="font-display flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-sky-700 border-b-4 bg-[#00D4FF] py-3 px-5 text-base sm:text-lg font-bold text-slate-900 hover:bg-sky-300 active:translate-y-0.5 cursor-pointer"
            >
              <UserPlus className="h-5 w-5" />
              <span>Next Player</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
