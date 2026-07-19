# design-prompt — M1 地球仪（astro / globe 渲染 / globe 交互）

> arch 撰写，rev 门禁通过后 orch 据此派 dev。只准约束实现，不准定义 spec 之外的对外可见行为（行为泄漏禁区，见 .claude/agents/arch.md）。
>
> 覆盖 feature-matrix：FM-02（天文计算）、FM-03（地球渲染）、FM-04（地球交互）。

## 1. 目标与范围

把 M0 的占位线框球换成规格球：**昼夜纹理 shader + 大气辉光 + 星空 + 拖拽/缩放/惯性/空闲自转**，
晨昏线由 `src/astro/` 的纯函数按真实 UTC 时刻驱动。

**做**：SPEC-3.1~3.6、SPEC-4.1~4.5、SPEC-7.1~7.3、SPEC-7.5。
**不做**：事件标记层与分类色（SPEC-3.7）、点击飞行与详情卡（SPEC-7.4）、事件流面板、任何 provider/网络请求——
均属 M2+（FM-07/FM-09）。本里程碑只**预留接入点**（§3.7），不实现。
唯一例外是 SPEC-3.6 明文要求的**校准标记**（"格林尼治的球面标记…M1 校准场景验证"），按 §3.8 以 dev-only 钩子提供。

**SPEC-3.8 判据豁免声明（orch 定夺，REV-002 §4 G-1）**：SPEC-3.8「桌面 Chrome 目标 60fps」在 M1 **不设验收场景、不计入本里程碑判据范围**。
理由：M1 绘制量仅 1 球体 + 1 大气壳 + 1 星空 Points，该判据在此规模下近乎恒真，此时登记场景属无痛不建设；
SPEC-3.8 的实质约束（「标记 ≥200 个用 instancing/点精灵」）本就是标记层语义，M1 无标记层无从验证。
DEV 仍应遵循 §4.3 的性能实现建议（纹理尺寸/anisotropy/单 Points 对象），但 M1 交付**不对 60fps 做正式验证**。
**豁免须在 M2 回补**：待 FM-07（标记层）落地后，M2 场景登记须补验 SPEC-3.8（≥200 标记的帧率/instancing）与
SPEC-3.4「不遮挡标记」两条断言——后者 M1 §3.7 已实现前置保证但结构性不可验（REV-002 R-2），
两条 spec 条目若不在 M2 回补会长期无人验证。

## 2. 约束（每条标注 SPEC 锚点）

### 2.1 天文（src/astro/）

- 纯函数、零 three.js 依赖、无隐式全局时间：所有函数以 `Date` 为显式入参（可测性要求，非 spec 行为）。
- 太阳赤纬用 Cooper 公式，精度 ±1°（SPEC-4.1）。
- 均时差公式与 `B` 定义照抄 spec，不得换用更精确算法（SPEC-4.2）——精度换稳定的判定基准。
- 直下点经度归一化到 (−180°, 180°]（SPEC-4.3）。
- 年积日 `N`：按 **UTC 日期、1 月 1 日 = 1** 计，闰年 2 月 29 日照常顺次计入，公式分母恒为 365（SPEC-4.1）。

### 2.2 渲染（src/globe/）

- 球半径 1.0、SphereGeometry 分段 ≥64；相机 fov 45°、初始距离 3.2（SPEC-3.1）。
- 昼夜混合在**自定义 shader** 内完成，`t = dot(N, sunDir)`，过渡带 `t ∈ [−0.1, +0.1]` 用 smoothstep（SPEC-3.2）。
  `N` 与 `sunDir` **必须同处模型空间**（见 §3.4，这是自转与晨昏线自洽的关键）。
- 夜半球亮度增益 ≥1.5，昼半球灯光贡献必须为 0（SPEC-3.3）——用混合权重收敛到纯昼纹理实现，不得叠加。
- 大气用背面菲涅尔壳，主色 `#4a90d9`；**加法混合 + depthWrite=false**，保证不遮挡后续标记层（SPEC-3.4，M2 依赖）。
- 星空 ≥1500 点、半径 ≥40 球壳，挂在 **scene 根**而非地球组下（SPEC-3.5：随相机、不随自转）。
  相机 far 平面必须容纳该球壳。
