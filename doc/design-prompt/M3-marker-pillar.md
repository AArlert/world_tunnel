# design-prompt — 标记层重写（动效批·光柱标记）

> arch 撰写，rev 门禁通过后 orch 据此派 dev。只准约束实现，不准定义 spec 之外的对外可见行为（行为泄漏禁区）。
> 触发：D27 / BUG-031（OPEN，dev 实现光柱后 qa 机械关单）。spec 已全部落定（v0.3.2 pin，REV-017 通过）：SPEC-3.7（等径光柱+柱高阶梯+三档静态体积辉光）、SPEC-3.7a（光柱形态与静态体积辉光）、SPEC-3.7b（静态新鲜度 `F(a)`）、SPEC-3.7c（标记 LOD 与聚合）、SPEC-3.11a（reduced-motion）。
> 设计参照（已过门禁，实现取值搬自其中，本 DP 不新造对外值）：`doc/design-prompt/proposal-batch2-motion.md`、`doc/design-prompt/visual-batch2-motion.md`。
> **本 DP 全部为实现私有约束**：拓扑选型、shader 策略、数据结构、方法签名、切片顺序——均非对外可见行为，不需入 spec。凡对外可见取值一律引 SPEC 条目号（我在引用 spec 的既定值，不是在此定义新值）。

---

## 1. 目标与范围

**做什么**：重写 `src/globe/markers.ts` 的渲染形态——把现行「圆球点（dots）+ 脉冲/柔光环（rings）」两层结构，换成 **径向站立的等径体积光柱 + 根部足印**，落地 SPEC-3.7/3.7a/3.7b/3.7c/3.11a。

**不做什么**：
- 不改分类色表 / HSL 乘子 / 派生 hex（SPEC-3.7，已 pin，`CATEGORY_COLORS`/`deriveSeverityColor`/`severityCategoryCss` 三个导出原样保留）。
- 不改呼吸时长/曲线（SPEC-3.11，`tick(elapsedMs)` 签名与 `FADE_DURATION_MS` 语义不动）。
- 不做簇内展开 / 计数徽章（L1 注记层，另案；本批每簇只出一根代表柱，SPEC-3.7c）。
- 不做 flight 图层特化（沿用统一光柱，flight 图层归后续）。
- 不引入任何「未来风格包/未来动效」抽象（极简：只实现 spec 已定的一种静态光柱）。

---

## 2. 约束（每条标 SPEC 锚点；对外值均为引用 spec 既定值）

### 2.1 光柱几何与形态（SPEC-3.7 / SPEC-3.7a）
- 标记为**世界空间**等径体积光柱，随相机远近自然缩放；沿**径向**（球心→地表点）站立（SPEC-3.7a）。
- 引用 spec 既定取值（单位 R=1）：根部半径 `r0`=0.010R（等径，全 severity 恒定）；尖端半径 `r1`=0.35·r0（锥收束）；柱高 `H` sev1/2/3 = 0.05/0.09/0.15R；尖端顶部 20% 软消散至全透明（SPEC-3.7a）。
- **无硬轮廓**：径向软边（中心实、边缘渐隐至 ~0）；尖端软消散——命中 RingGeometry 式硬边靶环即回退到 M2 问题（SPEC-3.7a「RingGeometry 式靶环退场」）。这是本批相对现状的关键质感判据。
- severity 由**柱高 + 静态发光基线 + 白热核**三者静态冗余编码，**常驻态全静止、无任何脉冲/持续动画**（SPEC-3.7，脉冲硬句已删）。

