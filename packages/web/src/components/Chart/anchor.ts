// Map a chart's viewBox point (cx, cy) to client/viewport coordinates. The styled tooltip is
// portaled to <body> and positioned with `position: fixed`, so it escapes the horizontal-scroll
// (`overflow`) wrappers that would otherwise clip it on mobile (CT-1/B-140 follow-up). Uses the
// SVG screen CTM, so it stays correct under any preserveAspectRatio / scroll offset.
export function svgPointToClient(
  el: SVGGraphicsElement,
  cx: number,
  cy: number,
): { x: number; y: number } | null {
  const svg = el.ownerSVGElement ?? (el instanceof SVGSVGElement ? el : null);
  const ctm = svg?.getScreenCTM?.();
  if (!ctm) return null;
  const p = new DOMPoint(cx, cy).matrixTransform(ctm);
  return { x: p.x, y: p.y };
}
