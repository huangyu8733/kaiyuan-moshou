import json, re, sys, os

base = "/Users/huangyu/魔兽/开源魔兽争霸/tools/map-zh-patch/batches"
files = sys.argv[1:]

def protected(s):
    # ordered list of protected tokens
    toks = []
    for m in re.finditer(r'\{N\}|<[^>]*>|\|c[0-9a-fA-F]{8}|\|r|\|n', s):
        toks.append(m.group(0))
    return toks

def counts(s):
    return {
        'N': s.count('{N}'),
        'lt': len(re.findall(r'<[^>]*>', s)),
        'c': s.count('|c'),
        'r': s.count('|r'),
        'n': s.count('|n'),
        'pct': s.count('%'),
        'plus': s.count('+'),
        'minus': s.count('-'),
        'digits': len(re.findall(r'\d', s)),
    }

bad = 0
for f in files:
    src = os.path.join(base, f)
    dst = os.path.join(base, 'done-' + f)
    with open(src, encoding='utf-8') as fh: a = json.load(fh)
    with open(dst, encoding='utf-8') as fh: b = json.load(fh)
    if list(a.keys()) != list(b.keys()):
        print(f"{f}: KEY MISMATCH")
        bad += 1
        continue
    for k in a:
        v = b[k]
        ca, cb = counts(k), counts(v)
        diffs = {x: (ca[x], cb[x]) for x in ca if ca[x] != cb[x]}
        # exact protected-token sequence must be identical (order matters)
        pa, pb = protected(k), protected(v)
        if pa != pb:
            diffs['SEQ'] = (pa, pb)
        if diffs:
            print(f"{f}: DIFF {diffs}\n  KEY: {k[:160]}\n  VAL: {v[:160]}")
            bad += 1
    print(f"{f}: {len(a)} keys checked")
print("BAD:", bad)