### 2.2 静态体积辉光（SPEC-3.7a）
- 沿柱高三段色梯度：根部白热核 → 柱身 pin 基色（SPEC-3.7 派生分级色，原样）→ 尖端 α 消散（保 hue 消 alpha）；发光沿高度衰减（根亮尖暗，末端干净归 0）（SPEC-3.7a）。
- **根部静态足印**（软径向盘）：足印半径 sev3/2/1 = 2.4/1.8/1.2·r0（SPEC-3.7a）；是远景 LOD 与子相机点压扁态的兜底可读体。
- **白热核护栏**（SPEC-3.7a，对外硬约束）：仅 sev2/sev3 出现（sev1 无白核）、sev3 强于 sev2；体积限最内 30%·r0 半径 & 最低 12% 柱高内（不吞没柱身分类色）；tint 用冷暖白非纯白——暖色相（disaster/conflict/humanitarian）`#fff0e0`、冷色相（news/launch/flight）`#e8f2ff`；随新鲜度冷却（旧事件无白核，见 2.3）。
- 发光相对档序 sev3>sev2>sev1 为硬约束（fresh 峰值 Y 参考 sev3≈210/sev2≈150/sev1≈105 为量测参考，绝对值量测方法交 testplan，SPEC-3.7a）。

### 2.3 静态新鲜度（SPEC-3.7b）
- 事件年龄 `a = now − ts`（ts 见 SPEC-6.1），发光乘子 `F(a) = 0.5 + 0.5·exp(−a/τ)`，τ=8h，下限 0.5（SPEC-3.7b）。
- `F` **只乘辉光**：根部发光基线、白热核权重、大气散射 bloom、根部足印强度；**不乘**柱身 pin 基色、柱高、呼吸 alpha（SPEC-3.7b/3.11）。
- 地板 0.5：旧事件仍是可辨的分类色柱、不因变旧而消失——离屏交给过期离场（SPEC-6.3①），不交给新鲜度。
- **静态实现要求（承 SPEC-3.11a）**：`F` 只在数据更新（`setEvents`）时以当时 `now` 重算并逐实例固化，两次 `setEvents` 之间**保持不变**——`F` 绝不逐帧推进，否则辉光会随时间缓慢漂移构成「常驻动画」，违 SPEC-3.11a「稳态截图两帧无差异」。

### 2.4 深度 / 混合 / 与大气·夜面自洽（SPEC-3.4 / SPEC-3.7a）
- 光柱（含 bloom）深度上叠于大气之上，延续 SPEC-3.4「大气不遮挡标记」。
- 混合模式 = **screen**（禁纯加性，防密集/临边过曝白）；合成发光亮度天花板 **Y≤220**（禁纯白 255）（SPEC-3.7a）。
- 临边柱段与菲涅尔 halo（`#4a90d9`，SPEC-3.4）重叠处以 screen + Y≤220 避免脏白（SPEC-3.7a）。
- 球背面（过 limb）的柱须被球体遮住（depthTest 生效），只留近侧临边站柱（SPEC-3.7a「立于被照亮球面」+ visual §3.8）。
- 两半球均须可读：夜面靠亮度对比、昼面靠 hue 对比（SPEC-3.7a）。

### 2.5 呼吸与 reduced-motion（SPEC-3.11 / SPEC-3.11a）
- 光柱 master emission = **现呼吸 alpha**（整根柱=柱身+辉光+足印的统一透明/发光乘子）；登场 0→1、离场 1→0 走**现有呼吸包络**，不新增时间参数、不改 SPEC-3.11 时长/曲线。
- 首批 snap（无前态时透明度即置满、不淡入）语义原样延续（SPEC-3.11 消歧句 + SPEC-3.2①）——即现 `hasPopulated` 逻辑保留。
- reduced-motion（SPEC-3.11a）：`prefers-reduced-motion` 开启时增量呼吸瞬切（登场 alpha 0→1、离场 1→0 瞬时；含可选高度缓入亦瞬切）。
- **稳态零动画不变式（SPEC-3.11a 的实现总纲）**：无数据变化、无相机档切换、无进行中的呼吸过渡时，`tick` 对 GPU **零写入**——稳态两帧逐字节无差异。这要求：① 删除现 `tick` 中无条件每帧写 rings 矩阵的路径；② 所有 `needsUpdate` 一律 gate 在「本帧确有变化」之后；③ 辉光/白热核/足印/新鲜度全部为静态量，无隐藏时变（无相机驱动微闪、无辉光呼吸、无足印脉动，SPEC-3.11a 自查项）。

