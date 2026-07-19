// 大气菲涅尔辉光 shader 源码（SPEC-3.4）：视线越掠射越亮，从球缘向外衰减。

export const atmosphereVertexShader = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewDir;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`

export const atmosphereFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uPower;
uniform float uIntensity;

varying vec3 vNormalView;
varying vec3 vViewDir;

void main() {
  // 壳按 BackSide 渲染，法线朝外而看到的是内表面，故取 abs 保证掠射处 f→1
  float f = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDir))), uPower);
  gl_FragColor = vec4(uColor * f * uIntensity, f);

  #include <colorspace_fragment>
}
`
