import json, sys, os
base = "/Users/huangyu/魔兽/开源魔兽争霸/tools/map-zh-patch/batches"
name, trfile = sys.argv[1], sys.argv[2]
with open(os.path.join(base, name), encoding='utf-8') as f:
    src = json.load(f)
with open(os.path.join(base, trfile), encoding='utf-8') as f:
    trs = json.load(f)
assert isinstance(trs, list), "translations must be a JSON array"
assert len(trs) == len(src), f"count mismatch: {len(trs)} vs {len(src)}"
out = {k: v for k, v in zip(src.keys(), trs)}
with open(os.path.join(base, "done-" + name), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"wrote done-{name}: {len(out)} keys")
