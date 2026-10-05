import { Filter, GlProgram } from 'pixi.js';

// The oil-paint finish (art direction: ART_STYLE.md). One screen-space filter over the whole world:
// 1. a smoothing "Kuwahara" pass: each pixel takes the average of the calmest of four neighbourhoods, which flattens detail into soft, smooth
//    patches of colour while keeping the edges of shapes (so strokes read as blended paint, not as noise);
// 2. a gentle impasto relief: long soft brush-stroke noise lit from the upper left, so the paint looks thick without harsh bristle lines.
// The vertex shader is Pixi's standard filter one.
const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }
`;

const fragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uRadius;   // smoothing reach in screen pixels
uniform float uRelief;   // strength of the paint thickness lighting
uniform float uStroke;   // length of a brush stroke in screen pixels
uniform float uPx;       // window height / 1080: keeps the paint the same size on any screen

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Paint thickness: long streaks along a slanted brush direction, two sizes blended so it stays soft.
float height(vec2 p) {
  vec2 q = vec2(p.x * 0.94 - p.y * 0.34, p.x * 0.34 + p.y * 0.94);
  return vnoise(vec2(q.x / uStroke, q.y / (uStroke * 0.22))) * 0.65 + vnoise(vec2(q.x / (uStroke * 2.6), q.y / (uStroke * 0.6))) * 0.35;
}

void main() {
  vec2 px = uInputSize.zw;
  float s = max(0.5, uRadius * uPx / 3.0); // tap spacing so 4 taps span the radius
  vec3 mean[4];
  float variance[4];
  for (int k = 0; k < 4; k++) {
    vec2 dir = vec2(k == 0 || k == 3 ? -1.0 : 1.0, k < 2 ? -1.0 : 1.0);
    vec3 sum = vec3(0.0), sq = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      for (int j = 0; j < 4; j++) {
        vec3 c = texture(uTexture, vTextureCoord + dir * vec2(float(i), float(j)) * s * px).rgb;
        sum += c; sq += c * c;
      }
    }
    sum /= 16.0; sq /= 16.0;
    mean[k] = sum;
    vec3 v = sq - sum * sum;
    variance[k] = v.r + v.g + v.b;
  }
  // Blend the sectors by how calm they are (a soft weighting, not a hard pick: that is what keeps the strokes smooth).
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  for (int k = 0; k < 4; k++) {
    float w = 1.0 / (1.0 + pow(variance[k] * 400.0, 3.0));
    col += mean[k] * w;
    wsum += w;
  }
  col /= wsum;
  // Impasto: light the thickness from the upper left.
  vec2 p = gl_FragCoord.xy / uPx;
  float h = height(p);
  float hx = height(p + vec2(1.5, 0.0)) - h, hy = height(p + vec2(0.0, 1.5)) - h;
  float lit = (-hx - hy) * uRelief * 3.0;
  col *= 1.0 + lit;
  col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 1.18); // oil pigments are a little richer than the flat colours
  finalColor = vec4(col, 1.0);
}
`;

/** The oil-paint filter. `radius` = smoothing reach, `relief` = paint thickness, `stroke` = brush length (all in pixels at 1080p). */
export function createOilFilter(radius: number, relief: number, stroke: number): Filter {
  return new Filter({
    glProgram: GlProgram.from({ vertex, fragment, name: 'oil-paint' }),
    resources: { oilUniforms: { uRadius: { value: radius, type: 'f32' }, uRelief: { value: relief, type: 'f32' }, uStroke: { value: stroke, type: 'f32' }, uPx: { value: 1, type: 'f32' } } },
  });
}

/** Keep the paint the same size when the window is resized. */
export function setOilScale(f: Filter, px: number): void {
  f.resources.oilUniforms.uniforms.uPx = px;
}
