# REV-021 动效批·光柱标记 dev design-prompt 交付门禁

- 日期：2026-07-22
- 审查对象：`doc/design-prompt/M3-marker-pillar.md`（arch 新交付，标记层重写实现私有约束）
- 判据出处：`doc/spec.md` SPEC-3.7/3.7a/3.7b/3.7c/3.11/3.11a/3.4/3.8/3.10/7.2/7.4/6.1/6.3；CLAUDE.md §0（arch 行为泄漏禁区）/§1（极简·外科手术·目标驱动·小步快跑）/§5.2；`doc/product-decisions.md` D27/D3/D30；`doc/design-prompt/proposal-batch2-motion.md`（REV-017 通过）
- 触发：D27 / BUG-031（OPEN）；spec 已于 v0.3.2 pin（REV-017），v0.3.3 叙事净化批未触 SPEC-3.7 家族（改 SPEC-1/2.1/5.7/5.10/§9，见修改记录 line 24），故本 DP 锚点对当前 spec 正文有效
- **结论：打回（整改后重审）**。行为泄漏专查、spec 一致性、极简、切片可验证四项全部通过；唯 §3.1 兼容面「保持不变」承诺对 M2-21 不足（缺 instanceMatrix 平移不变式，且与 §3.4 打包自由度自相矛盾），属门禁明列须核对项之失败，须整改后方可派 dev。两项读法裁决随本记录一并给出（不阻塞整改）。

---

## 1. 行为泄漏专查（CLAUDE.md §0 arch 边界，本门禁核心）——通过

逐值核对 DP §2 每个对外可见取值是否指回 spec 既定值、有无新造。结论：**无一处行为泄漏，DP §7「spec 未覆盖的对外行为缺口：无」判断正确。**

| DP 位置 | 对外值 | spec 锚点 | 核对 |
| --- | --- | --- | --- |
| §2.1 | r0=0.010R / r1=0.35·r0 / 柱高 0.05·0.09·0.15R / 尖端顶部 20% 软消散 | SPEC-3.7a 形态取值 | 逐字一致 ✓ |
| §2.1 | severity = 柱高+静态发光基线+白热核 三冗余、常驻全静止无脉冲 | SPEC-3.7（脉冲硬句已删） | 一致 ✓ |
| §2.2 | 三段色梯度（白热核→pin 基色→α 消散）、发光沿高度衰减 | SPEC-3.7a | 一致 ✓ |
| §2.2 | 足印半径 sev3/2/1 = 2.4/1.8/1.2·r0 | SPEC-3.7a | 逐字一致 ✓ |
| §2.2 | 白热核护栏：仅 sev2/3、sev3>sev2、最内 30%·r0 & 最低 12% 柱高、暖白 `#fff0e0`/冷白 `#e8f2ff`、随新鲜度冷却 | SPEC-3.7a | 逐字一致 ✓ |
| §2.2 | 发光档序 sev3>sev2>sev1 硬约束；fresh 峰值 Y210/Y150/Y105 量测参考 | SPEC-3.7a | 一致 ✓ |
| §2.3 | F(a)=0.5+0.5·exp(−a/τ)、τ=8h、地板 0.5；F 只乘辉光、不乘柱身/柱高/呼吸 alpha | SPEC-3.7b | 逐字一致 ✓ |
| §2.4 | screen 混合、Y≤220、临边×菲涅尔 halo `#4a90d9`、背面柱被遮、两半球可读 | SPEC-3.7a / 3.4 | 一致 ✓ |
| §2.5 | master emission=呼吸 alpha、走现呼吸包络不新增时间参数；首批 snap；reduced-motion 瞬切；稳态零写入两帧无差异 | SPEC-3.11 / 3.2① / 3.11a | 一致 ✓ |
| §2.6 | 相机距 d∈[1.8,6]；三档界 远≥3.0/中 2.4–3.0/近 1.8–2.4；角距 5°/2.5°/0.8°；代表柱 max severity 平手取最新、hue 不平均；每簇一根、徽章/展开另案；与 SPEC-3.2a 不同对象 | SPEC-7.2 / 3.7c | 逐字一致 ✓ |
| §2.7 | ≥200 instancing、draw call 数为小常数不随事件数增长 | SPEC-3.8 | 一致 ✓ |