- 纹理经度对齐：几何 uv 约定必须与 SPEC-6.2 的 `latLonToVector3` 同源自洽——
  即 (lat 0, lon 0) 的模型空间位置必须落在等距圆柱纹理的 uv=(0.5, 0.5)（SPEC-3.6 + SPEC-6.2）。
  推导与两种可选实现见 §4.1。**这是 M1 校准场景的核心，DEV 不得靠"看着调"，必须由约定推导。**
  **硬约束**：禁止在片元着色器内用法线现算 uv（如 `atan(N.x, N.z)`）——该写法会在 ±180° 经度接缝处产生 uv 导数突变、
  触发 mip 级跳变（出现竖线瑕疵），且会绕开 `createEarthGeometry()` 这一 uv 约定唯一出处，使检查点 6/7 的单测失去意义。
  uv 必须来自几何自带的 `vUv` varying。
- 纹理只在 `src/globe/` 内加载，路径与出处以 public/assets/ASSETS.md 为准；不得新增未登记素材。
- SPEC-3.8 的 60fps 判据 M1 豁免（见 §1 豁免声明），本条不构成 M1 验收判据；DEV 仍建议遵循 §4.3 的性能实现建议，
  M1 主要成本在 5400×2700 纹理解码/上传。

### 2.3 交互（src/globe/）

- 拖拽改变**相机**的方位角/仰角：水平无限制，仰角限制 ±85°；释放后惯性衰减，阻尼系数 ≈0.95/帧，以 60fps 为基准（SPEC-7.1 + SPEC-7.5）。
- 相机距离夹紧到 [1.8, 6]，滚轮与双指捏合同时支持（SPEC-7.2）。
- 空闲自转作用于**地球本体**（`earthGroup.rotation.y`，绕 SPEC-6.2 的 +Y 轴），≈0.02°/帧，以 60fps 为基准（SPEC-7.3 + SPEC-7.5），
  无输入满 10s 触发，任何输入立即停；相机与星空不动（SPEC-7.3）。自转期间 `uSunDir` 不随 `earthGroup` 变换（见 §3.4），
  晨昏线与地理位置的相对关系保持不变（SPEC-7.3 末句 + SPEC-4.5）。
- **时间基准（SPEC-7.5）**：0.95/帧、0.02°/帧均以 60fps（帧间隔 1/60s）为基准；实际帧率不同时须保证单位**时间**内的
  衰减比例/自转角速度与该基准等价（例如 `v *= 0.95 ** (dt / (1/60))` 或等效的 dt 归一化写法），不得在非 60fps 下按逐帧字面量原样套用。
  dt 需设上限（切后台/断点恢复后 dt 巨跳时钳位，避免单帧过量衰减/自转跳变）——该上限具体取值属实现细节，不进 spec，由 DEV 自定。
- **拖拽灵敏度与滚轮/捏合步长为实现自由度**（REV-002 D-1）：像素→角度换算比例、每次滚轮/捏合触发的 distance 变化量，
  spec 与本文档均不定义手感数值，由 DEV 自行调参；QA 不对这些具体数值断言，只断言结果落在 SPEC-7.1（仰角 ±85°）/
  SPEC-7.2（distance ∈ [1.8, 6]）的边界夹紧内。

## 3. 接口

### 3.1 模块与文件职责

| 文件 | 职责 | 依赖 |
| --- | --- | --- |
| `src/astro/solar.ts` | 赤纬 / 均时差 / 直下点，纯数值 | 无 |
| `src/globe/geo.ts` | 既有 `latLonToVector3`（SPEC-6.2） | three |
| `src/globe/sun.ts` | 组合 astro + geo → 模型空间 sunDir（SPEC-4.5） | astro, geo |
| `src/globe/shaders/earth.ts` | 昼夜 shader 源码（GLSL 模板字符串） | 无 |
| `src/globe/shaders/atmosphere.ts` | 菲涅尔 shader 源码 | 无 |
| `src/globe/earth.ts` | 几何工厂 + 材质/uniform 装配 | three, shaders |
| `src/globe/atmosphere.ts` | 大气壳 mesh 工厂 | three, shaders |
| `src/globe/starfield.ts` | 星空 Points 工厂 | three |
| `src/globe/textures.ts` | 昼/夜纹理加载与色彩空间设置 | three |
| `src/globe/controls.ts` | 交互状态机，产出相机球坐标与自转增量 | three（仅数学类型） |
| `src/globe/GlobeScene.ts` | 组合根：场景图、RAF 循环、resize、dispose、M2 接入点 | 以上全部 |

拆分理由：shader 源码与几何工厂需独立单测（SPEC-3.6 校准）；controls 是纯状态机需可在无 WebGL 下测。
**不要为"灵活性"再加抽象层**（CLAUDE.md §1.2）：无插件系统、无材质注册表、无事件总线。

