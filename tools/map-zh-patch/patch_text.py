#!/usr/bin/env python3
# 直接改地图副本：war3map.wts + scripts\war3map.j 里的显示文本
# 安全策略：jass 只替换“成句/成短语”的字面量（含空格且长度>=12，或带颜色码），
# 不替换单词型标识（它们可能是哈希表键/逻辑比较值）。
import json, re, sys

def norm(s):
    return s.replace('\r\n', '\n').replace('\r', '\n').strip()

def safe_for_jass(key, zh):
    if '|c' in key or '|r' in key:
        return True
    if ' ' in key and len(key) >= 12:
        return True
    if key.endswith(':') and ' ' in key:
        return True
    return False

def load(json_path):
    d = json.load(open(json_path, encoding='utf-8'))
    text = {}
    for k, v in d.get('text', {}).items():
        v = str(v)
        if not v.strip() or not re.search(r'[\u4e00-\u9fff]', v):
            continue
        if safe_for_jass(k, v):
            text[norm(k)] = v
    return d, text

def patch_wts(raw, wts):
    txt = raw.decode('utf-8-sig', errors='replace')
    bom = raw.startswith(b'\xef\xbb\xbf')
    n = [0]
    pat = re.compile(r'STRING (\d+)\r?\n\{\r?\n(.*?)\r?\n\}', re.S)
    def repl(m):
        new = wts.get(m.group(1))
        if new is None:
            return m.group(0)
        n[0] += 1
        return f'STRING {m.group(1)}\n{{\n{new}\n}}'
    out = pat.sub(repl, txt)
    data = out.encode('utf-8')
    if bom:
        data = b'\xef\xbb\xbf' + data
    return data, n[0]

def scan_literals(data):
    """返回 (literal 内容->位置列表, 去掉字面量后的骨架)"""
    lits, skeleton = [], []
    i, L = 0, len(data)
    while i < L:
        if data[i] == '"':
            i += 1
            buf = []
            while i < L:
                c = data[i]
                if c == '\\' and i + 1 < L:
                    nxt = data[i + 1]
                    buf.append(nxt if nxt in ('"', '\\') else c + nxt)
                    i += 2
                    continue
                if c == '"':
                    break
                buf.append(c); i += 1
            lits.append(''.join(buf))
            skeleton.append('""')
            i += 1
            continue
        skeleton.append(data[i]); i += 1
    return lits, ''.join(skeleton)

def patch_jass(data, text):
    res, n = [], 0
    i, L = 0, len(data)
    while i < L:
        if data[i] == '"':
            start = i; i += 1; buf = []
            while i < L:
                c = data[i]
                if c == '\\' and i + 1 < L:
                    nxt = data[i + 1]
                    buf.append(nxt if nxt in ('"', '\\') else c + nxt)
                    i += 2; continue
                if c == '"':
                    break
                buf.append(c); i += 1
            lit = ''.join(buf)
            zh = text.get(norm(lit))
            if zh is not None:
                esc = zh.replace('\\', '\\\\').replace('"', '\\"').replace('\r\n', '\n').replace('\n', '\\n')
                res.append('"' + esc + '"'); n += 1
            else:
                res.append(data[start:i + 1] if i < L else data[start:])
            i += 1; continue
        res.append(data[i]); i += 1
    return ''.join(res), n

def main():
    json_path, wts_in, wts_out, j_in, j_out = sys.argv[1:6]
    d, text = load(json_path)
    wts = {k: str(v) for k, v in d.get('wts', {}).items() if str(v).strip()}
    raw = open(wts_in, 'rb').read()
    out, nw = patch_wts(raw, wts)
    open(wts_out, 'wb').write(out)
    print(f'wts: 替换 {nw}/{len(wts)} 条 -> {wts_out}')

    src = open(j_in, 'r', encoding='utf-8-sig', errors='replace').read()
    bom = open(j_in, 'rb').read(3) == b'\xef\xbb\xbf'
    outj, nj = patch_jass(src, text)
    b = outj.encode('utf-8')
    if bom:
        b = b'\xef\xbb\xbf' + b
    open(j_out, 'wb').write(b)

    # 校验：除字面量内容外，脚本骨架必须完全一致
    s1 = scan_literals(src)[1]
    s2 = scan_literals(outj)[1]
    print(f'jass: 替换 {nj} 处，候选 {len(text)} 条；骨架一致: {s1 == s2}；引号数一致: {src.count(chr(34)) == outj.count(chr(34))}')
    if s1 != s2:
        sys.exit(1)

if __name__ == '__main__':
    main()