补充判定：
- **§2.3「F 只在 setEvents 固化、两次之间不变」不是新造对外行为**——SPEC-3.7b line 111 明将「now 取值」采样方法交 testplan（比照 SPEC-3.10），SPEC-3.11a 又硬性要求稳态两帧无差异；「F 逐帧推进」会令辉光随时间缓漂构成常驻动画、违 SPEC-3.11a，故「setEvents 固化、帧间不变」是满足 SPEC-3.11a 的唯一实现读法，属实现私有约束而非新对外值。判定合规。
- **§4.3「被聚为非代表成员事件的 setHighlight → 高亮所在簇代表柱或 no-op」不构成行为泄漏**——SPEC-7.4 未规定聚合成员的高亮目标，此为 SPEC-3.7c 聚合与 SPEC-7.4 联动交界的欠定边界；DP 未在此钉死权威对外值，而是显式标为自由度取最小实现，恰是行为泄漏的反面。备注：若后续 aes/qa 需要确定行为，走 §7；当前自由度处理可放行。
- shader 选型（billboard/锥）、CustomBlending 公式、逐实例属性布局、聚合算法、setCameraDistance/setReducedMotion 方法签名——均实现私有、非对外可见，不需入 spec，符合 §0。

## 2. spec 一致性——通过

DP 未与任何已 pin 值冲突：柱高 0.05/0.09/0.15、角距 5°/2.5°/0.8°、档界 [1.8,6] 内、白热核护栏 30%·r0/12% 柱高、Y≤220 均与 SPEC-3.7a/3.7c 原文逐字吻合，无抄错、无语义偏移。§2.6「近档 1.8≤d<2.4」正确落在 SPEC-7.2 下限 1.8（R-1 修正后），未复现 REV-017 打回的 d<1.8 不可达问题。

## 3. 兼容面核对（DP §3）——发现门禁缺陷 G-1

### 3.1 M2-11（结构判据，现 ✅ v0.2.5）
- 现测 `tests/markers.test.ts` 三处硬断言 `layer.object.children.length === 2`。切片① children=1（仅柱）会令其 FAIL，故 M2-11 必须在切片① regress 前重推。DP §3.2 已正确标注重推为「小常数、不随事件数增长；各 InstancedMesh.count == 展示标记数」。
- 校验 §5.2 蒸发：重推后 SPEC-3.8「instancing 不逐事件建 Mesh」仍被「小常数不随事件数增长」覆盖，无子句蒸发。**通过**。
- qa 重推提示（非阻塞，登记给 qa）：「小常数」偏软，应改为**逐切片钉精确子节点数**（切片①=1 柱；切片②/③=2 柱+足印）+「不随事件数增长」+「各 count==展示标记数」，以免把原 `==2` 的强度稀释成模糊常数（守 §5.2 判据不向实现看齐）。

### 3.2 M2-25（首批 snap 单测，现 ✅ v0.2.16）
- `tests/marker-initial-snap.test.ts` 经 `getDotsAlphaAttr`（找「携带 instanceAlpha 属性的子节点」，对顺序稳健）读 alpha，并按槽位序 index（新事件落 slot 1）断言。仅依赖：instanceAlpha 属性存在 + 槽位分配序。DP §3.1 承诺 instanceAlpha per-instance float 承载 → 覆盖。槽位序属实现内部、重写沿用现 free.pop/count++ 方案即稳。**风险低，通过**。

### 3.3 M2-21（呼吸收敛 e2e，现 ✅ v0.2.13）——**兼容面缺陷 G-1**
现测 `e2e/marker-breathing-transition.spec.ts` 经两个 helper 识别标记实例：
- `globeDebug.sampleMarkerInstances`（globeDebug.ts 543–554）：读 `children[0].instanceMatrix.array`，取每实例**平移分量 `mat[i*16+12/13/14]`**与 `geometry.attributes.instanceAlpha`。
- `globeDebug.injectAndRecordBreathing`（globeDebug.ts 605–629）：同样按 `children[0]` 的 **instanceMatrix 平移方向**（`normalize(tx,ty,tz)·dir`）匹配 keep/old/new 三枚标记再取其 alpha。

即 M2-21 复跑硬依赖三条不变式：(a) 承载呼吸的 mesh = `children[0]`；(b) 该 mesh 携 `instanceAlpha` per-instance float；**(c) 该 mesh 的逐实例 instanceMatrix 平移分量 = 标记根位置 `latLonToVector3(lat,lon,MARKER_R)`**（helper 靠平移方向识别是哪枚标记）。

