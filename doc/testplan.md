# testplan — 场景真值表

状态位：🔲 计划 / ⚠️ 部分 / ❌ 失败（须挂 BUG 编号）/ ✅ 通过（仅 evidence.py 可置）。
**先登记后写码**；「证据」「复跑」两列为脚本专属，人和 agent 不手填。
场景描述要写成「激励 + 必须成立的判据」，引用 spec 条目编号（SPEC-x.y）。

| 编号 | 里程碑 | 场景描述 | 状态 | 证据 | 复跑 |
| --- | --- | --- | --- | --- | --- |
| M0-01 | M0 | 单测链路：geo.latLonToVector3 对北极/赤道本初子午线/东经90°三个已知点输出正确坐标（SPEC-6.2 约定），证明 vitest→log→evidence 链路可用 | ✅ | doc/evidence/v0.0.1/M0-01.log | `make test` |
| M0-02 | M0 | e2e 链路：dev server 启动后页面标题含 World Tunnel，canvas 出现且尺寸非零，无 pageerror；截图入证据 | ✅ | doc/evidence/v0.0.1/M0-02.log | `make e2e` |
| M0-03 | M0 | 质量门禁链路：eslint 0 警告 + tsc --noEmit 0 错误 | ✅ | doc/evidence/v0.0.1/M0-03.log | `make lint` |
