# BUG-028 / BUG-033 独立复验核对记录

依 CLAUDE.md §5.3 第 4 条口径出具（scripts 工具链缺陷，无 vitest 自动化覆盖，工具侧限制见 BUG-015）。
本记录由独立 qa 实例出具，**未复用 dev 交付卡（FIX_READY 回填段）里的 scratch 产物**，全部验证独立重做。

## 核对对象

- **BUG-028**：`scripts/docs.py` `next_action()` 新增的 `fm_missing` 检查——里程碑场景全 ✅ 分支内，
  先核对该里程碑全部 feature-matrix 行是否都已登记至少一条 testplan 场景，不满足则列出缺卡行、不提示签核。
- **BUG-033**：`scripts/evidence.py` `scenario_needs_shot()` 改为分句 + 交叉引用检测——按标点切分场景描述为分句，
  分句内同时含视觉/截图字样与「非本场景编号」的场景编号引用时判定为交叉引用、不触发守卫，否则判定为自声明、触发守卫。
- 修复 commit：`d6054d0`（`fix: scripts 修复窗——BUG-028 签核 FM 零场景盲区+BUG-033 视觉守卫误判双修(v0.2.22)`），
  已提交入库，工作树在本次复验前后均为 clean（`git status --porcelain` 无输出）。

## 环境与方法说明

- 复验涉及构造 `doc/`、`version.json`、`test-results/` 的独立副本，全部放在 qa 专属 scratch 子目录：
  `.../scratchpad/qa-bug028/`、`.../scratchpad/qa-bug033/`（与 dev 卡的 `bug028-check/`、`bug033-check/` 目录完全分开，未读取、未复用）。
- 对副本的读写通过 `sys.path.insert` 引入 `scripts/docs.py` / `scripts/evidence.py` 模块后，
  monkeypatch 模块级 `ROOT`/`DOC`（对 evidence.py 另 patch `OUT`）指向 scratch 路径，再调用模块函数/`main()`——
  不改动、不触碰任何真实 `doc/` 文件或 `test-results/` 文件。
- BUG-033 check② 的 CLI 正向用例（M2-13）因 `write_record()` 需要一份带 `[regress] RESULT: PASS` 尾行的 log 才能通过
  `load_log()`，构造了一份**仅供本次 CLI 分支验证用**的合成 log（`test-results/fake_event-panel.log`，文件头已注明用途），
  不作为任何场景的正式证据，未写入真实 `test-results/` 或 `doc/evidence/`。
- 负向用例（M2-15/M3-01）因 `scenario_needs_shot` 检查发生在 `load_log()` 之前，SystemExit 会先于日志加载触发，
  故未构造 log 文件即可验证该分支。

## 逐条结论

### 1. BUG-028 正反两向

**① 真实台账跑 `python scripts/docs.py --next`**

```
$ python scripts/docs.py --next
[next] 里程碑 M2：
  1. 里程碑 M2 三条判据齐备 → make bump 填 closeout → docs-check → commit → tag v0.2.22 → push → 下一里程碑 bump --milestone M3
```

M2 全部 FM 行（FM-05~FM-11）场景列均非空（核对 `doc/feature-matrix.md` 第 13-19 行），输出无「缺卡」提示。
**结论：PASS。**

**② scratch 构造 FM 行零场景验证输出列出缺卡行、不出现签核/齐备提示**

- 独立构造 `doc/` 副本（`scratchpad/qa-bug028/doc/`），将 `feature-matrix.md` 副本第 19 行 FM-11 场景列由
  `M2-23, M2-24` 清空为占位 `（M2 开卡登记）`（其余行不动）。
- monkeypatch `docs.ROOT`/`docs.DOC` 指向该副本后调用 `next_action()`：

```
[next] 里程碑 M2：
  1. 以下 feature-matrix 行零场景，未开卡登记（先登记 testplan 场景，不提示签核）: FM-11
```

输出明确列出缺卡行 `FM-11`，且未出现「三条判据齐备」/「跑 /code-review 签核」/「归档回归证据」任一提示。
真实 `doc/feature-matrix.md`、`doc/testplan.md` 全程未被写入（副本操作，`git status --porcelain` 复验期间及事后均为空）。
**结论：PASS。**

### 2. BUG-033 正反两向

**① 对真实 `doc/testplan.md` 逐场景调用 `scenario_needs_shot`（只读，未修改文件）**

| 场景 | 结果 | 期望 | 判定 |
| --- | --- | --- | --- |
| M0-02 | True | True（真实视觉场景） | 一致 |
| M1-05 | True | True | 一致 |
| M1-07 | True | True | 一致 |
| M1-08 | True | True | 一致 |
| M2-10 | True | True | 一致 |
| **M2-13** | **False** | **False（误判已消除，行文含指向 M3-01/M3-03 的交叉引用）** | **一致** |
| M2-15 | True | True | 一致 |
| M2-21 | True | True | 一致 |
| M3-01 | True | True | 一致 |
| M3-02 | True | True | 一致 |
| M3-03 | True | True | 一致 |
| M3-04 | True | True | 一致 |
| M3-05 | True | True | 一致 |
| M3-06 | True | True | 一致 |
| M2-01 | False | False（非视觉场景） | 一致 |
| M2-25 | False | False（非视觉场景） | 一致 |

补充：对 `doc/testplan.md` 中 M0/M1/M2/M3 全部 47 个场景编号做了穷举扫描（非仅上表 16 个），
结果为：除上表列出的 14 个真实视觉场景为 True、其余 33 个场景（含 M2-01/M2-25 在内）均为 False，
无遗漏的意外 True/False 翻转。**结论：PASS。**

**② 副本 + monkeypatch 跑 CLI 全流程**