DP §3.1 观测契约只显式担保了 (a)(b)，**遗漏 (c)**；且 DP §3.4 明写「具体属性布局/打包属自由度」、§4.1 推荐的 billboard 方案 A 是「逐实例携根位置+径向轴，vertex shader 构建面片」——此路径下根位置自然落在**自定义属性**而非 instanceMatrix，instanceMatrix 可为单位阵。届时 `sampleMarkerInstances` 读回平移全 0（`len<1e-6` → 跳过），`alphaAt` 返回 NaN，M2-21 前置断言 `alphaAt(p1,dirKeep)>0.95` 直接失败。

**结论**：DP §3.1「保住 instanceAlpha 属性 + Group 首个子节点，M2-21 无需改 helper 即可复跑」的承诺**对 M2-21 不成立**，且与 §3.4 打包自由度自相矛盾（§3.1 隐含要求 instanceMatrix 载根位置、§3.4 放开不用 instanceMatrix）。这是本门禁任务卡明列须核对的「M2-21 现测可复用」项之失败，非假绿风险（会 loud fail）但会致 dev 依残缺契约实现、切片① 收尾时返工或临时改 helper。**须整改**（详见 §6 整改①）。附：DP §3.1 把该 helper 称作 `sampleMarkerAlphas`，实际名为 `sampleMarkerInstances`——命名不实，佐证 arch 未精确追踪该 helper 的字段依赖。

### 3.4 回退重推面 M2-10 / M3-03——评估正确
- **M2-10**（`e2e/marker-category-severity.spec.ts`）：现断言脉冲（`SEVERITY_PULSE_AMP` 递增、sev3 持续脉冲环 4 帧有异）测的是**已删 spec 子句**（v0.3.2 删「sev3 必须持续脉冲环」），删除合规、不蒸发（新 SPEC-3.7 静止句由「稳态两帧无差异」承接）。DP 已正确要求改验：六类分类色不变（SPEC-3.7）+ 等径 r0 + 柱高单调（SPEC-3.7a）+ 稳态两帧无差异（SPEC-3.11a）。DP §5.2 亦正确预警：切片③ LOD 落地后默认视角 d=3.2 落远档（sev1 仅足印），柱高阶梯采样须移至中档 [2.4,3.0) —— **即 M2-10 将被触及两次**（切片①回退、切片③改采样距）；校验 §5.2：柱高阶梯于中档仍完整可读（SPEC-3.7c 中档全柱），sev1 柱高 0.05R 子句在中档可测、不蒸发。评估正确。
- **M3-03**（`e2e/marker-severity-tri-channel.spec.ts`）：色相/明度/饱和三通道分层不变量 A（SPEC-3.7 分级值未动）可原样复用；发光段现读 `sampleMarkerRings`（children[1] 环缩放），rings 删除后 helper 废弃、发光段须 qa 重写为像素法验三档静态体积辉光存在性（SPEC-3.7a）。DP 评估与 `doc/testplan.md` M3-03 行一致，重写测的是 SPEC-3.7a 新子句、不蒸发。评估正确。

### 3.5 联动 e2e（panel-marker-linkage，BUG-021 复验路径）——须补入复跑清单
`e2e/panel-marker-linkage.spec.ts` 靠真实鼠标移动到投影坐标经 `pick()` raycast 触发 `.event-row--active`，依赖光柱几何可被 raycast 命中。柱几何由球（现 SphereGeometry）改 billboard/锥后 raycast 行为有实变风险。DP §4.4 已标注该陷阱并要求「复跑联动冒烟」+ 提供足印/根部拾取代理选项——**处理充分**；唯 §5.2「建议 qa 覆盖检查点」的回退/确认清单未显式列 panel-marker-linkage 复跑（仅落在 §4.4 陷阱段）。登记为 qa 完整性提示（非阻塞）。

## 4. 极简与切片可验证性（CLAUDE.md §1）——通过

- **极简**：§1「不做」显式排除簇内展开/计数徽章（L1 另案）、flight 图层特化、未来风格包/未来动效抽象；§4.2 明拒为 Y≤220 单加全屏后处理 pass（判为过度设计），改以 screen 边际递减+LOD 聚合压重叠密度，越限再评估——符合「资深工程师不会说过度设计」。§4.1 A/B 选型为自由度，未强加多余抽象层。**通过**。
- **切片可验证**：§6 三切片各具独立验证边界——① 形态+呼吸（M2-10 回退/M2-11 结构/M2-21·M2-25 呼吸）；② 静态辉光+新鲜度（M3-03 回退+新登辉光/足印/白热核/新鲜度/Y≤220 稳态）；③ LOD+聚合（新登三档/聚合/代表柱）。①② 各自可闭环 `/closeout`、③ 依赖①②形态与足印，切分合理。**通过**。

