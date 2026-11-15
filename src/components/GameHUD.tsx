import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Heart,
  Megaphone,
  Pause,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { FloatingScorePopup, GameHUDState } from '../game/types';

interface GameHUDProps {
  hud: GameHUDState;
  popups: FloatingScorePopup[];
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onHonk: () => void;
  onControlInput: (
    control: 'left' | 'right' | 'up' | 'down',
    active: boolean,
  ) => void;
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  popups,
  muted,
  onToggleMute,
  onPause,
  onHonk,
  onControlInput,
}) => {
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  const progressPct = Math.min(
    100,
    Math.round((hud.blockProgress / Math.max(1, hud.blockTarget)) * 100),
  );
  const hasHonkAmmo = hud.honkCharges > 0;
  const honkReady = hasHonkAmmo && hud.honkCooldownRatio <= 0.01;
  const lowTime = hud.timeRemainingSec <= 30;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-2 sm:p-5">
      {/* Floating 3D->2D Score & Safety Popups */}
      {popups.map((popup) => {
        const toneClasses =
          popup.tone === 'high'
            ? 'bg-[#FF2E93] text-white border-pink-800'
            : popup.tone === 'medium'
              ? 'bg-[#FF6D00] text-white border-orange-800'
              : popup.tone === 'warning'
                ? 'bg-[#FF2E63] text-white border-rose-800'
                : popup.tone === 'police'
                  ? 'bg-[#1D4ED8] text-white border-blue-950'
                  : popup.tone === 'honk'
                    ? 'bg-[#00D4FF] text-slate-900 border-sky-700'
                    : 'bg-[#38B000] text-white border-emerald-900';

        return (
          <div
            key={popup.id}
            style={{
              left: `${popup.xPercent}%`,
              top: `${popup.yPercent}%`,
            }}
            className={`animate-float-popup font-display pointer-events-none absolute z-20 whitespace-nowrap rounded-2xl border-2 border-b-4 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-sm sm:text-lg font-bold shadow-md ${toneClasses}`}
          >
            {popup.text}
          </div>
        );
      })}

      {/* Top Bar: Driver, Points, Honks, Block Progress, Timer, Hearts & Utility Actions */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:gap-3 rounded-2xl border-2 border-slate-900/15 border-b-4 bg-[#FFFDF5]/95 px-2.5 py-2 sm:px-4 sm:py-2.5 shadow-sm max-w-[calc(100%-6.25rem)] sm:max-w-none">
          {/* Driver Name + Points */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border-2 border-slate-900/15 text-slate-900"
              style={{ backgroundColor: hud.carColorCss }}
            >
              <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-white text-slate-900" />
            </div>
            <div className="min-w-0">
              <div className="max-w-[82px] sm:max-w-[115px] truncate text-[11px] sm:text-xs font-bold text-slate-500">
                {hud.playerName}
              </div>
              <div className="font-display tabular-nums text-lg sm:text-2xl leading-none font-bold text-slate-900">
                {hud.score}{' '}
                <span className="text-[11px] sm:text-xs font-bold text-slate-500">
                  pts
                </span>
              </div>
            </div>
          </div>

          <div className="h-7 sm:h-9 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />

          {/* Honk Charges */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-[#FFE600] text-slate-900 border-b-2 border-amber-500">
              <Megaphone className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-500 leading-tight">
                Honks
              </div>
              <div className="font-display tabular-nums text-sm sm:text-lg leading-none font-bold text-slate-900">
                {hud.honkCharges}
              </div>
            </div>
          </div>

          <div className="h-7 sm:h-9 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />

          {/* 3-Minute Run Countdown */}
          <div className="flex items-center gap-1.5">
            <div
              className={`flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl border-b-2 ${
                lowTime
                  ? 'bg-[#FF2E63] text-white border-rose-800'
                  : 'bg-[#00D4FF] text-slate-900 border-sky-600'
              }`}
            >
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-500 leading-tight">
                Time
              </div>
              <div
                className={`font-display tabular-nums text-sm sm:text-lg leading-none font-bold ${
                  lowTime ? 'text-[#FF2E63]' : 'text-slate-900'
                }`}
              >
                {formatTime(hud.timeRemainingSec)}
              </div>
            </div>
          </div>

          <div className="h-7 sm:h-9 w-px bg-slate-200 hidden md:block" aria-hidden="true" />

          {/* Block Progress */}
          <div className="min-w-[88px] sm:min-w-[122px]">
            <div className="mb-0.5 sm:mb-1 flex items-center justify-between gap-1.5 text-[11px] sm:text-xs font-bold text-slate-700">
              <span>Block {hud.blockLevel}</span>
              <span className="tabular-nums text-slate-500">
                {hud.blockProgress}/{hud.blockTarget}
              </span>
            </div>
            <div className="h-2.5 sm:h-3 w-full overflow-hidden rounded-full bg-sky-100 border border-sky-200">
              <div
                className="h-full rounded-full bg-[#00D4FF] transition-all duration-150"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Safety Hearts */}
          <div
            className="flex items-center gap-0.5 sm:gap-1"
            aria-label={`Safety hearts: ${hud.hearts} of ${hud.maxHearts}`}
          >
            {Array.from({ length: hud.maxHearts }).map((_, idx) => {
              const filled = idx < hud.hearts;
              return (
                <Heart
                  key={idx}
                  className={`h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-150 ${
                    filled
                      ? 'fill-[#FF2E63] text-[#BE123C] scale-100'
                      : 'fill-slate-200 text-slate-300 scale-90'
                  }`}
                />
              );
            })}
          </div>

          {hud.streak >= 2 && (
            <div className="font-display tabular-nums text-xs sm:text-sm font-bold text-[#FF6D00]">
              {hud.streak}x Streak
            </div>
          )}
        </div>

        {/* Right: Speed / Boost / Brake Readout + Sound & Pause */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {hud.isBoosting && (
            <div className="font-display hidden md:flex items-center gap-1.5 rounded-2xl border-2 border-emerald-800 border-b-4 bg-[#38B000] px-3 py-2 text-sm font-bold text-white">
              <Flame className="h-4 w-4 fill-current" />
              <span>BOOST!</span>
            </div>
          )}
          {hud.isBraking && (
            <div className="font-display hidden md:flex items-center rounded-2xl border-2 border-rose-800 border-b-4 bg-[#FF2E63] px-3 py-2 text-sm font-bold text-white">
              STOPPED / BRAKE
            </div>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border-2 border-slate-900/15 border-b-4 bg-[#FFFDF5]/95 text-slate-800 transition-transform active:translate-y-0.5 hover:bg-white cursor-pointer"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          {hud.phase === 'playing' && (
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause game"
              className="flex h-11 sm:h-12 items-center gap-1.5 sm:gap-2 rounded-2xl border-2 border-slate-900/15 border-b-4 bg-[#FFFDF5]/95 px-3 sm:px-4 text-sm font-bold text-slate-800 transition-transform active:translate-y-0.5 hover:bg-white cursor-pointer whitespace-nowrap"
            >
              <Pause className="h-4 w-4" />
              <span className="hidden sm:inline">Pause</span>
            </button>
          )}
        </div>
      </div>

      {/* Top-Center Alert: Arrest Banner, Red/Green Traffic Light Signal, Crosswalk Hint (1st & 2nd only), or Status Banner */}
      {hud.phase === 'arrested' && (
        <div className="pointer-events-none flex justify-center px-2">
          <div className="font-display rounded-2xl border-2 border-blue-950 border-b-4 bg-[#1D4ED8] px-4 py-2 text-center text-sm sm:text-lg font-bold text-white shadow-md">
            WEE-WOO! Out of Hearts — Police Are Arresting You!
          </div>
        </div>
      )}

      {hud.phase === 'playing' &&
        (hud.trafficLightAhead || hud.pedestrianAheadHint || hud.statusBanner) && (
          <div className="pointer-events-none flex flex-col items-center gap-1.5 px-2">
            {hud.trafficLightAhead && (
              <div
                className={`font-display flex flex-col items-center gap-1 rounded-2xl border-2 border-b-4 px-3.5 sm:px-4 py-1.5 text-center shadow-sm ${
                  hud.trafficLightAhead.state === 'red'
                    ? 'border-rose-900 bg-[#FF2E63] text-white'
                    : 'border-emerald-900 bg-[#00E676] text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 text-xs sm:text-base font-bold">
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full border border-black/30 ${
                      hud.trafficLightAhead.state === 'red'
                        ? 'bg-[#FFE600]'
                        : 'bg-white'
                    }`}
                  />
                  <span>
                    {hud.trafficLightAhead.state === 'red'
                      ? 'RED LIGHT! Hold Brake (S / Down) Until Green!'
                      : 'GREEN LIGHT! GO! (+3 Pts)'}
                  </span>
                </div>
                {hud.trafficLightAhead.state === 'red' &&
                  hud.trafficLightAhead.waitProgress > 0.02 && (
                    <div className="h-2 w-40 sm:w-52 overflow-hidden rounded-full bg-rose-950/50">
                      <div
                        className="h-full rounded-full bg-[#00E676] transition-all duration-75"
                        style={{
                          width: `${Math.round(hud.trafficLightAhead.waitProgress * 100)}%`,
                        }}
                      />
                    </div>
                  )}
              </div>
            )}

            {!hud.trafficLightAhead && hud.pedestrianAheadHint && (
              <div className="font-display rounded-2xl border-2 border-amber-500 border-b-4 bg-[#FFE600] px-3 sm:px-4 py-1.5 text-center text-xs sm:text-base font-bold text-slate-900 shadow-sm">
                People Crossing Ahead! Brake (S / Down) or Honk (Space) for +5 Pts!
              </div>
            )}

            {!hud.trafficLightAhead && !hud.pedestrianAheadHint && hud.statusBanner && (
              <div className="font-display rounded-2xl border-2 border-sky-700 border-b-4 bg-[#00D4FF] px-3 sm:px-4 py-1.5 text-center text-xs sm:text-base font-bold text-slate-900 shadow-sm">
                {hud.statusBanner}
              </div>
            )}
          </div>
        )}

      {/* Bottom Collapsible Playful Drive Dock (Mobile & Desktop Responsive) */}
      {hud.phase === 'playing' && (
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => setControlsCollapsed((v) => !v)}
            className="pointer-events-auto mb-1 flex items-center gap-1.5 rounded-t-xl border-2 border-b-0 border-slate-900/15 bg-[#FFFDF5]/95 px-3 py-1 text-[11px] sm:text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {controlsCollapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Show Drive Pad</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span className="sm:hidden">Hide Drive Pad</span>
                <span className="hidden sm:inline">
                  Hide Drive Pad (A/D Steer · W/Up Boost · S/Down Brake · Space Honk)
                </span>
              </>
            )}
          </button>

          {!controlsCollapsed && (
            <div className="pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-1.5 sm:gap-2 rounded-2xl border-2 border-slate-900/15 border-b-4 bg-[#FFFDF5]/95 px-2 py-2 sm:px-3 sm:py-2.5 shadow-md">
              {/* Left / Right Steering Pads */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  aria-label="Steer Left"
                  onPointerDown={() => onControlInput('left', true)}
                  onPointerUp={() => onControlInput('left', false)}
                  onPointerLeave={() => onControlInput('left', false)}
                  onPointerCancel={() => onControlInput('left', false)}
                  className="flex h-11 w-11 sm:h-12 sm:w-16 items-center justify-center rounded-xl border-2 border-sky-700 border-b-4 bg-[#00D4FF] text-slate-900 active:translate-y-0.5 cursor-pointer touch-none"
                >
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
                <button
                  type="button"
                  aria-label="Steer Right"
                  onPointerDown={() => onControlInput('right', true)}
                  onPointerUp={() => onControlInput('right', false)}
                  onPointerLeave={() => onControlInput('right', false)}
                  onPointerCancel={() => onControlInput('right', false)}
                  className="flex h-11 w-11 sm:h-12 sm:w-16 items-center justify-center rounded-xl border-2 border-sky-700 border-b-4 bg-[#00D4FF] text-slate-900 active:translate-y-0.5 cursor-pointer touch-none"
                >
                  <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              {/* Center Honk Button */}
              <button
                type="button"
                onClick={onHonk}
                disabled={!honkReady}
                className={`font-display relative flex h-11 sm:h-12 flex-1 min-w-0 max-w-[220px] items-center justify-center gap-1.5 sm:gap-2 overflow-hidden rounded-xl border-2 border-b-4 px-2 sm:px-3.5 text-xs sm:text-base font-bold transition-transform cursor-pointer whitespace-nowrap ${
                  honkReady
                    ? 'border-amber-600 bg-[#FFE600] text-slate-900 active:translate-y-0.5 hover:bg-yellow-300'
                    : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Megaphone className="relative z-10 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span className="relative z-10 truncate">
                  {hasHonkAmmo ? (
                    `Honk (${hud.honkCharges})`
                  ) : (
                    <>
                      <span className="sm:hidden">No Honk</span>
                      <span className="hidden sm:inline">Need High Pothole</span>
                    </>
                  )}
                </span>
              </button>

              {/* Brake / Boost Pedals */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onPointerDown={() => onControlInput('down', true)}
                  onPointerUp={() => onControlInput('down', false)}
                  onPointerLeave={() => onControlInput('down', false)}
                  onPointerCancel={() => onControlInput('down', false)}
                  className="font-display flex h-11 sm:h-12 items-center justify-center rounded-xl border-2 border-rose-800 border-b-4 bg-[#FF2E63] px-2.5 sm:px-4 text-xs sm:text-sm font-bold text-white active:translate-y-0.5 cursor-pointer whitespace-nowrap touch-none"
                >
                  <span className="sm:hidden">Brake</span>
                  <span className="hidden sm:inline">Brake (S)</span>
                </button>
                <button
                  type="button"
                  onPointerDown={() => onControlInput('up', true)}
                  onPointerUp={() => onControlInput('up', false)}
                  onPointerLeave={() => onControlInput('up', false)}
                  onPointerCancel={() => onControlInput('up', false)}
                  className="font-display flex h-11 sm:h-12 items-center justify-center rounded-xl border-2 border-emerald-900 border-b-4 bg-[#38B000] px-2.5 sm:px-4 text-xs sm:text-sm font-bold text-white active:translate-y-0.5 cursor-pointer whitespace-nowrap touch-none"
                >
                  <span className="sm:hidden">Boost</span>
                  <span className="hidden sm:inline">Boost (W)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