独立构造 `doc/testplan.md` 副本（`scratchpad/qa-bug033/doc/testplan.md`，真实文件原样拷贝、未篡改）与
`version.json`；monkeypatch `evidence.ROOT`/`evidence.DOC`/`evidence.OUT` 后依次调用 `evidence.main()`：

```
==================== M2-13 无 --shot ====================
[evidence] M2-13 → ✅  证据: doc\evidence\v0.2.22\M2-13.log
[RESULT] 正常返回（未触发 SystemExit）

==================== M2-15 无 --shot ====================
[RESULT] SystemExit: 'M2-15 场景描述声明了截图/视觉判据（含"截图"或"视觉"字样），未传 --shot 不能置 ✅（BUG-008）'

==================== M3-01 无 --shot ====================
[RESULT] SystemExit: 'M3-01 场景描述声明了截图/视觉判据（含"截图"或"视觉"字样），未传 --shot 不能置 ✅（BUG-008）'
```

- M2-13 不传 `--shot`：正常写入证据、副本 `testplan.md` 对应行回填为 ✅（核对副本第 37 行，证据路径/复跑命令列均已回填），未触发 SystemExit。
- M2-15、M3-01 不传 `--shot`：均被显式 `SystemExit` 拒收，报错信息含场景编号与 BUG-008 引用。
- 全程操作限定在 scratch 副本；复验前后 `git status --porcelain` 均无输出，真实 `doc/testplan.md`、`doc/evidence/` 未被写入或污染。

**结论：PASS。**

### 3. 判别力抽查（确认修复确有实质影响，非巧合通过）

- 记录修复后 `scripts/evidence.py` 的 SHA256：`e9b70ce42529d96357551b24a3ac8c4c6fb0b2c149f6715df5896973a2e0c775`。
- `git checkout cfeeb8b -- scripts/evidence.py`（`cfeeb8b` = 修复 commit `d6054d0` 的父提交，即修复前版本）临时还原该文件
  ——工作树在还原前已是 clean（修复已提交入库、无本地 diff 可 stash），故用「checkout 父提交版本」达到与「stash 修复」等价的临时还原效果。
- 还原后重跑同一份「对真实 `doc/testplan.md` 逐场景调用 `scenario_needs_shot`」脚本：`M2-13 -> True`（其余场景结果不变）
  ——确认误判在旧代码下重新出现，证明本次修复对判定结果有实质影响（非无关改动侥幸通过测试）。
- `git checkout HEAD -- scripts/evidence.py` 恢复修复版本；`git status --porcelain` 与 `git diff --stat` 均为空；
  `certutil -hashfile scripts/evidence.py SHA256` 重新算出的哈希 `e9b70ce42529d96357551b24a3ac8c4c6fb0b2c149f6715df5896973a2e0c775`
  与还原前逐字节一致。
**结论：PASS。**

### 4. 附带核查

```
$ make docs-check
python scripts/docs.py --check
[docs-check] OK
```

```
$ make handover
...
[testplan] 共 47 场景
  M0: ✅×3
  M1: ✅×13
  M2: ✅×25
  M3: ✅×5  🔲×1
[bugs] 未关闭 13 个：BUG-010, BUG-011, BUG-012, BUG-013, BUG-017, BUG-016, BUG-015, BUG-028, BUG-029, BUG-031, BUG-032, BUG-033, BUG-036
```

两条命令输出均无异常/无回归。`git status --porcelain` 全程（复验开始前与结束后）均无输出，真实 `doc/testplan.md`、
`doc/feature-matrix.md`、`doc/evidence/`（本记录文件本身除外）未被污染。
**结论：PASS。**

## 遗留风险 / 未定性观察

1. dev 交付汇报中自述「未采纳 bugs.md 期望文本的字面精确匹配（整词「（视觉，需附截图）」或行尾「需附截图」），
   因会漏判 M0-02/M3-01 削弱守卫」，改用分句 + 交叉引用检测这一更宽的启发式。本次复验确认该启发式在**当前**
   台账全部场景上判定结果与预期完全一致（含全部真实视觉场景与非视觉场景），但该启发式的正确性依赖当前台账措辞
   （以中文/英文标点分句、以 `M\d+-\d+` 识别场景编号引用），后续场景描述若出现新的行文模式（如视觉判据与交叉引用
   出现在同一分句内、或场景编号引用格式变化），需要再核对，不能认为一劳永逸——此点 dev 已在代码注释中声明，非本次新发现。
2. BUG-036（`make next` 判据②③证据检查无时效约束）为 dev 在本 FIX_READY 卡交付时观察上报、orch 另行登记的独立缺陷，
   与本次 BUG-028/033 复验范围无关，不在本记录判定之列；里程碑签核前仍需按 orch 既定口径显式重跑 `make regress` +
   `make evidence REGRESS=1`，不采信「三条判据齐备」提示。
3. scripts/ 工具链目前无 vitest/机械回归覆盖，本记录本身即是该系统性风险下的补偿手段（人工核对记录），
   dev 卡内已标注为流程债、orch 暂未立项——非本次复验范围内可改变的事实，列此处备查。
4. 本次复验未覆盖 BUG-028/033 之外的、`next_action()`/`scenario_needs_shot()` 以外的其他 fm_missing 检查触发路径
   （例如同一 M 内多个 FM 行同时零场景、或 feature-matrix 行的里程碑列写法非标准 `M<n>` 格式等边界），
   现有真实台账未出现这些边界情形，故未构造对应用例；如后续该函数扩展或台账出现异常格式，建议另行补充边界用例。

## 署名

- 复验人：qa（独立实例，未复用 dev scratch 产物）
- 日期：2026-07-21
- 依据：CLAUDE.md §5.3 第 4 条（流程/规则类缺陷复验口径）
