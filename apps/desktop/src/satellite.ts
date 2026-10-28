// Satellites in the night sky (PLAN §5): a tiny body with two solar panels and a light that
// blinks now and then, drawn by code. Thoughts in orbit, waiting to be sorted and on the task
// list all look the same; one ticked off drifts away the first time the Sky shows it.

/** How long a ticked-off satellite takes to drift away. */
export const leaveMs = 9000;
/** How often the light blinks, and how long each blink takes to fade. */
const blinkMs = 2600;
const blinkFadeMs = 320;

export interface SatelliteLook {
  x: number;
  y: number;
  /** Its size: one unit is about a pixel at the smallest, before the screen's scale. */
  size: number;
  /** Which way its panels point (radians), 0 being across. */
  angle: number;
  alpha: number;
  /** When the light blinks, as a share of a blink's cycle, and the time on the animation clock. */
  blink: number;
  time: number;
  /** No blinking, under reduced motion. */
  still: boolean;
  /** How far it has drifted away, from 0 to 1, if it's leaving: it catches the sun as it goes. */
  leaving?: number;
}

export function drawSatellite(c: CanvasRenderingContext2D, look: SatelliteLook) {
  const { x, y, size: s, alpha } = look;
  if (alpha <= 0.01) return;
  c.save();
  c.translate(x, y);

  // A faint glow, as if it catches a little light, and a brighter glint as it leaves.
  const glint = look.leaving === undefined ? 0 : Math.sin(Math.PI * Math.min(1, look.leaving * 4));
  const glowRadius = s * (6 + 4 * glint);
  const glow = c.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
  glow.addColorStop(0, `rgb(225 230 255 / ${0.2 + 0.3 * glint})`);
  glow.addColorStop(1, 'rgb(225 230 255 / 0)');
  c.globalAlpha = alpha;
  c.fillStyle = glow;
  c.fillRect(-glowRadius, -glowRadius, glowRadius * 2, glowRadius * 2);

  c.rotate(look.angle);
  const body = { width: 1.8 * s, height: 1.6 * s };
  const panel = { gap: 0.5 * s, width: 3.2 * s, height: 1.5 * s };
  // Struts out to the panels.
  c.strokeStyle = 'rgb(200 205 225 / 0.8)';
  c.lineWidth = Math.max(0.6, 0.3 * s);
  c.beginPath();
  c.moveTo(-body.width / 2 - panel.gap, 0);
  c.lineTo(body.width / 2 + panel.gap, 0);
  c.stroke();
  for (const side of [-1, 1]) {
    const left = side < 0 ? -body.width / 2 - panel.gap - panel.width : body.width / 2 + panel.gap;
    const sheen = c.createLinearGradient(left, -panel.height / 2, left + panel.width, panel.height / 2);
    sheen.addColorStop(0, '#3d5aa0');
    sheen.addColorStop(1, '#7d9ee0');
    c.fillStyle = sheen;
    c.fillRect(left, -panel.height / 2, panel.width, panel.height);
    // A line down the middle of each, like rows of cells.
    c.strokeStyle = 'rgb(20 30 70 / 0.6)';
    c.lineWidth = Math.max(0.5, 0.18 * s);
    c.beginPath();
    c.moveTo(left + panel.width / 2, -panel.height / 2);
    c.lineTo(left + panel.width / 2, panel.height / 2);
    c.stroke();
  }
  // Gold foil.
  const foil = c.createLinearGradient(0, -body.height / 2, 0, body.height / 2);
  foil.addColorStop(0, '#f6ead0');
  foil.addColorStop(1, '#bfa874');
  c.fillStyle = foil;
  c.fillRect(-body.width / 2, -body.height / 2, body.width, body.height);

  // Its light, on top: dim, with a soft blink now and then.
  const since = (look.time + look.blink * blinkMs) % blinkMs;
  const flash = look.still ? 0 : Math.max(0, 1 - since / blinkFadeMs);
  const lightY = -body.height / 2 - 0.3 * s;
  if (flash > 0) {
    const halo = c.createRadialGradient(0, lightY, 0, 0, lightY, 3.2 * s);
    halo.addColorStop(0, `rgb(255 150 135 / ${0.75 * flash})`);
    halo.addColorStop(1, 'rgb(255 150 135 / 0)');
    c.fillStyle = halo;
    c.fillRect(-3.2 * s, lightY - 3.2 * s, 6.4 * s, 6.4 * s);
  }
  c.fillStyle = `rgb(255 ${170 + 60 * flash} ${160 + 60 * flash})`;
  c.globalAlpha = alpha * (0.45 + 0.55 * flash);
  c.beginPath();
  c.arc(0, lightY, 0.45 * s, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
