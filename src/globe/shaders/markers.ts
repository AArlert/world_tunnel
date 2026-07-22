// 事件标记「等径光柱」shader（SPEC-3.7 分类色/分级 + SPEC-3.7a 光柱形态 + SPEC-3.11 呼吸）。
// 轴锁 billboard：逐实例根位置（instanceMatrix 平移列）+ 径向轴（根位置归一化）在顶点着色器内
// 绕径向轴构建朝相机的软四边面片——朝向是相机的纯函数（GPU 侧、无 CPU 每帧写，相机静止时输出
// 逐帧一致，不违 SPEC-3.11a 稳态零动画）。宽/高由 instanceMatrix 缩放列编码：x/z 列长=根半径 r0、
// y 列长=柱高 H。片元只做「柱身分级色 + 径向软边 + 尖端软消散 + 呼吸 alpha」；三段辉光梯度/
// 白热核/screen 归切片②，本切片不含（DP §6 切片① 范围）。

export const pillarVertexShader = /* glsl */ `
attribute float instanceAlpha;
varying vec3 vColor;
varying float vAlpha;
varying vec2 vShape; // x∈[-1,1] 横向、y∈[0,1] 沿柱高：供片元算径向软边/尖端软消散
void main() {
  vColor = instanceColor;
  vAlpha = instanceAlpha;
  vShape = vec2(position.x * 2.0, position.y);

  // 从 instanceMatrix 解出根位置与尺寸：平移列=根位置（SPEC-3.7a 径向站立基点）、列长=缩放
  vec3 root = instanceMatrix[3].xyz;
  float radius = length(instanceMatrix[0].xyz); // 根半径 r0（含联动高亮加宽）
  float height = length(instanceMatrix[1].xyz); // 柱高 H（SPEC-3.7a）
  vec3 axis = normalize(root);                   // 径向轴：球心→地表点（SPEC-3.7a）

  // 视空间轴锁 billboard：柱高方向锁定径向轴，横向绕轴朝相机
  vec3 baseView = (modelViewMatrix * vec4(root, 1.0)).xyz;
  vec3 axisView = normalize((modelViewMatrix * vec4(axis, 0.0)).xyz);
  vec3 toCam = normalize(-baseView); // 视空间相机在原点
  vec3 rAxis = cross(axisView, toCam);
  float rLen = length(rAxis);
  // 相机恰沿柱轴（端视）时叉积退化：取任意垂向兜底避免 NaN（端视柱本压成点，足印兜底归切片②）
  vec3 rightView = rLen > 0.0001 ? rAxis / rLen : vec3(1.0, 0.0, 0.0);

  float taper = mix(1.0, 0.35, position.y); // 向上锥收束 r1=0.35·r0（SPEC-3.7a）
  vec3 offset = rightView * (position.x * 2.0 * radius * taper) + axisView * (position.y * height);
  gl_Position = projectionMatrix * vec4(baseView + offset, 1.0);
}
`

export const pillarFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying vec2 vShape;
void main() {
  // 径向软边：中心实、边缘渐隐至 ~0（无硬轮廓/无靶环，SPEC-3.7a）
  float radial = 1.0 - smoothstep(0.35, 1.0, abs(vShape.x));
  // 尖端顶部 20% 软消散至全透明（无硬尖端，SPEC-3.7a）
  float tip = 1.0 - smoothstep(0.8, 1.0, vShape.y);
  gl_FragColor = vec4(vColor, vAlpha * radial * tip);
  #include <colorspace_fragment>
}
`