### 3.2 导出签名（纯函数优先）

```ts
// src/astro/solar.ts
export function dayOfYearUTC(date: Date): number                 // SPEC-4.1/4.2 的 N
export function solarDeclinationDeg(date: Date): number          // SPEC-4.1
export function equationOfTimeMin(date: Date): number            // SPEC-4.2
export function subsolarPoint(date: Date): { lat: number; lon: number }  // SPEC-4.1 + 4.3

// src/globe/sun.ts
export function sunDirectionModel(date: Date): THREE.Vector3     // SPEC-4.5，单位向量，模型空间

// src/globe/earth.ts
export function createEarthGeometry(): THREE.SphereGeometry      // uv 约定的唯一出处（SPEC-3.6）
export function createEarth(tex: EarthTextures): {
  mesh: THREE.Mesh
  setSunDir(dir: THREE.Vector3): void                            // 唯一的 uniform 写入口
}

// src/globe/textures.ts
export interface EarthTextures { day: THREE.Texture; night: THREE.Texture }
export function loadEarthTextures(): Promise<EarthTextures>

// src/globe/atmosphere.ts
export function createAtmosphere(): THREE.Mesh
// src/globe/starfield.ts
export function createStarfield(): THREE.Points

// src/globe/controls.ts
export interface CameraState { azimuthRad: number; polarRad: number; distance: number }
export class GlobeControls {
  constructor(dom: HTMLElement)
  /** 推进一帧：返回本帧相机状态与地球自转增量（弧度） */
  update(): { camera: CameraState; spinDeltaRad: number }
  dispose(): void
}

// src/globe/GlobeScene.ts（既有类，扩展）
export class GlobeScene {
  constructor(container: HTMLElement)
  /** M2 事件标记层接入点：随地球自转的容器（SPEC-6.2 模型空间） */
  readonly markerRoot: THREE.Object3D
  dispose(): void
}
```

签名是**契约下限**：DEV 可增内部私有成员，不可改这些的语义与所在文件。

### 3.3 场景图

```
scene
├── earthGroup (Object3D)          ← 空闲自转 rotation.y 累加；== GlobeScene.markerRoot
│     └── earthMesh                ← createEarth().mesh
├── atmosphereMesh                 ← 旋转对称，挂根即可
└── starfield (Points)             ← 不受 earthGroup 影响（SPEC-3.5）
camera (Perspective, fov 45)       ← 由 CameraState 球坐标定位，始终 lookAt 原点
```

### 3.4 sunDir 数据流与更新频率（SPEC-4.5）

```
Date（真实 UTC now）
  → astro.subsolarPoint(date) → { lat, lon }
  → geo.latLonToVector3(lat, lon, 1)                 // SPEC-6.2
  → earth.setSunDir(v) → uniform uSunDir（模型空间）
```

- 首帧立即计算一次；此后在 RAF 循环内**节流为 60000ms 一次**（SPEC-4.5 明文允许降频至 1 次/分钟，取该下限省算力）。
- uniform 用 `Vector3.copy` 就地更新，无需 `needsUpdate`。
- **模型空间是硬约定**：`uSunDir` 不随 `earthGroup.rotation.y` 变换，shader 用未经模型矩阵的法线（即归一化的 `position`）做点积。
  这样空闲自转转动地球时，晨昏线相对地理位置保持正确，且 M2 标记（同为 earthGroup 子节点）天然对齐。

### 3.5 shader uniform 契约

`earth`（ShaderMaterial，非 Raw）：

| uniform | 类型 | 含义 | 锚点 |
| --- | --- | --- | --- |
| `uDayMap` | sampler2D | 昼纹理 | SPEC-3.2 |
| `uNightMap` | sampler2D | 夜纹理 | SPEC-3.2 |
| `uSunDir` | vec3 | 模型空间单位向量 | SPEC-4.5 |
| `uNightGain` | float | 夜景增益，默认值须 ≥1.5 | SPEC-3.3 |
| `uTwilight` | float | 过渡带半宽（t 域），默认 0.1 | SPEC-3.2 |

varying：`vUv`（几何 uv）、`vNormalModel`（模型空间法线）。
片元核心：`k = smoothstep(-uTwilight, uTwilight, dot(normalize(vNormalModel), uSunDir))`，
`color = mix(night * uNightGain, day, k)`——`k=1` 时灯光项权重为 0，满足 SPEC-3.3。

