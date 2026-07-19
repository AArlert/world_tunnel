# bugs — 缺陷台账

规则见 CLAUDE.md §4.3：登记（最小复现+现象+期望+spec 依据）→ 修复回填 → 复现命令复跑 → `make evidence BUG=<ID>` 机械关单。
状态：OPEN / FIX_READY / CLOSED / WONTFIX。复杂调试开 `doc/bugs/<BUG-ID>.md` 详情页。

| 编号 | 状态 | 疑似归属 | 摘要 | 复现 | 修复commit | 复验证据 |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-001 | CLOSED | 工具环境 | PyManager(Store) Python 跑在 MSIX 容器内，AppData 被虚拟化，python 子进程看不到 ms-playwright 浏览器，经 make→python 的 e2e 必挂（直跑 npx 则绿）。根因证据：python os.listdir(AppData/Local/ms-playwright) FileNotFound。修复：regress 层由 regress.py 改为 regress.mjs（node 无容器） | `make e2e` | v0.0.1（M0 基建提交） | doc/evidence/v0.0.1/BUG-001.log |