## 5. 两项读法裁决（DP §7）

### 裁决（1）：相机 LOD 档切换的代表柱增减用瞬切、不走呼吸——**成立（确认）**
依据链：
- **SPEC-3.11**：呼吸式过渡「以『已有在屏状态』为前态、只表达对该前态的增量（旧标记离场、新标记登场）」——增量特指 setEvents 数据 diff。
- **D27**（product-decisions.md line 94）：呼吸只用于增量，明确列举为 ①冷启动→首轮刷新 ②运行中对过时/新增更新——**两者皆数据变化，相机移动不在其列**。
- **SPEC-3.11a**：稳态「无相机驱动微闪」+「除该一次增量呼吸外，全系统不得存在任何常驻动画」。

LOD 档切换是**相机驱动、底层事件数据未变**的显示集变更，既非 SPEC-3.11/D27 定义的数据增量，若对每次档界穿越施加淡入淡出，则在缩放过程中构成相机驱动的连续动画，**正面违反 SPEC-3.11a**。故瞬切（直接落展示集）不仅被允许，且是唯一 spec 合规读法；相反读法（LOD 显隐走呼吸）应予否决。裁定 DP 读法（1）**成立**，dev 据此实现，reduced-motion 开关无关（两态下 LOD 均瞬切）。无子句蒸发（无 spec 要求 LOD 过渡动画）。

### 裁决（2）：`SEVERITY_BASE_SIZE` → `SEVERITY_PILLAR_HEIGHT` 改名——**裁定改名**
- 行为泄漏核验：新值 `{1:0.05,2:0.09,3:0.15}` 为 SPEC-3.7a 已 pin 柱高、非新造；改名属实现导出重命名、非对外行为，合规。
- 改动面核实：`SEVERITY_BASE_SIZE` 仅被 `src/globe/markers.ts`（定义）与 `tests/markers.test.ts`（M2-10 单测）引用，无其他 importer；改名成本 = 一处测试 import/引用，微小。
- 裁定**改名**为 `SEVERITY_PILLAR_HEIGHT`，理由：语义已实变（旧「球基础尺寸」自由度 → 新「柱高」spec pin 值），保留旧名会使导出名与实义背离、误导后续维护（CLAUDE.md §1.3 改动可追溯/清晰）；改名使导出的 SPEC-3.7a 锚点显式，且成本仅一测试文件。qa 据此在 M2-10 单测改引用，并可从 SPEC-3.7a 断精确值或严格递增（二者皆 spec 派生，非照抄实现）。
- 附：同处 `SEVERITY_PULSE_AMP` 删除合规（脉冲语义已于 SPEC-3.7 删），M2-10 单测同步删「PULSE_AMP 递增」断言，无蒸发。

## 6. 判定与整改清单

**判定：打回**。DP 90% 稳固（行为泄漏零、spec 一致、极简、切片可验证均过），唯兼容面缺陷 G-1 命中门禁明列须核对项，须整改。整改面窄、重审快。

**整改①（阻塞，必办）**：消除 §3.1 与 §3.4 关于 M2-21 instanceMatrix 依赖的自相矛盾，二选一并使 §3.1/§3.4 自洽——
- 方案 A（推荐，改动最小、保「复跑」承诺）：在 §3.1 观测契约补一条不变式——「承载呼吸的光柱 InstancedMesh 的**逐实例 instanceMatrix 平移分量必须等于标记根位置 `latLonToVector3(lat,lon,MARKER_R)`**（即矩阵元素 [12][13][14]）；e2e helper `sampleMarkerInstances`/`injectAndRecordBreathing` 按 instanceMatrix 平移方向识别标记实例，此不变式是 M2-21 无需改 helper 复跑的前提」，并相应收窄 §3.4「打包自由度」（根位置须进 instanceMatrix 平移，不得仅存自定义属性）。
- 方案 B（若 dev 坚持 billboard 用自定义属性存根位置）：把 M2-21 的 `sampleMarkerInstances`/`injectAndRecordBreathing` 从 §3.1「保持不变」移入 §3.2「必须变更（qa 处理）」，注明「实例识别改为读自定义根位置属性、不再读 instanceMatrix 平移」，据实收回「M2-21 无需改 helper」承诺。
- 附带订正：§3.1 helper 名 `sampleMarkerAlphas` → 实名 `sampleMarkerInstances`（并列 `injectAndRecordBreathing`）。

