// Random hue (0-359) used to color user avatar gradients.
// so the allowed hue wheel is the union of these two arcs:
//   [0, 195]   -> red -> orange -> yellow -> green -> teal/cyan
//   [290, 360] -> pink -> red (wrapping back to 0)
const ALLOWED_HUE_RANGES = [
  [0, 195],
  [290, 360],
];

function randomAvatarHue() {
  const totalSpan = ALLOWED_HUE_RANGES.reduce((sum, [start, end]) => sum + (end - start), 0);
  let pick = Math.random() * totalSpan;
  for (const [start, end] of ALLOWED_HUE_RANGES) {
    const span = end - start;
    if (pick < span) return Math.floor(start + pick) % 360;
    pick -= span;
  }
  return 0; // fallback, should not be reached
}

module.exports = { randomAvatarHue };