### 2.6 标记 LOD 与密集区聚合（SPEC-3.7c）
- 以相机距 `d`（R=1，可达区间 SPEC-7.2 [1.8,6]）分三档，档界引用 spec：远 d≥3.0 / 中 2.4≤d<3.0 / 近 1.8≤d<2.4（SPEC-3.7c）。
- 每档显隐规则（SPEC-3.7c）：远——足印为主，sev1 收为足印点（不出全柱）、sev2/3 出短柱；中——全 severity 出全柱、高度阶梯完整可读；近——全部独立全柱、体积细节。
- 聚合角距（同 LOD 下事件**大圆角距** < 阈值即并为一簇，与视角无关）：远 5° / 中 2.5° / 近 0.8°（SPEC-3.7c）。
- 代表柱规则（SPEC-3.7c）：簇内取**最高 severity** 成员定柱高（高=max，平手取**最新**成员）；辉光热度取代表成员 age；**hue 不做平均**（取代表成员分类色，不混合多类 hue）。
- 每簇只出**一根**代表柱（守 L0 三变量封顶，SPEC-3.7c）；计数徽章/簇内展开不做（L1，另案）。
- **与 SPEC-3.2a 底图注记 LOD 是不同对象**：本层只管事件标记对象的显隐与聚合，互不推导（SPEC-3.7c）。

### 2.7 性能与结构（SPEC-3.8 / SPEC-3.10）
- ≥200 标记走 instancing，不逐事件建 Mesh；场景图渲染对象数为**小常数、不随事件数线性增长**（SPEC-3.8，M2-11 结构判据不回退）。
- 标记走 instancing：每个 InstancedMesh 一次 draw call 承载其全部展示实例（现为柱+足印二 mesh 结构，见 §3.2/§4.1），draw call 数为小常数、不逐事件建 Mesh；实例属性只在变化时上传（呼吸 alpha 仅在过渡进行中逐帧上传，settled 后停）。

---

## 3. 接口与导出签名兼容面

### 3.1 保持不变（qa 回退重测可直接复用）

| 导出 / 观测点 | 签名 | 复用测试 | SPEC |
| --- | --- | --- | --- |
| `createMarkerLayer` | `(): MarkerLayer`（**无参不变**） | M2-11 / M2-25 | SPEC-3.8 |
| `MarkerLayer.object` | `readonly THREE.Object3D` | M2-11 / M2-21 / M2-25 | SPEC-3.8 |
| `MarkerLayer.setEvents` | `(events: readonly GeoEvent[]) => void` | M2-21 / M2-25 | SPEC-3.7 / 3.11 |
| `MarkerLayer.setHighlight` | `(id: string \| null) => void` | 联动 | SPEC-7.4 |
| `MarkerLayer.pick` | `(raycaster: THREE.Raycaster) => string \| null` | 联动 | SPEC-7.4 |
| `MarkerLayer.tick` | `(elapsedMs: number) => void`（**签名不变**，去脉冲、稳态零写入） | M2-21 / M2-25 | SPEC-3.11 / 3.11a |
| `MarkerLayer.dispose` | `() => void` | all | - |
| `CATEGORY_COLORS` | `Record<Category, number>` | M2-10 单测 / App.tsx | SPEC-3.7 |
| `deriveSeverityColor` | `(out, category, severity) => THREE.Color` | 面板/内部 | SPEC-3.7 |
| `severityCategoryCss` | `(category, severity) => string` | EventPanel / M3-01 | SPEC-2.2a / 3.7 |
| **`instanceAlpha` 逐实例属性** | 承载呼吸 alpha 的 GPU 侧观测通道 | M2-21 / M2-25 / globeDebug | SPEC-3.11 |

