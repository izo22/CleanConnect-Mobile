// src/screens/game/FireHoseGameScreen.js
// Mini-jeu "כיבוי אש" — Éteins le feu avec le tuyau de pompier.
// Le joueur touche l'écran pour viser : le tuyau (fixé en bas de l'écran)
// pivote vers le point touché et projette de l'eau tant que le doigt reste
// posé. Des foyers de feu apparaissent, grandissent et se propagent de plus
// en plus vite ; il faut les éteindre avant que la jauge de danger déborde.
// Deux thèmes sont proposés : forêt et immeuble.

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  THEMES,
  GAME_STATUS,
  TICK_MS,
  LEVEL_DURATION_S,
  MAX_FIRES,
  SPAWN_INTERVAL_START_S,
  SPAWN_INTERVAL_MIN_S,
  FIRE_GROWTH_START,
  FIRE_GROWTH_MAX,
  SPREAD_CHANCE_PER_S,
  WATER_DAMAGE_PER_S,
  HOSE_RANGE_RATIO,
  HOSE_CONE_HALF_ANGLE,
  HOSE_MAX_ANGLE,
  DANGER_RISE_FACTOR,
  DANGER_PASSIVE_DECAY,
  SCORE_PER_FIRE,
  SCORE_PER_WAVE_BONUS,
  WAVE_DURATION_S,
} from './fireHoseGameConfig';

const HOSE_LENGTH = 46;
const JET_WIDTH = 10;

let fireIdCounter = 0;
const nextFireId = () => `fire_${Date.now()}_${fireIdCounter++}`;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randRange = (min, max) => min + Math.random() * (max - min);

const spawnFireNear = (x, y) => ({
  id: nextFireId(),
  x: clamp(x + randRange(-0.12, 0.12), 0.06, 0.94),
  y: clamp(y + randRange(-0.1, 0.1), 0.08, 0.58),
  health: randRange(12, 22),
});

const spawnRandomFire = () => spawnFireNear(randRange(0.15, 0.85), randRange(0.15, 0.5));

// Angle (degrés) entre la verticale passant par le pivot et le point (x, y)
const angleFromPivot = (pivotX, pivotY, x, y) => {
  const dx = x - pivotX;
  const dy = Math.max(pivotY - y, 1);
  return (Math.atan2(dx, dy) * 180) / Math.PI;
};

const initialSim = () => ({
  fires: [],
  score: 0,
  elapsed: 0,
  danger: 0,
  wave: 1,
  spawnTimer: SPAWN_INTERVAL_START_S,
});

const FireHoseGameScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState(GAME_STATUS.MENU);
  const [theme, setTheme] = useState(THEMES.forest);
  const [angle, setAngle] = useState(0);
  const [spraying, setSpraying] = useState(false);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [hud, setHud] = useState(initialSim());

  const statusRef = useRef(status);
  const angleRef = useRef(0);
  const sprayingRef = useRef(false);
  const layoutRef = useRef({ width: 0, height: 0 });
  const simRef = useRef(initialSim());

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // ── Boucle de simulation (déclenchée uniquement en jeu) ─────────────────
  useEffect(() => {
    if (status !== GAME_STATUS.PLAYING) return undefined;

    const id = setInterval(() => {
      const dt = TICK_MS / 1000;
      const sim = simRef.current;
      const { width, height } = layoutRef.current;
      if (!width || !height) return;

      sim.elapsed += dt;
      const progress = Math.min(1, sim.elapsed / LEVEL_DURATION_S);
      const growth = FIRE_GROWTH_START + (FIRE_GROWTH_MAX - FIRE_GROWTH_START) * progress;
      const spawnInterval =
        SPAWN_INTERVAL_START_S - (SPAWN_INTERVAL_START_S - SPAWN_INTERVAL_MIN_S) * progress;
      sim.wave = 1 + Math.floor(sim.elapsed / WAVE_DURATION_S);

      sim.spawnTimer -= dt;
      if (sim.spawnTimer <= 0 && sim.fires.length < MAX_FIRES) {
        sim.fires.push(spawnRandomFire());
        sim.spawnTimer = spawnInterval;
      }

      const pivotX = width / 2;
      const pivotY = height;
      const currentAngle = angleRef.current;
      const isSpraying = sprayingRef.current;
      const range = height * HOSE_RANGE_RATIO;

      let scoreGain = 0;
      const nextFires = [];
      for (const fire of sim.fires) {
        let health = fire.health + growth * dt;

        if (isSpraying) {
          const fx = fire.x * width;
          const fy = fire.y * height;
          const dist = Math.hypot(fx - pivotX, pivotY - fy);
          const angleToFire = angleFromPivot(pivotX, pivotY, fx, fy);
          const hit = dist <= range && Math.abs(angleToFire - currentAngle) <= HOSE_CONE_HALF_ANGLE;
          if (hit) health -= WATER_DAMAGE_PER_S * dt;
        }

        if (health <= 0) {
          scoreGain += SCORE_PER_FIRE + sim.wave * SCORE_PER_WAVE_BONUS;
          continue; // feu éteint
        }

        health = Math.min(100, health);

        if (health >= 100 && sim.fires.length + nextFires.length < MAX_FIRES) {
          if (Math.random() < SPREAD_CHANCE_PER_S * dt) {
            nextFires.push(spawnFireNear(fire.x, fire.y));
          }
        }

        nextFires.push({ ...fire, health });
      }

      sim.fires = nextFires.slice(0, MAX_FIRES);
      sim.score += scoreGain;

      const dangerLoad = sim.fires.reduce((total, fire) => total + fire.health / 100, 0);
      sim.danger = clamp(
        sim.danger + dangerLoad * DANGER_RISE_FACTOR * dt - DANGER_PASSIVE_DECAY * dt,
        0,
        100
      );

      setHud({
        fires: sim.fires,
        score: sim.score,
        elapsed: sim.elapsed,
        danger: sim.danger,
        wave: sim.wave,
      });

      if (sim.danger >= 100) {
        setStatus(GAME_STATUS.LOST);
      } else if (sim.elapsed >= LEVEL_DURATION_S) {
        setStatus(GAME_STATUS.WON);
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [status]);

  const resetSim = useCallback(() => {
    simRef.current = initialSim();
    angleRef.current = 0;
    sprayingRef.current = false;
    setAngle(0);
    setSpraying(false);
    setHud(initialSim());
  }, []);

  const startGame = useCallback(
    (themeId) => {
      setTheme(THEMES[themeId]);
      resetSim();
      setStatus(GAME_STATUS.PLAYING);
    },
    [resetSim]
  );

  const restartGame = useCallback(() => {
    resetSim();
    setStatus(GAME_STATUS.PLAYING);
  }, [resetSim]);

  const aim = useCallback((evt) => {
    const { width, height } = layoutRef.current;
    if (!width || !height) return;
    const { locationX, locationY } = evt.nativeEvent;
    const deg = clamp(
      angleFromPivot(width / 2, height, locationX, locationY),
      -HOSE_MAX_ANGLE,
      HOSE_MAX_ANGLE
    );
    angleRef.current = deg;
    setAngle(deg);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => statusRef.current === GAME_STATUS.PLAYING,
        onMoveShouldSetPanResponder: () => statusRef.current === GAME_STATUS.PLAYING,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          sprayingRef.current = true;
          setSpraying(true);
          aim(evt);
        },
        onPanResponderMove: (evt) => aim(evt),
        onPanResponderRelease: () => {
          sprayingRef.current = false;
          setSpraying(false);
        },
        onPanResponderTerminate: () => {
          sprayingRef.current = false;
          setSpraying(false);
        },
      }),
    [aim]
  );

  const onPlayfieldLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    layoutRef.current = { width, height };
    setDims({ width, height });
  }, []);

  const decor = useMemo(
    () =>
      Array.from({ length: theme.decorCount }, () => ({
        x: randRange(0.04, 0.9),
        y: randRange(0.62, 0.92),
        scale: randRange(0.8, 1.3),
      })),
    [theme.id]
  );

  const totalHoseLength = HOSE_LENGTH + dims.height * HOSE_RANGE_RATIO;
  const timeLeft = Math.max(0, Math.ceil(LEVEL_DURATION_S - hud.elapsed));
  const dangerColor = hud.danger < 50 ? '#34D399' : hud.danger < 80 ? '#F59E0B' : '#EF4444';

  // ── MENU ──────────────────────────────────────────────────────────────
  if (status === GAME_STATUS.MENU) {
    return (
      <View style={[styles.menuContainer, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#1F2937" />
        </TouchableOpacity>

        <Text style={styles.menuEmoji}>🚒🔥</Text>
        <Text style={styles.menuTitle}>מבצע כיבוי אש</Text>
        <Text style={styles.menuInstructions}>
          גע במסך כדי לכוון את זרנוק המים וסובב אותו על פני האש. האש מתפשטת עם
          הזמן — אל תיתן לה להשתלט!
        </Text>

        <View style={styles.themeRow}>
          {Object.values(THEMES).map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.themeCard, { backgroundColor: t.backgroundColor }]}
              activeOpacity={0.85}
              onPress={() => startGame(t.id)}
            >
              <Text style={styles.themeCardEmoji}>{t.decorEmoji}</Text>
              <Text style={styles.themeCardLabel}>{t.label}</Text>
              <Text style={styles.themeCardSubtitle}>{t.subtitle}</Text>
              <View style={[styles.playBadge, { backgroundColor: t.accentColor }]}>
                <Text style={styles.playBadgeText}>שחק</Text>
                <Ionicons name="play" size={12} color="#0B1C14" style={{ marginRight: 4 }} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // ── JEU ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.gameContainer, { backgroundColor: theme.backgroundColor }]}>
      {/* HUD */}
      <View style={[styles.hud, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.hudTopRow}>
          <TouchableOpacity
            style={styles.hudIconButton}
            onPress={() => setStatus(GAME_STATUS.PAUSED)}
            disabled={status !== GAME_STATUS.PLAYING}
          >
            <Ionicons name="pause" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.hudStats}>
            <Text style={styles.hudStatText}>⏱ {timeLeft}s</Text>
            <Text style={styles.hudStatText}>🔥 גל {hud.wave}</Text>
            <Text style={styles.hudStatText}>⭐ {hud.score}</Text>
          </View>

          <TouchableOpacity style={styles.hudIconButton} onPress={() => setStatus(GAME_STATUS.MENU)}>
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.dangerTrack}>
          <View
            style={[styles.dangerFill, { width: `${hud.danger}%`, backgroundColor: dangerColor }]}
          />
        </View>
      </View>

      {/* Zone de jeu */}
      <View
        style={styles.playfield}
        onLayout={onPlayfieldLayout}
        {...panResponder.panHandlers}
      >
        {/* Décor thématique */}
        {decor.map((d, i) => (
          <Text
            key={`decor_${i}`}
            style={[
              styles.decorEmoji,
              { left: `${d.x * 100}%`, top: `${d.y * 100}%`, fontSize: 30 * d.scale, opacity: 0.5 },
            ]}
          >
            {theme.decorEmoji}
          </Text>
        ))}

        {/* Foyers de feu */}
        {hud.fires.map((fire) => (
          <Text
            key={fire.id}
            style={[
              styles.fireEmoji,
              {
                left: `${fire.x * 100}%`,
                top: `${fire.y * 100}%`,
                fontSize: 16 + fire.health * 0.28,
                opacity: 0.55 + (fire.health / 100) * 0.45,
              },
            ]}
          >
            {theme.fireEmoji}
          </Text>
        ))}

        {/* Tuyau + jet d'eau, pivote autour du bas de l'écran */}
        {dims.height > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.hoseGroup,
              {
                height: totalHoseLength,
                width: JET_WIDTH,
                left: dims.width / 2 - JET_WIDTH / 2,
                transform: [
                  { translateY: totalHoseLength / 2 },
                  { rotate: `${angle}deg` },
                  { translateY: -totalHoseLength / 2 },
                ],
              },
            ]}
          >
            <View style={styles.hosePipe} />
            {spraying && (
              <View style={[styles.waterJet, { height: dims.height * HOSE_RANGE_RATIO }]} />
            )}
          </View>
        )}

        <Text pointerEvents="none" style={styles.truckEmoji}>
          🚒
        </Text>
      </View>

      {/* Overlay pause */}
      {status === GAME_STATUS.PAUSED && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>⏸ הפסקה</Text>
          <TouchableOpacity style={styles.overlayButton} onPress={() => setStatus(GAME_STATUS.PLAYING)}>
            <Text style={styles.overlayButtonText}>המשך</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.overlayButtonSecondary} onPress={restartGame}>
            <Text style={styles.overlayButtonSecondaryText}>התחל מחדש</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.overlayButtonSecondary} onPress={() => setStatus(GAME_STATUS.MENU)}>
            <Text style={styles.overlayButtonSecondaryText}>תפריט</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Overlay victoire */}
      {status === GAME_STATUS.WON && (
        <View style={styles.overlay}>
          <Text style={styles.overlayEmoji}>🏆</Text>
          <Text style={styles.overlayTitle}>ניצחת! השריפה כובתה</Text>
          <Text style={styles.overlaySubtitle}>ניקוד: {hud.score}</Text>
          <TouchableOpacity style={styles.overlayButton} onPress={restartGame}>
            <Text style={styles.overlayButtonText}>שחק שוב</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.overlayButtonSecondary} onPress={() => setStatus(GAME_STATUS.MENU)}>
            <Text style={styles.overlayButtonSecondaryText}>תפריט</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Overlay défaite */}
      {status === GAME_STATUS.LOST && (
        <View style={styles.overlay}>
          <Text style={styles.overlayEmoji}>💥</Text>
          <Text style={styles.overlayTitle}>האש השתלטה...</Text>
          <Text style={styles.overlaySubtitle}>ניקוד: {hud.score}</Text>
          <TouchableOpacity style={styles.overlayButton} onPress={restartGame}>
            <Text style={styles.overlayButtonText}>נסה שוב</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.overlayButtonSecondary} onPress={() => setStatus(GAME_STATUS.MENU)}>
            <Text style={styles.overlayButtonSecondaryText}>תפריט</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Menu
  menuContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  closeButton: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuEmoji: { fontSize: 56, marginTop: 12 },
  menuTitle: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginTop: 8 },
  menuInstructions: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 28,
    width: '100%',
  },
  themeCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'space-between',
  },
  themeCardEmoji: { fontSize: 40 },
  themeCardLabel: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginTop: 8 },
  themeCardSubtitle: {
    fontSize: 12,
    color: '#E5E7EB',
    textAlign: 'center',
    marginTop: 4,
  },
  playBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 14,
  },
  playBadgeText: { fontWeight: '700', fontSize: 13, color: '#0B1C14' },

  // Jeu
  gameContainer: { flex: 1 },
  hud: { paddingHorizontal: 16, paddingBottom: 8 },
  hudTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hudIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudStats: { flexDirection: 'row', gap: 12 },
  hudStatText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  dangerTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
    overflow: 'hidden',
  },
  dangerFill: { height: '100%', borderRadius: 4 },

  playfield: { flex: 1, position: 'relative', overflow: 'hidden' },
  decorEmoji: { position: 'absolute' },
  fireEmoji: { position: 'absolute', marginLeft: -14, marginTop: -14 },

  hoseGroup: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'column-reverse',
    alignItems: 'center',
  },
  hosePipe: {
    width: JET_WIDTH,
    height: HOSE_LENGTH,
    backgroundColor: '#4B5563',
    borderRadius: JET_WIDTH / 2,
  },
  waterJet: {
    width: JET_WIDTH * 0.7,
    backgroundColor: 'rgba(147,197,253,0.75)',
    borderRadius: JET_WIDTH / 2,
  },
  truckEmoji: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -18,
    fontSize: 36,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  overlayEmoji: { fontSize: 48, marginBottom: 8 },
  overlayTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  overlaySubtitle: { fontSize: 15, color: '#E5E7EB', marginTop: 6 },
  overlayButton: {
    backgroundColor: '#2E86C1',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  overlayButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  overlayButtonSecondary: { paddingVertical: 10 },
  overlayButtonSecondaryText: { color: '#D1D5DB', fontWeight: '500', fontSize: 14 },
});

export default FireHoseGameScreen;