`atmosphere`（ShaderMaterial，BackSide + AdditiveBlending + depthWrite=false + transparent）：

| uniform | 类型 | 含义 | 锚点 |
| --- | --- | --- | --- |
| `uColor` | vec3 | `#4a90d9` | SPEC-3.4 |
| `uPower` | float | 菲涅尔指数（向外衰减陡度） | SPEC-3.4 |
| `uIntensity` | float | 整体强度 | SPEC-3.4 |

壳半径按 1.0 的 1.0x~1.2x 缩放取值，由 DEV 视觉调参；**只有颜色与"不遮挡"是 spec 约束，形状参数是实现自由度**。

### 3.6 交互状态机与相机边界

状态：`DRAG` / `INERTIA` / `IDLE_WAIT` / `AUTO_SPIN`。

| 迁移 | 触发 | 动作 |
| --- | --- | --- |
| * → DRAG | pointerdown | 清零惯性速度、退出自转、重置空闲计时 |
| DRAG → DRAG | pointermove | 按像素增量改 azimuth/polar，记录瞬时角速度 |
| DRAG → INERTIA | pointerup/cancel 且速度 > 阈值 | 保留角速度 |
| DRAG → IDLE_WAIT | pointerup 且速度 ≤ 阈值 | — |
| INERTIA → INERTIA | 每帧 | `v *= 0.95` 的时间基准等效衰减（SPEC-7.1 + SPEC-7.5，见 §2.3） |
| INERTIA → IDLE_WAIT | \|v\| < ε | — |
| IDLE_WAIT → AUTO_SPIN | 距最后输入 ≥ 10000ms | 起自转（SPEC-7.3） |
| AUTO_SPIN → DRAG/IDLE_WAIT | 任何输入 | 立即停自转（SPEC-7.3） |
| 任意 → 同态 | wheel / 双指捏合 | 改 distance 并夹紧，重置空闲计时（SPEC-7.2） |

相机参数边界：

| 量 | 范围 | 初值 | 锚点 |
| --- | --- | --- | --- |
| `distance` | [1.8, 6]（硬夹紧） | 3.2 | SPEC-7.2 / SPEC-3.1 |
| `polarRad`（自 +Y 起算） | [5°, 175°]，即仰角 ±85° | 90° | SPEC-7.1 |
| `azimuthRad` | 无限制（自由累加/取模） | 0（见下方推导） | SPEC-7.1 / 3.1 |
| `fov` | 45°（常量） | — | SPEC-3.1 |
| `near / far` | far 须 > 星空球壳半径 + 距离上限 | — | SPEC-3.5 |

SPEC-3.1 定义初始视角：「相机位于 (lat 0, lon 0) 正上方、距球心 3.2、视线指向球心，上方向为 +Y；地球本体初始自转角为 0」。
结合 SPEC-6.2「(lat 0, lon 0)→+Z」可推导：本文档的相机球坐标参数化必须满足 `azimuthRad=0、polarRad=90°` 时相机位于世界 +Z 轴上
（即 `camera.position = (0, 0, distance)`）——这是 DEV 选择 azimuth 零点参照系时的约束，方位角正方向可自由定义，但零点必须满足此推导。
据此初值：**`azimuthRad = 0`（对应正对 lon 0 半球）、`polarRad = 90°`、`earthGroup.rotation.y = 0`**。

DOM 细节：pointer 事件用 `setPointerCapture`；wheel 监听须 `{ passive: false }` 并 `preventDefault`；
canvas 需 `touch-action: none`（否则移动端拖拽被浏览器滚动吞掉）。

### 3.7 M1 / M2 接口边界

- **`GlobeScene.markerRoot`** 是 M2 标记层（FM-07）的唯一接入点：M2 把 instanced 标记挂进去即可获得正确地理对齐与自转跟随。M1 只暴露该属性，**不实现任何标记、不引入 GeoEvent 类型、不做 raycast/拾取**。
- 大气的 `depthWrite=false` + 加法混合是给 M2 的前置保证（SPEC-3.4「不遮挡标记」），M1 阶段无从验证，DEV 须按此实现并在注释标注原因；
  该断言与 SPEC-3.8 同批延后至 M2 FM-07 标记层场景登记时回补（见 §1 豁免声明）。
- SPEC-7.4 的相机飞行是 M2/M3 的事；M1 的 `GlobeControls` **不要**预留 `flyTo` 空壳（YAGNI）——届时新增方法即可。