**instanceAlpha 观测契约（test-compat，须严守）**：M2-21/M2-25 复跑依赖承载呼吸的光柱 InstancedMesh 同时满足三条不变式——
(a) 该 mesh 须为 `layer.object`（Group）的**第一个子节点**（`children[0]`）；
(b) 该 mesh 携名为 `instanceAlpha` 的 per-instance float 属性，承载呼吸 alpha；
(c) **该 mesh 的逐实例 instanceMatrix 平移分量必须等于标记根位置 `latLonToVector3(lat,lon,MARKER_R)`**（即矩阵元素 `[12][13][14]`）——e2e helper `globeDebug.sampleMarkerInstances`/`injectAndRecordBreathing` 均按 instanceMatrix 平移方向识别标记实例（非按自定义属性读取），(c) 是二者无需改 helper 即可复跑的前提；若根位置只存自定义属性而令 instanceMatrix 退化为单位阵，`sampleMarkerInstances` 读回平移全 0、`injectAndRecordBreathing` 的 `alphaAt` 因 `len<1e-6` 跳过全部实例返回 NaN，M2-21 断言直接失败。

M2-25 单测按「携带 instanceAlpha 属性的子节点」定位（对顺序稳健，只依赖 (a)(b)）。三条不变式共同保住 M2-21/M2-25 无需改 helper 即可复跑；(c) 相应收窄 §3.4 逐实例数据打包自由度（见该节）。

### 3.2 必须变更 / 删除（qa 须据此调整测试）

| 导出 / 结构 | 变更 | 受影响测试（qa 处理） | SPEC 依据 |
| --- | --- | --- | --- |
| `SEVERITY_PULSE_AMP` | **删除**（脉冲语义已删） | M2-10 单测删「PULSE_AMP 递增」断言 | SPEC-3.7 删脉冲 |
| `SEVERITY_BASE_SIZE`（球基础尺寸） | **改名并重定义**为 `SEVERITY_PILLAR_HEIGHT: Record<1\|2\|3, number> = {1:0.05, 2:0.09, 3:0.15}`（柱高，R=1） | M2-10 单测改引用；值现为 SPEC-3.7a pin（非实现自由度），可断严格递增或精确值 | SPEC-3.7a |
| `rings` InstancedMesh 子节点 | **删除**（辉光改 shader 内梯度实现，不再有独立环 mesh） | M3-03 发光段 + `globeDebug.sampleMarkerRings` 须 qa 重写为像素法 | SPEC-3.7 / 3.7a |
| `layer.object` 子节点数 | 由 2（dots+rings）→ 切片①后 1（柱）→ 切片②补足印后 2（柱+足印）；**永为小常数、不随事件数增长** | M2-11 判据由「恒为 2」重推为**逐切片钉精确子节点数**（切片①=1；切片②/③=2）+ 不随事件数增长 + 各 InstancedMesh.count == 展示标记数 | SPEC-3.8 |

### 3.3 新增接口（向后兼容，既有调用方不受影响）

| 新增 | 签名 | 用途 | SPEC | 引入切片 |
| --- | --- | --- | --- | --- |
| `MarkerLayer.setCameraDistance` | `(distance: number) => void` | 传入相机距 `d`；内部按档界判 LOD 档、仅在**档切换**（或事件变化）时重算聚合 | SPEC-3.7c | ③ |
| `MarkerLayer.setReducedMotion` | `(enabled: boolean) => void` | 切呼吸瞬切/坡升；默认 `false`（保 M2-25 断言 B 坡升路径） | SPEC-3.11a | ① |

> 为何 LOD 用独立方法而非扩 `tick`：保 `tick(elapsedMs)` 单参签名不变，M2-21/M2-25 直接复跑。`setCameraDistance` 每帧由 GlobeScene 调（cheap），内部只在档界穿越时重算聚合，非每帧重聚合。

