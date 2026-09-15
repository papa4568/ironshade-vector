import fs from 'node:fs';

const path = 'src/components/GameCanvas.tsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOrThrow(label, before, after) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Three.js migration patch failed: ${label} anchor not found`);
  source = source.replace(before, after);
}

replaceOrThrow(
  'renderer import',
  "import { feedback } from '../game/feedback';\n",
  "import { feedback } from '../game/feedback';\nimport { ThreeCombatRenderer } from '../game/threeCombatRenderer';\n",
);

replaceOrThrow(
  'renderer ref',
  "  const canvasRef = useRef<HTMLCanvasElement>(null); const stateRef = useRef<SimState>(createMissionState(firstMission));",
  "  const canvasRef = useRef<HTMLCanvasElement>(null); const threeRendererRef = useRef<ThreeCombatRenderer | null>(null); const stateRef = useRef<SimState>(createMissionState(firstMission));",
);

replaceOrThrow(
  'render-loop initialization',
  "  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; let frame = 0;",
  "  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; let threeRenderer: ThreeCombatRenderer | null = null; if (ThreeCombatRenderer.isSupported()) { try { threeRenderer = new ThreeCombatRenderer(canvas, coarse); } catch (error) { console.warn('Three.js renderer unavailable; falling back to Canvas 2D.', error); } } threeRendererRef.current = threeRenderer; const ctx = threeRenderer ? null : canvas.getContext('2d'); if (!threeRenderer && !ctx) return; let frame = 0;",
);

replaceOrThrow(
  'render-loop draw path',
  "const rect = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); const targetW = Math.max(1, Math.floor(rect.width * dpr)); const targetH = Math.max(1, Math.floor(rect.height * dpr)); if (canvas.width !== targetW || canvas.height !== targetH) { canvas.width = targetW; canvas.height = targetH; } ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const baseQuality = coarse || rect.width < 700 || rect.height < 500 ? 0.72 : 1; const visualQuality = profileSettings.effectIntensity === 'reduced' ? baseQuality * 0.62 : baseQuality; if (profileSettings.screenShake && state.weaponFlash > 0) { const magnitude = state.player.currentWeapon === 'rail' ? 3 : state.player.currentWeapon === 'breacher' ? 2.2 : 0.55; ctx.translate(Math.sin(state.time * 103) * magnitude, Math.cos(state.time * 83) * magnitude); } renderGame(ctx, state, rect.width, rect.height, visualQuality, activeMissionRef.current, coarse ? mobileTargetRef.current : null, operatorFaction); hudTimer += elapsed;",
  "const rect = canvas.getBoundingClientRect(); const baseQuality = coarse || rect.width < 700 || rect.height < 500 ? 0.72 : 1; const visualQuality = profileSettings.effectIntensity === 'reduced' ? baseQuality * 0.62 : baseQuality; if (threeRenderer) { threeRenderer.render(state, rect.width, rect.height, visualQuality, activeMissionRef.current, coarse ? mobileTargetRef.current : null, operatorFaction); } else if (ctx) { const dpr = Math.min(2, window.devicePixelRatio || 1); const targetW = Math.max(1, Math.floor(rect.width * dpr)); const targetH = Math.max(1, Math.floor(rect.height * dpr)); if (canvas.width !== targetW || canvas.height !== targetH) { canvas.width = targetW; canvas.height = targetH; } ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (profileSettings.screenShake && state.weaponFlash > 0) { const magnitude = state.player.currentWeapon === 'rail' ? 3 : state.player.currentWeapon === 'breacher' ? 2.2 : 0.55; ctx.translate(Math.sin(state.time * 103) * magnitude, Math.cos(state.time * 83) * magnitude); } renderGame(ctx, state, rect.width, rect.height, visualQuality, activeMissionRef.current, coarse ? mobileTargetRef.current : null, operatorFaction); } hudTimer += elapsed;",
);

replaceOrThrow(
  'render-loop cleanup',
  "frame = requestAnimationFrame(loop); }; frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame); }, [activeMission, coarse, restartKey, operatorFaction]);",
  "frame = requestAnimationFrame(loop); }; frame = requestAnimationFrame(loop); return () => { cancelAnimationFrame(frame); threeRenderer?.dispose(); if (threeRendererRef.current === threeRenderer) threeRendererRef.current = null; }; }, [activeMission, coarse, restartKey, operatorFaction]);",
);

replaceOrThrow(
  'ray-cast aiming',
  "  const updateAimFromPointer = (clientX: number, clientY: number) => { const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); setAim(stateRef.current, screenVectorToWorld(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2)), false); };",
  "  const updateAimFromPointer = (clientX: number, clientY: number) => { const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); const threeDirection = threeRendererRef.current?.screenDirection(clientX, clientY, rect, stateRef.current.player); setAim(stateRef.current, threeDirection ?? screenVectorToWorld(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2)), false); };",
);

fs.writeFileSync(path, source);
console.log('Three.js combat renderer migration applied.');
