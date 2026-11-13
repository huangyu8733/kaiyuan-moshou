import json, sys, os
base = "/Users/huangyu/魔兽/开源魔兽争霸/tools/map-zh-patch/batches"
name, trfile = sys.argv[1], sys.argv[2]
with open(os.path.join(base, name), encoding='utf-8') as f:
    src = json.load(f)
with open(os.path.join(base, trfile), encoding='utf-8') as f:
    trs = json.load(f)
HEAD = "|cffffcc00Se você já tiver peças deste item,\" paga só o que falta. O item vai direto para o inventário.|r|n|n"
HEADZH = "|cffffcc00如果你已经拥有此物品的部分组件，只需支付差额。物品会直接进入物品栏。|r|n|n"
assert isinstance(trs, list)
assert len(trs) == len(src), f"count mismatch: {len(trs)} vs {len(src)}"
out = {}
for k, body in zip(src.keys(), trs):
    assert k.startswith(HEAD), f"header mismatch in key: {k[:80]!r}"
    out[k] = HEADZH + body
with open(os.path.join(base, "done-" + name), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"wrote done-{name}: {len(out)} keys")