### 3.4 逐实例数据契约（实现私有，dev 自行打包）
一根光柱实例须携带：根部位置（模型空间，`latLonToVector3(lat,lon,MARKER_R)`）、径向轴（由位置归一化派生）、柱高（=severity→`SEVERITY_PILLAR_HEIGHT`）、柱身 pin 基色（`deriveSeverityColor`，即现 `instanceColor`）、呼吸 alpha（`instanceAlpha`）、新鲜度 `F`（SPEC-3.7b，静态固化）、以及能判白热核档位的 severity。LOD 当前档为**全体一致**，宜作 material uniform（非逐实例）。

**打包自由度的边界（承 §3.1 不变式 (c)，收窄）**：根部位置**必须**写入 instanceMatrix 的平移分量（矩阵元素 `[12][13][14]`），不得只存自定义属性、令 instanceMatrix 退化为单位阵——billboard 方案（§4.1 推荐 A）下径向轴/朝向/柱高等可另走自定义属性，但根位置这一分量不可绕开 instanceMatrix，因 e2e helper 靠该分量识别标记实例（§3.1）。除该项外，具体属性布局/打包细节仍属自由度。

### 3.5 GlobeScene 接线变更（dev 一并改 `src/globe/GlobeScene.ts`）
- animate 循环加 `this.markerLayer.setCameraDistance(this.camera.position.length())`（球心在原点，相机距 = 位置模长）。
- reduced-motion 接线：`setReducedMotion(matchMedia('(prefers-reduced-motion: reduce)').matches)`，并监听其 change 事件运行时切换。
- `tick(elapsedMs)` 调用点不变。dispose 注释「两个 InstancedMesh」按实际子节点数订正。

---

## 4. 实现提示（不构成强约束）

### 4.1 几何/shader 选型（自由度，SPEC-3.7a 明列）
- **推荐 A：轴锁 billboard**——逐实例携根位置+径向轴+柱高，vertex shader 每帧绕径向轴构建朝相机的软四边面片，fragment shader 算三段梯度/径向软边/白热核/screen。软体积质感最贴 signature，且 billboard 朝向是相机的纯函数（GPU 侧、零 CPU 每帧写；相机静止时输出逐帧一致，不违 SPEC-3.11a 稳态）。
- **备选 B：极简锥几何**——逐实例矩阵把低模锥沿径向摆正，shader 补软边。变换简单但须在 shader 里把边缘/尖端软化到无硬轮廓，否则退回 M2 靶环（SPEC-3.7a）。
- 无论 A/B：**禁硬轮廓**（径向软边 + 尖端软消散是硬判据，SPEC-3.7a）。
- 足印是 tangent 平面上的软径向盘（朝向与柱不同），宜作**独立 InstancedMesh**（切片②引入）；子节点 [柱, 足印]，柱为 `children[0]`（见 3.1 观测契约）。

### 4.2 screen 混合与过曝封顶
- three 无内建 ScreenBlending：用 `CustomBlending` + `blendEquation=AddEquation` + `blendSrc=OneFactor` + `blendDst=OneMinusSrcColorFactor` 得 `src + dst·(1−src)` = screen（实现细节，自由度）。
- `depthWrite:false`（柱间不自遮、screen 顺序容忍）、`depthTest:true`（球体遮住背面柱，2.4）；`renderOrder` 保持 ≥ 大气（现值 10，大气 renderOrder 0 且 depthWrite:false → 不遮柱，SPEC-3.4）。
- **Y≤220 封顶落法**（SPEC-3.7a 对外硬约束）：单柱峰值（含白热核）clamp 在 ~Y210–220、白热用冷暖白非纯白，叠加靠 screen 的边际递减 + LOD 聚合压低重叠密度共同守住合成 ≤220。**不建议**为此单独加全屏后处理 pass（对当前无后处理的直绘管线是过度设计）；若 testplan 量测显示重叠区仍越 220，再评估降峰或局部 clamp。此为 dev 自查 + qa 量测迭代点，非一次定死。