### 3.8 校准标记钩子（SPEC-3.6，服务 testplan M1-05）

SPEC-3.6 的判据以「(lat 0, lon 0) 的球面标记」为载体，而 M1 无标记层，故须提供最小校准入口。约束：

- **零生产可见面**：只在 `import.meta.env.DEV` 分支挂载，生产构建里该路径必须被摇掉；不加 URL 参数、不加 UI 开关。
- 形态：`GlobeScene` 在 DEV 下把一个句柄挂到 `window`（如 `__globeDebug`），暴露
  `addCalibrationMarker(lat: number, lon: number): void`——用 `latLonToVector3` 定位、挂进 `markerRoot`、
  画一个小尺寸纯色点（颜色任选，**不得使用 SPEC-3.7 分类色**，避免与 M2 语义混淆）。
- e2e 用 `page.evaluate` 调用后截图；`make e2e` 跑的是 dev server，条件成立。
- 这不是 FM-07 标记层的雏形，M2 不必复用；实现要短到可以随手删。

## 4. 实现提示（不构成强约束）

### 4.1 纹理经度对齐推导（SPEC-3.6，M1 最易错点）

three.js `SphereGeometry` 顶点公式（r185）：
`x = −R·cos(φs + u·φL)·sin(θ)`，`z = R·sin(φs + u·φL)·sin(θ)`，uv.x = u。
默认 `phiStart = 0` 时 u=0.25 才落在 +Z（SPEC-6.2 的 lon 0），而标准等距圆柱纹理的 lon 0 在 u=0.5——**有 90° 错位**。

两种等价修法，任选其一（DEV 自由度）：
1. `new THREE.SphereGeometry(1, 64, 64, -Math.PI / 2)`——u=0.5 ↔ +Z ↔ lon 0，u=0.75 ↔ +X ↔ lon 90°E，u 向东递增。**推荐**，无需 wrap 配置。
2. `phiStart = 0` + `texture.offset.x = 0.25` + `wrapS = RepeatWrapping`（昼夜两张都要设）。

竖直方向默认即正确：uv.y=1 ↔ +Y 北极，与 flipY 默认的图片顶行对应。
「片元内解析算 uv」的禁令已上移为 §2.2 硬约束，此处不再重复。

### 4.2 色彩空间

昼/夜纹理须设 `colorSpace = THREE.SRGBColorSpace`。`ShaderMaterial` 不会自动做输出色彩空间转换，
片元末尾需包含 `#include <colorspace_fragment>`（必要时 `<tonemapping_fragment>`），否则整体偏暗/偏灰。

### 4.3 性能（M1 无验收判据，见 §1 SPEC-3.8 豁免声明；本节为建议性实现提示）

M1 绘制量极小（1 球 + 1 壳 + 1 Points），瓶颈在 5400×2700 JPEG 的解码与 GPU 上传（首帧卡顿）。
建议：保持 `setPixelRatio(min(dpr, 2))`（M0 已有）；anisotropy 取 `min(4, maxAnisotropy)`；星空用单个
`Points` + `BufferGeometry`，不要 1500 个对象。分辨率分级留到 M5（ASSETS.md 已备注），M1 不做。

### 4.4 生命周期

沿用 M0 的 `dispose()` 模式（含 `forceContextLoss`，见 GlobeScene 注释）：新增的 geometry / material / texture /
事件监听 / RAF 全部要在 `dispose()` 释放，否则 React StrictMode 双挂载会撞浏览器 WebGL context 上限。
纹理异步加载须防「加载完成时组件已卸载」的竞态。

### 4.5 纹理未就绪/失败期

按 SPEC-3.2：用深色占位（近夜面色）让球正常渲染，**不显示** loading 动画/文案/进度指示；纹理就绪后直接替换，无淡入过渡。
加载失败不重试、不弹错误 UI，保持占位渲染，错误细节仅进 console。

## 5. spec 提案裁决记录（REV-002，已应用，仅供追溯）

P1~P5 已经 rev（REV-002）仲裁、由 orch 应用到 `doc/spec.md` 正文 + §0 修改记录（v0.1）并 `make pin-spec`。
本节不再是约束来源——DEV/QA 一律以 spec 正文引用的条目号为准；本表仅保留裁决对照，便于追溯来龙去脉。

