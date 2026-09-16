import { solidNavigationObject } from './mapNavigation';
import type { CombatObject, SimState, Vec2 } from './sim';

const point = (x: number, y: number): Vec2 => ({ x, y });

export function findNavigationPath(state: SimState, target: CombatObject, cell = 58) {
  const clearance = 28;
  const minX = 105;
  const maxX = 2215;
  const minY = 185;
  const maxY = 915;
  const cols = Math.floor((maxX - minX) / cell) + 1;
  const rows = Math.floor((maxY - minY) / cell) + 1;
  const solids = state.objects.filter(solidNavigationObject).filter(object => object.id !== target.id);
  const blocked = (x: number, y: number) => solids.some(object => x >= object.x - clearance && x <= object.x + object.w + clearance && y >= object.y - clearance && y <= object.y + object.h + clearance);
  const key = (cx: number, cy: number) => cy * cols + cx;
  const fromKey = (value: number) => [value % cols, Math.floor(value / cols)] as const;
  const cellPoint = (cx: number, cy: number) => point(minX + cx * cell, minY + cy * cell);
  const clampCell = (x: number, y: number) => [
    Math.max(0, Math.min(cols - 1, Math.round((x - minX) / cell))),
    Math.max(0, Math.min(rows - 1, Math.round((y - minY) / cell))),
  ] as const;
  const [startX, startY] = clampCell(state.player.x, state.player.y);
  const [goalX, goalY] = clampCell(target.x + target.w / 2, target.y + target.h / 2);
  const startId = key(startX, startY);
  const goalId = key(goalX, goalY);
  const queue = [startId];
  const previous = new Map<number, number>();
  const visited = new Set<number>([startId]);
  let resolvedGoal = goalId;
  let found = startId === goalId;
  let nearest = startId;
  let nearestDistance = Infinity;

  for (let index = 0; index < queue.length && !found; index += 1) {
    const current = queue[index];
    const [cx, cy] = fromKey(current);
    const p = cellPoint(cx, cy);
    const goalDistance = Math.hypot(p.x - (target.x + target.w / 2), p.y - (target.y + target.h / 2));
    if (goalDistance < nearestDistance) { nearestDistance = goalDistance; nearest = current; }
    if (goalDistance <= Math.max(100, cell * 1.7)) { resolvedGoal = current; found = true; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const next = key(nx, ny);
      if (visited.has(next)) continue;
      const nextPoint = cellPoint(nx, ny);
      if (blocked(nextPoint.x, nextPoint.y)) continue;
      visited.add(next);
      previous.set(next, current);
      queue.push(next);
    }
  }

  if (!found) resolvedGoal = nearest;
  const ids: number[] = [resolvedGoal];
  while (ids[ids.length - 1] !== startId) {
    const prior = previous.get(ids[ids.length - 1]);
    if (prior == null) break;
    ids.push(prior);
  }
  ids.reverse();
  const raw = ids.map(id => {
    const [cx, cy] = fromKey(id);
    return cellPoint(cx, cy);
  });
  const simplified: Vec2[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const current = raw[index];
    const prev = raw[index - 1];
    const next = raw[index + 1];
    if (!prev || !next) { simplified.push(current); continue; }
    const dxA = Math.sign(current.x - prev.x);
    const dyA = Math.sign(current.y - prev.y);
    const dxB = Math.sign(next.x - current.x);
    const dyB = Math.sign(next.y - current.y);
    if (dxA !== dxB || dyA !== dyB) simplified.push(current);
  }
  if (simplified.length === 0) simplified.push(point(state.player.x, state.player.y));
  simplified[0] = point(state.player.x, state.player.y);
  simplified.push(point(target.x + target.w / 2, target.y + target.h / 2));
  return { points: simplified, complete: found };
}
