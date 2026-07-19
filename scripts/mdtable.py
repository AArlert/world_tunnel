# markdown 表格分列——docs.py（读）与 evidence.py（写）共用同一逻辑，契约必须一致。
# 见 BUG-002/BUG-003/BUG-005：裸按字面竖线切列会把「反斜杠转义的竖线」与「反引号行内代码里的
# 字面竖线」误判为列分隔符，导致列错位/静默覆盖。


class MalformedRowError(ValueError):
    """行内反引号数量为奇数（未闭合）——"行内代码"状态无法在行尾正确复位，
    该行的列边界不可信。一律显式抛出拒收，不做静默错位/静默跳过（见 BUG-005/BUG-009）。"""


def split_row(line):
    """转义 / 行内代码感知分列：
    - 反斜杠转义的竖线（`\\|`）不是列分隔符；
    - 成对反引号包裹的行内代码片段内的竖线（不论是否转义）不是列分隔符。
    其余位置的竖线才断列。若反引号未成对闭合，抛出 MalformedRowError（调用方须显式处理，
    不得吞掉异常后继续静默解析）。"""
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    cells = []
    buf = []
    in_code = False
    i, n = 0, len(s)
    while i < n:
        ch = s[i]
        if ch == "\\" and i + 1 < n:
            buf.append(ch)
            buf.append(s[i + 1])
            i += 2
            continue
        if ch == "`":
            in_code = not in_code
            buf.append(ch)
            i += 1
            continue
        if ch == "|" and not in_code:
            cells.append("".join(buf).strip())
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    if in_code:
        raise MalformedRowError(
            "行内反引号未闭合（奇数个），列边界不可信: %r" % line)
    cells.append("".join(buf).strip())
    return cells