| # | 缺口 | 落地 spec 条目 | 裁决摘要 |
| --- | --- | --- | --- |
| P1 | 年积日 N 起点 | SPEC-4.1 | UTC 日期、1 月 1 日 = 1 |
| P2 | 每帧常量的帧率依赖 | SPEC-7.1 / SPEC-7.3 / 新增 SPEC-7.5 | 以 60fps 为时间基准，跨帧率按时间域等效衰减/角速度 |
| P3 | 初始视角与地球初始自转角 | SPEC-3.1 | 相机位于 (lat 0, lon 0) 正上方、地球初始自转角 0 |
| P4 | 拖拽/自转的作用对象 | SPEC-7.1 / SPEC-7.3 | 拖拽/惯性作用于相机，空闲自转作用于地球本体 |
| P5 | 纹理未就绪/失败期表现 | SPEC-3.2 | 深色占位渲染，不显示 loading UI；失败保持占位、不重试不弹错误 UI |

裁决全文与依据见 `doc/review/REV-002.md` §5。

## 6. 验收判据

### 6.1 DEV 自检（交付前必过）

- `make lint`：eslint 0 警告 + `tsc --noEmit` 0 错误。
- `make test`：新增/既有单测全绿，含 `tests/geo.test.ts` 不回归。
- `make dev` 手动开一次，确认无 console 报错、无 WebGL context 警告。

### 6.2 建议 QA 覆盖的检查点（只列检查点，断言由 QA 从 spec 推导）

对已登记场景的映射（testplan M1-01~M1-12，M1-12 按 REV-002 T-4/G-3 新增）：
M1-01→1，M1-02→2,3，M1-03→4,5，M1-04→8,12，M1-05→9,13，M1-06→9，M1-07→10，M1-08→11，
M1-09→15,16，M1-10→14，M1-11→17,18，M1-12→6,7。
检查点 6/7（几何 uv↔坐标一致性单测）已挂载独立场景 M1-12——SPEC-3.6 + SPEC-6.2 的可机械化判据，
避免只靠截图人眼判漏掉南北翻转与东西镜像。检查点 18（自转作用对象）与检查点 11 互为印证，并入 M1-11。


天文（可全部单测，无需 WebGL）：
1. 赤纬在春分/夏至/冬至三个锚点的取值（SPEC-4.4）。
2. 均时差全年幅度上界（SPEC-4.4）。
3. EoT≈0 日期的 UTC 正午直下点经度（SPEC-4.4）。
4. 直下点经度的归一化区间——含跨界输入（SPEC-4.3）。
5. `sunDirectionModel` 输出为单位向量，且与 `subsolarPoint` + `latLonToVector3` 组合一致（SPEC-4.5 + 6.2）。

坐标/纹理对齐（可单测，构造几何后检查顶点，无需渲染）：
6. `createEarthGeometry()` 中 uv≈(0.5, 0.5) 的顶点位置 vs `latLonToVector3(0, 0)`（SPEC-3.6 + 6.2）。
7. 同法校验 uv≈(0.75, 0.5) ↔ (lat 0, lon 90°E) 与 uv.y=1 ↔ 北极——确认 u 向东递增、无南北翻转（SPEC-3.6 + 6.2）。
8. 几何分段数下限（SPEC-3.1）。

渲染（e2e/截图 + 参数检查）：
9. shader 过渡带宽度参数与昼/夜权重端点行为（SPEC-3.2 / 3.3）。
10. 大气材质的混合与 depthWrite 设置（SPEC-3.4，为 M2 不遮挡兜底）。
11. 星空点数、球壳半径下限、以及**不随地球自转移动**（SPEC-3.5）。
12. 相机 fov 与初始距离（SPEC-3.1）。
13. 视觉截图：经 §3.8 钩子加 (0, 0) 校准标记后，该标记落点相对昼纹理非洲西岸的位置（SPEC-3.6）。

交互（controls 状态机可在无 WebGL 下单测）：
14. 距离夹紧上下界（SPEC-7.2）。
15. 仰角夹紧 ±85°、水平方位无限制（SPEC-7.1）。
16. 释放后惯性衰减比例（60fps 基准 ≈0.95/帧）与收敛，以及固定采样帧率下的等效性（SPEC-7.1 + SPEC-7.5）。
17. 空闲 10s 触发自转、任何输入立即停、计时重置（SPEC-7.3）。
18. 自转作用于地球组而非相机（与检查点 11 互为印证，SPEC-3.5 + 7.3）。

> 检查点 2/3/16/17 的期望值已锚定 SPEC-4.1（P1，年积日 N 起点）与 SPEC-7.5（P2，60fps 时间基准），无需再标注仲裁依赖。