### 4.3 LOD 聚合数据结构（切片③）
- **事实源** = `setEvents` 存下的全量事件；**展示集** = 按当前档 θ 对全量做大圆角距聚合后的**代表柱集**。
- 聚合仅依赖（事件集，档 θ）；档只依赖 `d`。故重算触发点仅两处：`setEvents`（数据变）、`setCameraDistance` 且**档发生切换**。`setCameraDistance` 每帧调但档未变则 no-op（无每帧重聚合）。
- 代表柱按 SPEC-3.7c 选（max severity，平手取最新）；簇的稳定 key 建议取代表事件 id，便于展示集 diff。
- **呼吸 vs LOD 的正交**：呼吸（`instanceAlpha`）只服务**数据增量**（`setEvents` 的 id diff，SPEC-3.11）；**相机档切换导致的代表柱增减直接落展示集、不走呼吸淡入淡出**——相机驱动不施动画（SPEC-3.11a「无相机驱动微闪」+ D27「呼吸只用于增量」）；该读法已经 REV-021 §5 裁定成立（见 §7）。
- `pick`/`setHighlight` 作用于展示的代表柱：`pick` 返回代表事件 id；`setHighlight(id)` 若 id 被聚为非代表成员，最小处理为高亮其所在簇的代表柱或 no-op（SPEC-7.4 未规定被聚成员的高亮，极简即可，自由度）。

### 4.4 已知陷阱
- **BUG-021**（pick 包围球陈旧）：`InstancedMesh.boundingSphere` 懒缓存不随 instanceMatrix/count 自动失效；`setEvents`/聚合重算后须置 `boundingSphere=null` 令 raycast 懒重算。现 markers.ts 已有此处理，重写勿丢。
- **BUG-022**（加色叠白）：辉光务用 screen 非纯加性（4.2），叠加结果不得越出分类色域趋白（白不属 SPEC-3.7 色表）。
- **highlight 不得引入常驻动画/新色语义**：联动高亮沿用中性强调（尺寸或亮度微升，静态 state 非动画），不加第二色语义（BUG-022 家族）——具体强调量属自由度（现 1.8× 尺寸即一种）。
- **billboard 拾取**：若柱用 billboard，raycast 细面片可能不稳；可对足印/根部小体做拾取代理，或直接 raycast 柱几何（自由度）；务必复跑联动冒烟。

---

## 5. 验收判据

### 5.1 dev 自检
- `make lint` 通过（tsc strict + eslint）；`make test TEST=markers`、`make test TEST=marker-initial-snap` 相关单测本地跑通（M2-11/M2-25 依 3.1/3.2 兼容面复跑或最小改）。
- 稳态零写入自查：静止（相机不动、无新数据、无进行中呼吸）时 `tick` 不触发任何 `needsUpdate`；构造两帧截图逐字节相同（SPEC-3.11a）。
- 无隐藏动画自查（SPEC-3.11a）：确认辉光/白热核/足印/新鲜度全静、无相机驱动微闪。

### 5.2 建议 qa 覆盖检查点（只列检查点，断言由 qa 从 SPEC 推导）
**回退重测（现 ✅ 判据照旧脉冲 spec，须回退）**
- **M2-10**（`marker-category-severity`）：删「sev3 持续脉冲环/4 帧有异」断言；改验 六类分类色仍匹配色表（SPEC-3.7 不变）+ 等径 r0 + 柱高单调 sev3>sev2>sev1（SPEC-3.7a）+ 稳态两帧无差异（SPEC-3.11a）。**注意**：LOD 落地（切片③）后默认视角 d=3.2 落远档（sev1 仅足印、sev2/3 短柱），柱高阶梯完整可读需相机拉近至中档 2.4≤d<3.0（SPEC-3.7c）——柱高阶梯采样相机距须相应调整（切片①/②期间无 LOD、默认视角即出全柱，可先在默认视角验；③ 落地后须改）。
- **M3-03**（`marker-severity-tri-channel`）：色相/明度/饱和三通道分层与不变量 A **不变**（SPEC-3.7 分级值未动，逐通道 ±ε + 色相恒定可原样复用）；**发光段须重写**——由「环缩放 scale（sampleMarkerRings 读 children[1]）」改为像素法验三档静态体积辉光存在性（sev3 强辉+强白核 / sev2 中辉+弱白核 / sev1 弱辉无白核，全静止无脉冲，SPEC-3.7a）；`sampleMarkerRings` helper 随 rings 删除废弃。