**整改②（非阻塞，宜纳入）**：§3.2 M2-11 重推文本由「小常数」细化为「逐切片钉精确子节点数（切片①=1、切片②/③=2）+ 不随事件数增长 + 各 InstancedMesh.count==展示标记数」，守 §5.2 不软化。

**整改③（非阻塞，宜纳入）**：§5.2 建议 qa 覆盖清单显式加列「panel-marker-linkage 联动冒烟复跑」（柱几何改 billboard/锥后 raycast 行为实变，现仅 §4.4 陷阱段提及）。

**整改④（非阻塞，可选）**：§2.7「单 InstancedMesh 一次 draw call 承载全部展示标记」措辞与 §3.2/§4.1 的二 mesh 结构（柱+足印）字面不符，宜改为「标记走 instancing（每 mesh 一次 draw call 承载其全部实例），draw call 数为小常数、不逐事件建 Mesh」以免歧义。

两项读法裁决（§5）已定，orch/arch 整改时一并纳入（裁决（1）成立、裁决（2）改名）。整改①落定后重审仅核该项与四附带订正即可放行。

## 7. 发现问题登记

- **G-1（本记录 §3.3，须 arch 整改①）**：DP §3.1 兼容面「保持不变」承诺对 M2-21 不足——遗漏「光柱 instanceMatrix 平移=根位置」不变式，且与 §3.4 打包自由度矛盾；不整改则 dev 依残缺契约实现、M2-21 切片①收尾失败返工。非 src 缺陷、无需登 bugs.md，随 DP 整改重审闭环。
- 给 qa 的重推提示（整改②③）：M2-11 逐切片钉精确子节点数、panel-marker-linkage 纳入复跑清单——待 DP 通过后由 orch 随动效批 qa 派单落实。
- 无 src/tests 代码缺陷发现；BUG-031 维持 OPEN，按 DP §7 与 BUG-031 条目由 dev 三切片落地后 qa 机械关单（关单人≠修复人）。

---

## 附录：整改重审（2026-07-22）

- 触发：本记录 §6 判「打回（整改后重审）」，口径明列「整改①落定后重审仅核该项与四附带订正即可放行」。
- 重审对象：arch 按本记录整改后的 `doc/design-prompt/M3-marker-pillar.md`。
- 核对方式：自行 Read/Grep `e2e/globeDebug.ts`、`src/globe/markers.ts`、`doc/testplan.md` 真实代码，不采信任何转述。

### A. 必核（阻塞项整改①）——通过

**A-1 §3.1 (c) 不变式已补，且与真实读法一致。** DP §3.1（line 88–93）观测契约由二条扩为三条，新增 (c)「承载呼吸的光柱 InstancedMesh 逐实例 instanceMatrix 平移分量必须等于标记根位置 `latLonToVector3(lat,lon,MARKER_R)`（矩阵元素 `[12][13][14]`）」。逐条比对 `e2e/globeDebug.ts` 真实代码：
- `sampleMarkerInstances`（526–557）：定位 `markerGroup.children[0]`（=(a)），读 `geometry.attributes.instanceAlpha.array`（=(b)），读 `mat[i*16+12/13/14]` 作 tx/ty/tz（=(c)）——三条依赖全部命中。
- `injectAndRecordBreathing.alphaAt`（605–630）：同取 `group.children[0]`（=(a)）、`instanceAlpha`（=(b)）；关键处 `len=Math.hypot(tx,ty,tz); if(len<1e-6) continue; dot=(tx·dx+ty·dy+tz·dz)/len` 靠 instanceMatrix 平移**方向**识别标记，初值 `bestAlpha=Number.NaN`（=(c) 且 DP 所述失败机理属实：instanceMatrix 退化为单位阵 → 全 `continue` → 返回 NaN → M2-21 断言失败）。
- DP §3.1 对失败机理的陈述（「读回平移全 0…因 `len<1e-6` 跳过全部实例返回 NaN」）与代码逐字吻合，非臆测。
- 引用符号真实存在且不变式描述的是现存行为：`src/globe/markers.ts` line 3 `import { latLonToVector3 }`、line 56 `MARKER_R=1.02`、line 386 `latLonToVector3(e.lat,e.lon,MARKER_R)` 写入槽位并经 shader（line 73）`instanceMatrix*vec4(position,1.0)` 落地——现 dots 即把根位置写进 instanceMatrix 平移，故 (c) 是「保住现有可复跑性」的约束、可满足，非新造。**通过**。

