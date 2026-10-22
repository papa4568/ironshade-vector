// Pure Android system-dialog recovery policy, safe to import in production
// proof tests: it never touches adb, source control, filesystem or the device.
export function quickstepWaitPoint(xml) {
  const nodes = [...String(xml).matchAll(/<node\b[^>]*>/g)].map(match => {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)]
      .map(([, name, value]) => [name, value.replaceAll('&apos;', "'").replaceAll('&#39;', "'")]));
    return attrs;
  });
  if (!nodes.some(node => /quickstep/i.test(node.text ?? node['content-desc'] ?? '')
      && /(?:isn.t responding|not responding)/i.test(node.text ?? node['content-desc'] ?? ''))) return null;
  const wait = nodes.find(node => /^(?:wait|wait for app)$/i.test(node.text ?? '') && node.clickable === 'true');
  const match = wait?.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  if (!match) return null;
  const [left, top, right, bottom] = match.slice(1).map(Number);
  if (!(right > left && bottom > top && right < 10000 && bottom < 10000)) return null;
  return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) };
}

export function needsQuickstepRecovery(frame) {
  return frame.valid === false && frame.paleBandRowsRatio >= 0.4;
}
