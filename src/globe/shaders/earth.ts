// 昼夜混合 shader 源码（SPEC-3.2 / 3.3）。
// 关键约定：法线与 uSunDir 同处模型空间，故直接用归一化的 position 当法线（球心在原点、半径 1）；
// uv 一律取自几何自带的 vUv，禁止在片元内用法线现算经度（±180° 接缝会出 mip 竖线瑕疵）。

export const earthVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalModel;

void main() {
  vUv = uv;
  vNormalModel = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const earthFragmentShader = /* glsl */ `
uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform vec3 uSunDir;
uniform float uNightGain;
uniform float uTwilight;

varying vec2 vUv;
varying vec3 vNormalModel;

void main() {
  vec3 day = texture2D(uDayMap, vUv).rgb;
  vec3 night = texture2D(uNightMap, vUv).rgb;

  // t = dot(N, sunDir)，过渡带 [-uTwilight, +uTwilight] 内 smoothstep（SPEC-3.2）
  float t = dot(normalize(vNormalModel), normalize(uSunDir));
  float k = smoothstep(-uTwilight, uTwilight, t);

  // k=1（昼半球）时灯光项权重为 0，不叠加（SPEC-3.3）
  gl_FragColor = vec4(mix(night * uNightGain, day, k), 1.0);

  #include <colorspace_fragment>
}
`