**新登场景（qa 编号）**
- 光柱形态：等径 r0、锥收束、径向软边、尖端软消散、世界空间随缩放；**负向**：无硬圆环/硬边轮廓（命中 M2 靶环=不达标）（SPEC-3.7a）。
- 根部足印存在性 + 足印半径档序 sev3>sev2>sev1（SPEC-3.7a）。
- 白热核护栏：sev1 无白核 / sev2 弱 / sev3 强；白核限最内小体积不吞柱身色；tint 冷暖白非纯白（SPEC-3.7a）。
- 静态新鲜度：fresh 与 24h+ 同 severity 同屏，fresh 明显更热（辉光强/有白核）、旧者柱身分类色+柱高仍可读；F 地板 0.5；F 只调辉光不调柱身/柱高/alpha；`setEvents` 之间 F 不漂移（两帧无差异）（SPEC-3.7b/3.11a）。
- LOD 三档显隐 + 聚合角距 5°/2.5°/0.8°（qa 驱 `setCameraDistance` 或相机变焦到 [3.0,6]/[2.4,3.0)/[1.8,2.4)）；代表柱=max severity（平手取最新）、hue 不平均；远档 sev1 收足印点（SPEC-3.7c）。
- reduced-motion（`setReducedMotion(true)`）：增量呼吸瞬切、稳态全静、无隐藏动画（SPEC-3.11a）。
- 质量量测（量测方法 qa 定，比照 SPEC-3.10）：最亮像素 Y≤220 无纯白 255、screen 混合、临边柱×halo 无脏白（SPEC-3.7a）。

**确认不受影响（不回退）**：M2-21（呼吸收敛过程，依 SPEC-3.11 + instanceAlpha 通道，3.1 兼容面守住即复跑）、M2-25（首批 snap 对照，同上）、M3-01（列表行镜像球面 severity，依 SPEC-3.7 分级值未动）、M2-11（结构判据按 3.2 重推为逐切片精确子节点数，非「小常数」软判据）。

**复跑确认（geometry 变更有 raycast 风险，断言本身不回退）**：M2-14（`panel-marker-linkage.spec.ts`，SPEC-7.4 列表↔标记双向 hover/选中联动，BUG-021 复验路径）——判据本身不变，但柱几何由现 SphereGeometry 改 billboard/锥后 raycast 命中行为有实变风险（见 §4.4 陷阱）；须显式复跑联动冒烟，确认真实鼠标移动经 `pick()` raycast 仍能触发 `.event-row--active`；若默认几何拾取不稳，走 §4.4 足印/根部拾取代理选项。

> **e2e 决定性提示（因 §3.5 新增 GlobeScene→setReducedMotion 接线）**：涉动画/呼吸/脉冲存在性的 e2e（M2-10 稳态两帧、M2-21 呼吸坡升、新登辉光稳态）须在 Playwright context 显式钉 `reducedMotion:'no-preference'`，避免 CI 机器 OS 偏好把标记切成瞬切令断言非确定性失败；新登 reduced-motion 场景则钉 `'reduce'`。属 qa 测试 infra，此处仅提示。

---

## 6. 实现切片（最小可闭环，供 orch 派单）

