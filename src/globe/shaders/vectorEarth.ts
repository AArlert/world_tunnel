// 矢量默认风格昼夜 shader（SPEC-3.2①/3.2a/3.3）。
// 与 M1 shaders/earth.ts 同一套昼夜数学：法线取归一化 position（模型空间，同 uSunDir），
// t = dot(N, sunDir)，过渡带 [-uTwilight, +uTwilight] 内 smoothstep 混合；差别仅在被混合两端
// 由「纹理采样」换成「矢量底色/线色」。底面与线共用此 shader，仅 uniform 取值不同。

export const vectorEarthVertexShader = /* glsl */ `
varying vec3 vNormalModel;

void main() {
  vNormalModel = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const vectorEarthFragmentShader = /* glsl */ `
uniform vec3 uColorDay;
uniform vec3 uColorNight;
uniform vec3 uSunDir;
uniform float uTwilight;
uniform vec3 uGlowColor;
uniform float uGlowStrength;

varying vec3 vNormalModel;

void main() {
  // t = dot(N, sunDir)，过渡带 [-uTwilight, +uTwilight] 内 smoothstep（SPEC-3.2①）
  float t = dot(normalize(vNormalModel), normalize(uSunDir));
  float k = smoothstep(-uTwilight, uTwilight, t);

  // 昼夜两端 mix（非叠加，SPEC-3.3）：k=1（昼半球）时夜端权重为 0
  vec3 color = mix(uColorNight, uColorDay, k);

  // 夜半球海岸线微弱自发光辉光（SPEC-3.2a）：仅夜侧（1-k）增益，昼半球（k=1）不叠加（SPEC-3.3）
  color += uGlowColor * uGlowStrength * (1.0 - k);

  gl_FragColor = vec4(color, 1.0);

  // ShaderMaterial 不自动转输出色彩空间（同 M1 §4.2）
  #include <colorspace_fragment>
}
`
