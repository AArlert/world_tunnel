#!/usr/bin/env python3
# 文档守卫 + 记忆系统读口（iverif-workflow kernel 适配版，判定层换为本项目 App 语境）。
# 用法:
#   python scripts/docs.py --check       # 守卫：版本失步/TODO 未填/✅ 无证据/幽灵引用/spec 悄改/关单缺复验
#   python scripts/docs.py --handover    # 接手总览
#   python scripts/docs.py --next        # 机械推导下一步
#   python scripts/docs.py --pin-spec    # 重新钉住 doc/spec.md 的 sha256
#   python scripts/docs.py --archive     # log.md / status.jsonl 滚动归档
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "doc"
LOG_MAX_BLOCKS = 4
LOG_KEEP = 3
STATUS_MAX_LINES = 12
STATUS_KEEP = 8

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def read_version():
    return json.loads((ROOT / "version.json").read_text(encoding="utf-8"))


def parse_table(path, min_cols):
    """markdown 表 → 行列表（跳过表头与分隔行）。"""
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < min_cols:
            continue
        if not cells[0] or set(cells[0]) <= set("-: ") or cells[0] in ("编号",):
            continue
        rows.append(cells)
    return rows


def testplan_rows():
    return parse_table(DOC / "testplan.md", 6)


def log_blocks():
    text = (DOC / "log.md").read_text(encoding="utf-8")
    lines = text.splitlines()
    idxs = [i for i, l in enumerate(lines) if l.startswith("## [")]
    blocks = []
    for n, i in enumerate(idxs):
        end = idxs[n + 1] if n + 1 < len(idxs) else len(lines)
        blocks.append("\n".join(lines[i:end]).rstrip())
    header = "\n".join(lines[: idxs[0]]).rstrip() if idxs else text.rstrip()
    return header, blocks


def spec_sha():
    # 对行尾归一化后再哈希：.gitattributes 强制 LF，若编辑器落盘 CRLF，
    # 原始字节哈希会在 checkout/normalize 后失配，误报"悄改"
    text = (DOC / "spec.md").read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(text).hexdigest()


def check():
    errs = []
    ver = read_version()
    # 1. 版本同步
    try:
        head = json.loads(
            (DOC / "status.jsonl").read_text(encoding="utf-8").splitlines()[0])
        if head.get("version") != ver["version"]:
            errs.append("版本失步: version.json=%s, status.jsonl 首行=%s"
                        % (ver["version"], head.get("version")))
        if "TODO(" in head.get("summary", ""):
            errs.append("status.jsonl 首行 summary 有未填 TODO")
    except Exception as e:
        errs.append("status.jsonl 首行不可解析: %s" % e)
    # 2. log 首块 TODO 与块数上限
    _, blocks = log_blocks()
    if not blocks:
        errs.append("log.md 没有任何交接块")
    else:
        if "TODO(" in blocks[0]:
            errs.append("log.md 首块有未填 TODO")
        if len(blocks) > LOG_MAX_BLOCKS:
            errs.append("log.md 块数 %d 超上限 %d，先 make docs-archive"
                        % (len(blocks), LOG_MAX_BLOCKS))
    # 3. spec pin
    if (DOC / "spec.md").exists():
        pin = DOC / "spec.sha256"
        if not pin.exists():
            errs.append("spec.md 存在但未钉住，make pin-spec")
        elif pin.read_text(encoding="utf-8").strip() != spec_sha():
            errs.append("spec.md 被修改但未重钉（悄改拦截）：确认修改记录已加条目后 make pin-spec")
    # 4. testplan：✅ 须有合规证据；❌ 须挂 BUG
    ids = set()
    for r in testplan_rows():
        rid, status, evid = r[0], r[3], r[4]
        ids.add(rid)
        if status == "✅":
            p = ROOT / evid
            if evid in ("-", "") or not p.exists():
                errs.append("%s 为 ✅ 但证据文件缺失: %s" % (rid, evid))
            else:
                first = p.read_text(encoding="utf-8").splitlines()[0]
                if not first.startswith("make "):
                    errs.append("%s 证据首行不是可复跑 make 命令: %r" % (rid, first))
        if status == "❌" and "BUG-" not in " ".join(r):
            errs.append("%s 为 ❌ 但未挂 BUG 编号" % rid)
    # 5. feature-matrix 幽灵引用
    for r in parse_table(DOC / "feature-matrix.md", 5):
        for ref in re.findall(r"M\d+-\d+", r[4]):
            if ref not in ids:
                errs.append("feature-matrix %s 引用了不存在的场景 %s" % (r[0], ref))
    # 6. bugs：CLOSED 须有修复 commit 与复验证据
    for r in parse_table(DOC / "bugs.md", 7):
        if r[1] == "CLOSED" and ("-" in (r[5], r[6]) or not r[5] or not r[6]):
            errs.append("%s 状态 CLOSED 但缺修复commit/复验证据" % r[0])
    if errs:
        for e in errs:
            print("[docs-check] FAIL:", e)
        sys.exit(1)
    print("[docs-check] OK")


