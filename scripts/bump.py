#!/usr/bin/env python3
# 版本推进：默认 patch+1；--milestone M<n> 则进入新里程碑（0.<n>.0）。
# 同时向 status.jsonl / log.md 插入 TODO 骨架，语义由 agent/用户填，docs-check 拦截未填。
# 用法: python scripts/bump.py [--milestone M1]
import argparse
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "doc"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--milestone", help="进入新里程碑，如 M1")
    a = ap.parse_args()

    vj = ROOT / "version.json"
    ver = json.loads(vj.read_text(encoding="utf-8"))
    if a.milestone:
        m = int(a.milestone.lstrip("M"))
        new = "0.%d.0" % m
        ver["milestone"] = "M%d" % m
    else:
        major, minor, patch = ver["version"].split(".")
        new = "%s.%s.%d" % (major, minor, int(patch) + 1)
    old = ver["version"]
    ver["version"] = new
    vj.write_text(json.dumps(ver, ensure_ascii=False, indent=2) + "\n",
                  encoding="utf-8")

    today = date.today().isoformat()
    sj = DOC / "status.jsonl"
    head = json.dumps({"date": today, "version": new,
                       "milestone": ver["milestone"],
                       "summary": "TODO(bump)"}, ensure_ascii=False)
    sj.write_text(head + "\n" + sj.read_text(encoding="utf-8"),
                  encoding="utf-8")

    lg = DOC / "log.md"
    lines = lg.read_text(encoding="utf-8").splitlines()
    block = ["## [%s] %s TODO(bump) 标题" % (new, today),
             "- **做了什么**：TODO(bump)",
             "- **证据**：TODO(bump)",
             "- **问题**：TODO(bump)",
             "- **下一步**：TODO(bump)", ""]
    idx = next((i for i, l in enumerate(lines) if l.startswith("## [")),
               len(lines))
    lines[idx:idx] = block
    lg.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("[bump] %s → %s (%s)" % (old, new, ver["milestone"]))
    print("[bump] 已插 TODO 骨架：doc/status.jsonl 首行 + doc/log.md 首块，填完再 docs-check")


if __name__ == "__main__":
    main()