**A-2 §3.4 打包自由度已相应收窄，与 §3.1 无残留矛盾。** DP §3.4（line 113–116）新增「打包自由度的边界（承 §3.1 不变式 (c)，收窄）」：明写「根部位置**必须**写入 instanceMatrix 平移分量 `[12][13][14]`，不得只存自定义属性、令 instanceMatrix 退化为单位阵」，billboard 下仅径向轴/朝向/柱高可另走自定义属性。该表述与 §3.1 (c) 一致，消除本记录 §3.3 指出的「§3.1 隐含要求 vs §3.4 放开」自相矛盾。旁证无新矛盾：§4.1（line 128/131）billboard 提示只言「逐实例携根位置+径向轴」「柱为 children[0]」，未主张单位阵或根位置入自定义属性；与 §3.1/§3.4 自洽。**通过**。

**A-3 helper 误称已订正。** Grep `sampleMarkerAlphas` 于 DP 命中数 = 0；§3.1 line 91 现为 `globeDebug.sampleMarkerInstances`/`injectAndRecordBreathing`（实名，并列两个 helper），与本记录 §6 附带订正一致。**通过**。

### B. 抽查（非阻塞②③④ + 裁决对齐）——均已落实，无新增对外取值/pin 冲突

- **整改②（M2-11 逐切片精确子节点数）**：DP §3.2（line 102）由「小常数」细化为「逐切片钉精确子节点数（切片①=1；切片②/③=2）+ 不随事件数增长 + 各 InstancedMesh.count==展示标记数」，守 §5.2 判据不软化。§2.7（line 65–66）、§5.2「确认不受影响」段（line 174）措辞同步。落实。
- **整改③（§5.2 M2-14 复跑登记）**：DP §5.2 新增「复跑确认」段（line 176），显式列 M2-14（`panel-marker-linkage.spec.ts`，SPEC-7.4），要求柱几何改 billboard/锥后复跑联动冒烟、拾取不稳走 §4.4 代理选项——不再仅落 §4.4 陷阱段。testplan line 38 核实 M2-14 确为 panel-marker-linkage，编号无误。落实。
- **整改④（§2.7 二 mesh 措辞）**：DP §2.7（line 66）改为「每个 InstancedMesh 一次 draw call 承载其全部展示实例（现为柱+足印二 mesh 结构，见 §3.2/§4.1），draw call 数为小常数」，去除原「单 InstancedMesh 承载全部展示标记」与二 mesh 结构字面冲突的措辞。落实。
- **裁决对齐（两项读法）**：DP §7（line 196–198）由「待确认项」改为确定性陈述——「已经 REV-021 §5 门禁确认，dev 按此实现，不再是待确认项」，(1) LOD 瞬切「REV-021 裁定成立」、(2) 常量「REV-021 裁定改名 `SEVERITY_PILLAR_HEIGHT`」，均引本记录 §5；§4.3（line 142）亦同步为「已经 REV-021 §5 裁定成立」。与本记录 §5 裁决一致。落实。
- **新对外取值 / spec pin 冲突核查**：整改仅触 §3.1/§3.4（instanceMatrix 打包，实现私有）、§3.2（子节点数，结构）、§2.7（draw call 措辞）、§7/§4.3（裁决状态）。无一处引入 spec 之外对外可见取值：`MARKER_R`/instanceMatrix 元素索引均为实现私有约束（非 SPEC-3.7a 形态取值）；`SEVERITY_PILLAR_HEIGHT{0.05,0.09,0.15}` 为 SPEC-3.7a 已 pin 柱高（本记录 §1/§5 已核）。SPEC-3.7a/3.7c/3.11/3.11a 的 pin 值未被触碰、无抄改。无行为泄漏、无 pin 冲突。

### 判定：放行

阻塞项整改①（A-1/A-2/A-3）三点全部落定且与 `e2e/globeDebug.ts` 真实读法逐条吻合；四附带订正与两项读法裁决均已按本记录 §5/§6 落为确定性陈述；抽查未发现新增对外取值或 spec pin 冲突。本 DP 兼容面缺陷 G-1 已闭合，行为泄漏零、spec 一致、极简、切片可验证四项在本记录 §1–§4 已通过且整改未触动。**门禁放行，orch 可据此 DP 派 dev 落地三切片。** G-1 随本重审闭环，无遗留阻塞项；本记录 §7 给 qa 的重推提示（整改②③已入 DP，待 DP 派单时随动效批 qa 落实）维持有效。

—— REV，2026-07-22