- **切片① 形态替换 + 呼吸/reduced-motion 通道延续**：光柱几何（软边等径锥/billboard）+ 柱高阶梯 + 柱身 pin 基色（`deriveSeverityColor` 不变）替换 dots；删 rings、删 `SEVERITY_PULSE_AMP`、删 tick 脉冲路径（tick 改为稳态零写入、仅推进呼吸）；`SEVERITY_BASE_SIZE`→`SEVERITY_PILLAR_HEIGHT`；新增 `setReducedMotion`。保 `createMarkerLayer`/`MarkerLayer` 全接口 + `instanceAlpha` 首子节点观测契约。**可闭环验证**：M2-10 回退重测、M2-11 结构、M2-21/M2-25 呼吸（含 reduced-motion 瞬切）。
- **切片② 静态体积辉光 + 静态新鲜度**：三段梯度 + 白热核护栏 + 根部足印（补第二 InstancedMesh）+ screen/Y≤220（SPEC-3.7a）；静态 `F`（SPEC-3.7b，只在 setEvents 固化）。**可闭环验证**：M3-03 回退重测（发光段像素法重写）、新登辉光/足印/白热核/新鲜度/reduced-motion 稳态/Y≤220 量测场景。
- **切片③ LOD + 密集区聚合**：`setCameraDistance` + 三档 θ 聚合 + 代表柱规则 + 远档 sev1 收足印（SPEC-3.7c）；GlobeScene 接线相机距。**可闭环验证**：新登 LOD 三档/聚合/代表柱场景。

> 切片①②各自即一段可独立验证的活（测试可复跑、证据可登记），建议逐片 `/closeout`；③ 依赖①②的形态与足印落地。

---

## 7. 缺口清单与实现读法裁决

**spec 未覆盖的对外行为缺口**：无。SPEC-3.7/3.7a/3.7b/3.7c/3.11/3.11a 对光柱形态、辉光、新鲜度、LOD、呼吸、reduced-motion 的对外行为已闭合；本 DP 未新造任何对外值。

**实现读法（非 spec 提案；已经 REV-021 §5 门禁确认，dev 按此实现，不再是待确认项）**：
1. **相机档切换的代表柱增减用瞬切、不走呼吸淡入淡出**——**REV-021 裁定成立**。依据：SPEC-3.11「呼吸只表达对在屏前态的**数据增量**」+ SPEC-3.11a「无相机驱动微闪」+ D27「呼吸只用于增量」；LOD 档切换是相机驱动、底层事件数据未变的显示集变更，若对档界穿越施加淡入淡出即在缩放过程中构成相机驱动的常驻动画，正面违 SPEC-3.11a，故瞬切是唯一 spec 合规读法（裁决全文见 REV-021 §5 裁决(1)）。dev 据此实现；reduced-motion 开关与此读法无关（两态下 LOD 均瞬切）。
2. **`SEVERITY_BASE_SIZE` 改名 `SEVERITY_PILLAR_HEIGHT`**——**REV-021 裁定改名**。新值 `{1:0.05,2:0.09,3:0.15}` 为 SPEC-3.7a 已 pin 柱高、非新造，改名属实现导出重命名、非对外行为；裁定理由：旧名语义已实变（「球基础尺寸」自由度→「柱高」spec pin 值），保留旧名会使导出名与实义背离（裁决全文见 REV-021 §5 裁决(2)）。`SEVERITY_BASE_SIZE` 唯一 importer 为 `tests/markers.test.ts`（M2-10 单测），qa 据此改引用即可，见 §3.2。

**遗留风险**：
- Y≤220 合成封顶在重叠区的达标依赖 LOD 聚合压低重叠（§4.2）；若 testplan 量测显示密集重叠仍越限，属实现调优（降峰/局部 clamp），非 spec 缺陷——登 dev 自查 + qa 量测迭代，必要时回本 DP 补实现提示。
- BUG-031 维持 OPEN，dev 三切片落地后由 qa 依 M2-10/M3-03 重测 + reduced-motion 稳态验证机械关单（关单人≠修复人）。
