import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { GameOverlays } from './components/GameOverlays';
import { BumpyTownEngine } from './game/BumpyTownEngine';
import { hasNamePlayed, loadLeaderboard } from './game/leaderboard';
import { soundFX } from './game/sound';
import {
  CAR_COLORS,
  CAR_STYLES,
  CarStyleId,
  FloatingScorePopup,
  GameHUDState,
  LeaderboardEntry,
  UpgradeId,
} from './game/types';

const INITIAL_HUD: GameHUDState = {
  phase: 'menu',
  playerName: 'Driver',
  carColorCss: CAR_COLORS[0].css,
  score: 0,
  bestScore: 0,
  potholesHit: 0,
  blockLevel: 1,
  blockProgress: 0,
  blockTarget: 10,
  hearts: 3,
  maxHearts: 3,
  streak: 0,
  honkCharges: 2,
  honkCooldownRatio: 0,
  speedKmh: 0,
  timeRemainingSec: 180,
  isBoosting: false,
  isBraking: false,
  activeUpgrades: [],
  statusBanner: null,
  pedestrianAheadHint: false,
  trafficLightAhead: null,
  gameOverReason: 'hearts',
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BumpyTownEngine | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragLastXRef = useRef<number>(0);

  const [hud, setHud] = useState<GameHUDState>(INITIAL_HUD);
  const [playerName, setPlayerName] = useState<string>('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedCar, setSelectedCar] = useState<CarStyleId>('taxi');
  const [selectedColorId, setSelectedColorId] = useState<string>(CAR_COLORS[0].id);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    loadLeaderboard(),
  );
  const [muted, setMuted] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [popups, setPopups] = useState<FloatingScorePopup[]>([]);

  const handlePopup = useCallback((popup: FloatingScorePopup) => {
    setPopups((prev) => [...prev.slice(-6), popup]);
    window.setTimeout(() => {
      setPopups((prev) => prev.filter((item) => item.id !== popup.id));
    }, 880);
  }, []);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new BumpyTownEngine(mount, {
      onHUDUpdate: (nextHud) => setHud(nextHud),
      onPopup: handlePopup,
      onContextLost: (lost) => setContextLost(lost),
      onLeaderboardUpdate: (entries) => setLeaderboard(entries),
    });
    engineRef.current = engine;

    const unlockAudio = () => {
      soundFX.unlock();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      engine.dispose();
      engineRef.current = null;
    };
  }, [handlePopup]);

  // Keyboard controls (disabled while typing inside driver name input)
  useEffect(() => {
    const mapKey = (
      code: string,
    ): 'left' | 'right' | 'up' | 'down' | null => {
      if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
      if (code === 'ArrowRight' || code === 'KeyD') return 'right';
      if (code === 'ArrowUp' || code === 'KeyW') return 'up';
      if (code === 'ArrowDown' || code === 'KeyS') return 'down';
      return null;
    };

    const isTypingInInput = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return (
        el?.tagName === 'INPUT' ||
        el?.tagName === 'TEXTAREA' ||
        el?.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;
      const engine = engineRef.current;
      if (!engine) return;

      const mapped = mapKey(e.code);
      if (mapped) {
        e.preventDefault();
        engine.setControlInput(mapped, true);
        return;
      }

      if (e.code === 'Space' || e.code === 'KeyH') {
        e.preventDefault();
        engine.triggerHonk();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        setHud((current) => {
          if (current.phase === 'playing') engine.setPaused(true);
          else if (current.phase === 'paused') engine.setPaused(false);
          return current;
        });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const mapped = mapKey(e.code);
      if (mapped) {
        engine.setControlInput(mapped, false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleChangeName = useCallback((name: string) => {
    setPlayerName(name);
    if (name.trim() && hasNamePlayed(name)) {
      setNameError(`"${name.trim()}" already played! Each name can only play once.`);
    } else {
      setNameError(null);
    }
    engineRef.current?.setPlayerName(name);
  }, []);

  const handleSelectCar = useCallback((style: CarStyleId) => {
    soundFX.unlock();
    soundFX.playCarPick();
    setSelectedCar(style);
    engineRef.current?.setCarStyle(style);

    const styleDef = CAR_STYLES.find((c) => c.id === style);
    if (styleDef) {
      const colorDef = CAR_COLORS.find((c) => c.id === styleDef.defaultColorId);
      if (colorDef) {
        setSelectedColorId(colorDef.id);
        engineRef.current?.setCarColor(
          colorDef.hex,
          colorDef.accentHex,
          colorDef.css,
        );
      }
    }
  }, []);

  const handleSelectColor = useCallback((colorId: string) => {
    const colorDef = CAR_COLORS.find((c) => c.id === colorId);
    if (!colorDef) return;
    soundFX.unlock();
    soundFX.playCarPick();
    setSelectedColorId(colorId);
    engineRef.current?.setCarColor(
      colorDef.hex,
      colorDef.accentHex,
      colorDef.css,
    );
  }, []);

  const handleStartGame = useCallback(() => {
    soundFX.unlock();
    const trimmed = playerName.trim();
    if (!trimmed) {
      soundFX.playClick();
      setNameError('Please enter your driver name before starting!');
      return;
    }
    if (hasNamePlayed(trimmed)) {
      soundFX.playClick();
      setNameError(`"${trimmed}" already played! Each name can only play once.`);
      return;
    }
    setNameError(null);
    soundFX.playClick();
    engineRef.current?.startNewGame(trimmed);
  }, [playerName]);

  const handlePickUpgrade = useCallback((upgradeId: UpgradeId) => {
    engineRef.current?.applyUpgradeAndContinue(upgradeId);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundFX.setMuted(next);
      if (!next) {
        soundFX.unlock();
        soundFX.playClick();
      }
      return next;
    });
  }, []);

  const handlePause = useCallback(() => {
    soundFX.playClick();
    engineRef.current?.setPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    soundFX.playClick();
    engineRef.current?.setPaused(false);
  }, []);

  const handleBackToMenu = useCallback(() => {
    soundFX.playClick();
    setPlayerName('');
    setNameError(null);
    engineRef.current?.returnToMenu();
  }, []);

  const handleHonk = useCallback(() => {
    engineRef.current?.triggerHonk();
  }, []);

  const handleControlInput = useCallback(
    (control: 'left' | 'right' | 'up' | 'down', active: boolean) => {
      engineRef.current?.setControlInput(control, active);
    },
    [],
  );

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#38BDF8]">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="h-full w-full touch-none"
        onPointerDown={(e) => {
          if (hud.phase !== 'playing' && hud.phase !== 'menu') return;
          dragPointerIdRef.current = e.pointerId;
          dragLastXRef.current = e.clientX;
        }}
        onPointerMove={(e) => {
          if (dragPointerIdRef.current !== e.pointerId) return;
          const dx = e.clientX - dragLastXRef.current;
          dragLastXRef.current = e.clientX;
          if (hud.phase === 'menu') {
            engineRef.current?.spinCarPreview(dx);
          } else if (hud.phase === 'playing') {
            engineRef.current?.steerByDelta(dx * 0.022);
          }
        }}
        onPointerUp={(e) => {
          if (dragPointerIdRef.current === e.pointerId) {
            dragPointerIdRef.current = null;
          }
        }}
        onPointerCancel={() => {
          dragPointerIdRef.current = null;
        }}
      />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/80 p-6 text-center text-white">
          <div className="max-w-sm rounded-3xl border-2 border-white/20 bg-slate-900 p-6">
            <h2 className="font-display text-2xl font-bold">
              Restoring 3D Street...
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Your graphics driver paused for a moment. The game will resume automatically.
            </p>
          </div>
        </div>
      )}

      {hud.phase !== 'menu' && (
        <GameHUD
          hud={hud}
          popups={popups}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onHonk={handleHonk}
          onControlInput={handleControlInput}
        />
      )}

      <GameOverlays
        hud={hud}
        playerName={playerName}
        nameError={nameError}
        selectedCar={selectedCar}
        selectedColorId={selectedColorId}
        leaderboard={leaderboard}
        muted={muted}
        onToggleMute={handleToggleMute}
        onChangeName={handleChangeName}
        onSelectCar={handleSelectCar}
        onSelectColor={handleSelectColor}
        onStartGame={handleStartGame}
        onPickUpgrade={handlePickUpgrade}
        onResume={handleResume}
        onBackToMenu={handleBackToMenu}
      />
    </div>
  );
}
