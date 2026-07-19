# testplan — 场景真值表

状态位：🔲 计划 / ⚠️ 部分 / ❌ 失败（须挂 BUG 编号）/ ✅ 通过（仅 evidence.py 可置）。
**先登记后写码**；「证据」「复跑」两列为脚本专属，人和 agent 不手填。
场景描述要写成「激励 + 必须成立的判据」，引用 spec 条目编号（SPEC-x.y）。

| 编号 | 里程碑 | 场景描述 | 状态 | 证据 | 复跑 |
| --- | --- | --- | --- | --- | --- |
| M0-01 | M0 | 单测链路：geo.latLonToVector3 对北极/赤道本初子午线/东经90°三个已知点输出正确坐标（SPEC-6.2 约定），证明 vitest→log→evidence 链路可用 | ✅ | doc/evidence/v0.0.1/M0-01.log | `make test` |
| M0-02 | M0 | e2e 链路：dev server 启动后页面标题含 World Tunnel，canvas 出现且尺寸非零，无 pageerror；截图入证据 | ✅ | doc/evidence/v0.0.1/M0-02.log | `make e2e` |
| M0-03 | M0 | 质量门禁链路：eslint 0 警告 + tsc --noEmit 0 错误 | ✅ | doc/evidence/v0.1.0/M0-03.log | `make lint` |
| M1-01 | M1 | 天文-太阳赤纬锚点（单测）：年积日 N 按 SPEC-4.1「1 月 1 日 N=1，按 UTC 日期计，闰年 2 月 29 日顺次计入」取值，代入公式计算春分(3-20)/夏至(6-21)/冬至(12-21)对应的太阳赤纬 δ，输出应分别 ≈0°/+23.44°/−23.44°（容差 ±1°，SPEC-4.4） | ✅ | doc/evidence/v0.1.0/M1-01.log | `make test TEST=solar` |
| M1-02 | M1 | 天文-均时差幅度与正午经度（单测）：年积日 N 取 SPEC-4.1 定义（SPEC-4.2 同一起点），按 SPEC-4.2 计算全年均时差 EoT，其绝对值幅度 ≤17 分钟；取 EoT≈0 的日期（如 4-15 前后）在 UTC 正午（h_UTC=12）代入 SPEC-4.3 经度公式，太阳直下点经度 ≈0°（容差 ±1°，SPEC-4.4） | ✅ | doc/evidence/v0.1.0/M1-02.log | `make test TEST=solar` |
| M1-03 | M1 | 天文-经度归一化、sunDir 坐标约定与更新频率（单测）：SPEC-4.3 经度结果归一化落在 (−180°, 180°] 区间（含跨 ±180° 边界用例）；由直下点 (lat, lon) 按 SPEC-4.5 生成的 sunDir 为单位向量，且分量遵循 SPEC-6.2 坐标约定（北极 (90,·)→+Y，(0,0)→+Z，(0,90°E)→+X，与 geo.latLonToVector3 同一约定）；注入两个相差 >1 分钟的时刻，uSunDir 必须发生变化（SPEC-4.5「每帧按当前时刻更新，可降频至 1 次/分钟」的更新频率下限校验） | ✅ | doc/evidence/v0.1.0/M1-03.log | `make test TEST=sun` |
| M1-04 | M1 | 地球几何与相机初始参数（单测）：SphereGeometry 分段 ≥64、球半径 1.0；相机 fov=45°、初始距离 3.2（SPEC-3.1） | ✅ | doc/evidence/v0.1.0/M1-04.log | `make e2e TEST=globe-init` |
| M1-05 | M1 | 昼夜混合与晨昏线校准（视觉，需附截图）：自定义 shader 按 `t=dot(N,sunDir)` 混合昼/夜纹理，晨昏线在 t∈[-0.1,+0.1] 区间呈现 smoothstep 软过渡带（SPEC-3.2）；给定已知 sunDir，格林尼治 (lat 0, lon 0) 标记点须落在昼纹理非洲西侧几内亚湾位置（SPEC-3.6） | ✅ | doc/evidence/v0.1.0/M1-05.log | `make e2e TEST=day-night-calibration` |
| M1-06 | M1 | 夜景灯光增益下限（单测）：shader uniform `uNightGain` 默认值 ≥1.5（SPEC-3.3「亮度增益 ≥1.5」的机械化断言）。昼半球不叠加灯光的判据见 M1-14 | ✅ | doc/evidence/v0.1.0/M1-06.log | `make test TEST=earth-night-gain` |
| M1-07 | M1 | 大气菲涅尔辉光（视觉截图 + 单测）：球缘可见主色 `#4a90d9` 的菲涅尔边缘辉光，由球缘向外衰减（SPEC-3.4，截图判据）；「不遮挡标记」经机械代理断言——大气材质满足 `AdditiveBlending` + `depthWrite=false` + `transparent`（SPEC-3.4 推论；M1 无标记层，不可直接验证标记不被遮挡，该项验证顺延至 M2 标记层场景） | ✅ | doc/evidence/v0.1.0/M1-07.log | `make e2e TEST=atmosphere-glow` |
| M1-08 | M1 | 星空背景（单测+视觉，需附截图）：程序化点星 ≥1500 颗分布于半径 ≥40 球壳（单测校验数量与分布半径）；相机旋转时星空随相机运动、地球自转时星空图案不随之旋转（e2e 对比两组截图验证，SPEC-3.5） | ✅ | doc/evidence/v0.1.0/M1-08.log | `make e2e TEST=starfield` |
| M1-09 | M1 | 拖拽旋转与惯性衰减（e2e）：拖拽作用于**相机**（绕球心的方位角/仰角，地球本体不因拖拽转动，SPEC-7.1）——水平方位角绕 Y 轴无限制（可累计超 360°），垂直仰角被限制在纬度 ±85° 以内不可拖出；释放拖拽后相机方位角/仰角速度按阻尼系数 ≈0.95/帧（以 60fps 为基准，SPEC-7.5）衰减，逐帧减速趋于停止（SPEC-7.1） | ✅ | doc/evidence/v0.1.0/M1-09.log | `make e2e TEST=drag-inertia` |
| M1-10 | M1 | 缩放范围限制（e2e）：滚轮/双指缩放使相机距离被限制在 [1.8, 6] 区间内，向内/向外超界输入均不能突破该范围（SPEC-7.2） | ✅ | doc/evidence/v0.1.0/M1-10.log | `make e2e TEST=zoom-range` |
| M1-11 | M1 | 空闲自转与输入打断（e2e）：无任何输入持续 10s 后地球本体开始约 0.02°/帧（以 60fps 为基准，SPEC-7.5）的缓慢自转，作用于地球本体绕 +Y 轴，相机与星空不动（SPEC-7.3）；自转期间任意拖拽/滚轮输入须立即使自转停止（SPEC-7.3） | ✅ | doc/evidence/v0.1.0/M1-11.log | `make e2e TEST=idle-spin` |
| M1-12 | M1 | 几何 uv 与 SPEC-6.2 坐标一致性（单测）：`createEarthGeometry()` 生成几何体上，uv≈(0.5,0.5) 处顶点位置 ≈ `latLonToVector3(0,0)`；uv≈(0.75,0.5) 处顶点 ≈ `latLonToVector3(0,90)`；uv.y=1 处顶点为 +Y 北极——证明纹理 u 方向向东递增且无南北翻转（SPEC-3.6 + SPEC-6.2） | ✅ | doc/evidence/v0.1.0/M1-12.log | `make test TEST=earth-geometry` |
| M1-14 | M1 | 昼半球不叠加夜景灯光（e2e，真实 WebGL 渲染）：取样点不可写死——须由当前 `uSunDir` 反算，或先转 `earthGroup.rotation.y` 把昼区转进视野，以避免直下点扫经导致可见半球全为夜侧的偶发红；在昼半球内部（t = dot(N, sunDir) 明显大于 SPEC-3.2 过渡带上界 +0.1）取样点的最终颜色不随 `uNightGain` 变化，而夜半球取样点随之变化——证明灯光项在纯昼端点的混合权重为 0、昼夜为混合而非叠加（SPEC-3.3 第二句 + SPEC-3.2 混合定义）。禁止断言 shader 源码字符串、禁止移植 GLSL 混合公式再对该移植断言（同义反复） | ✅ | doc/evidence/v0.1.0/M1-14.log | `make e2e TEST=day-side-no-lights` |