def handover():
    ver = read_version()
    print("=" * 60)
    print("world_tunnel  v%s  里程碑 %s" % (ver["version"], ver["milestone"]))
    print("=" * 60)
    head = (DOC / "status.jsonl").read_text(encoding="utf-8").splitlines()[0]
    print("[status]", head)
    _, blocks = log_blocks()
    if blocks:
        print("\n[最近交接块]\n" + blocks[0])
    rows = testplan_rows()
    from collections import Counter
    c = Counter((r[1], r[3]) for r in rows)
    ms = sorted({r[1] for r in rows})
    print("\n[testplan] 共 %d 场景" % len(rows))
    for m in ms:
        parts = ["%s×%d" % (s, c[(m, s)])
                 for s in ("✅", "⚠️", "❌", "🔲") if c[(m, s)]]
        print("  %s: %s" % (m, "  ".join(parts)))
    bugs = [r for r in parse_table(DOC / "bugs.md", 7)
            if r[1] in ("OPEN", "FIX_READY")]
    print("[bugs] 未关闭 %d 个" % len(bugs)
          + ("：" + ", ".join(r[0] for r in bugs) if bugs else ""))
    print("\n下一步用: make next")


def next_action():
    ver = read_version()
    m = int(ver["milestone"].lstrip("M"))
    rows = [r for r in testplan_rows() if r[1] == ver["milestone"]]
    actions = []
    bad = [r for r in rows if r[3] == "❌"]
    todo = [r for r in rows if r[3] in ("🔲", "⚠️")]
    if bad:
        actions.append("先走缺陷闭环（❌ 场景）: " + ", ".join(r[0] for r in bad))
    if todo:
        actions.append("待实现场景: " + ", ".join(
            "%s(%s)" % (r[0], r[3]) for r in todo))
    if not bad and not todo and rows:
        evdirs = sorted((DOC / "evidence").glob("v0.%d.*" % m))
        if not any((d / "regress_summary.txt").exists() for d in evdirs):
            actions.append("场景全 ✅ → make regress 后 make evidence REGRESS=1 归档回归证据")
        elif not any(list(d.glob("signoff-M%d*.md" % m)) for d in evdirs):
            actions.append("回归证据已归档 → 跑 /code-review 签核，记录存 doc/evidence/v%s/signoff-M%d.md 与 doc/review/" % (ver["version"], m))
        else:
            actions.append("里程碑 M%d 三条判据齐备 → make bump 填 closeout → docs-check → commit → tag v%s → push → 下一里程碑 bump --milestone M%d"
                           % (m, ver["version"], m + 1))
    status_head = (DOC / "status.jsonl").read_text(
        encoding="utf-8").splitlines()[0]
    _, blocks = log_blocks()
    if "TODO(" in status_head or (blocks and "TODO(" in blocks[0]):
        actions.append("closeout 待填：status.jsonl 首行 summary / log.md 首块四问")
    if not actions:
        actions.append("当前里程碑无登记场景：先在 doc/testplan.md 登记场景行（先登记后写码）")
    print("[next] 里程碑 %s：" % ver["milestone"])
    for i, a in enumerate(actions, 1):
        print("  %d. %s" % (i, a))


def pin_spec():
    (DOC / "spec.sha256").write_text(spec_sha() + "\n", encoding="utf-8")
    print("[pin-spec] doc/spec.sha256 已更新")


def archive():
    arc = DOC / "archive"
    arc.mkdir(exist_ok=True)
    header, blocks = log_blocks()
    if len(blocks) > LOG_KEEP:
        old = blocks[LOG_KEEP:]
        with (arc / "log-archive.md").open("a", encoding="utf-8") as f:
            f.write("\n\n" + "\n\n".join(old) + "\n")
        (DOC / "log.md").write_text(
            header + "\n\n" + "\n\n".join(blocks[:LOG_KEEP]) + "\n",
            encoding="utf-8")
        print("[archive] log.md 归档 %d 块" % len(old))
    lines = (DOC / "status.jsonl").read_text(encoding="utf-8").splitlines()
    if len(lines) > STATUS_MAX_LINES:
        with (arc / "status-archive.jsonl").open("a", encoding="utf-8") as f:
            f.write("\n".join(lines[STATUS_KEEP:]) + "\n")
        (DOC / "status.jsonl").write_text(
            "\n".join(lines[:STATUS_KEEP]) + "\n", encoding="utf-8")
        print("[archive] status.jsonl 归档 %d 行" % (len(lines) - STATUS_KEEP))
    print("[archive] 完成")


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", action="store_true")
    g.add_argument("--handover", action="store_true")
    g.add_argument("--next", action="store_true")
    g.add_argument("--pin-spec", action="store_true")
    g.add_argument("--archive", action="store_true")
    a = ap.parse_args()
    if a.check:
        check()
    elif a.handover:
        handover()
    elif a.next:
        next_action()
    elif a.pin_spec:
        pin_spec()
    elif a.archive:
        archive()


if __name__ == "__main__":
    main()
