import type { NavigationRoute } from './mapNavigation';

// Visual deck inlays only. Navigation topology and collision clearance stay in
// mapNavigation; these presentation widths must never be reused by simulation.
export const BABYLON_ROUTE_MARKING_WIDTHS: Readonly<Record<NavigationRoute['kind'], number>> = Object.freeze({
  primary: 0.16,
  secondary: 0.10,
  connector: 0.07,
});

export function babylonRouteMarkingWidth(kind: NavigationRoute['kind']): number {
  return BABYLON_ROUTE_MARKING_WIDTHS[kind];
}
