// 强行补全所有"名字非空但 uberTips 为空"的能力描述。
// 这些能力多数为 UI 指令 / 建筑 / 物品效果 / 光环被动 / 变身 / 地图机制，
// 在源图 ubertip 本就为空，玩家通常看不到，这里按名字归类生成定性中文描述填补。
// 仅填充当前为空者，已存在中文描述的（如前次补的 7 个）不会被覆盖。
// 分类使用字符串数组 + includes/startsWith，避免长中文正则被不可见字符污染。
const fs = require("fs");
const path = require("path");

const ROOT = "/Users/huangyu/魔兽/开源魔兽争霸";
const FILES = [
  "Warcraft III zhCN/Maps/hhkj/DotA AI v6.90G PT-BR v4.1.w3x.zhCN.json",
  "Warcraft III zhCN/Maps/hhkj/DotA v6.83d.w3x.zhCN.json",
  "Warcraft III enUS/Maps/hhkj/DotA AI v6.90G PT-BR v4.1.w3x.zhCN.json",
  "Warcraft III enUS/Maps/hhkj/DotA v6.83d.w3x.zhCN.json",
].map((p) => path.join(ROOT, p));

function emptyUber(o) {
  const u = o && o.uberTips;
  return !u || u.length === 0 || u.every((x) => !String(x).trim());
}

function padLen(o) {
  const t = o && o.tips;
  return Array.isArray(t) && t.length ? t.length : 1;
}

// 关键词表（用数组 + includes，避免正则不可见字符问题）
const KW_ITEM = ["物品", "药剂", "药水", "卷轴", "权杖", "地毯", "宝石", "石头", "披风", "法杖", "神杖", "护符", "宝珠", "旗帜", "图腾", "号角", "雕像", "面具", "斗篷", "指环", "护腕", "腰带", "饰品", "碎片", "之石", "之戒", "之刃", "之剑", "之斧", "之锤", "之弓", "之枪", "之盾", "之甲", "之靴", "之书", "之杖", "之冠", "之爪", "之翼"];
const KW_UI = ["选择", "显示", "取消", "停止", "移动", "攻击", "巡逻", "保持", "召唤", "复活", "回城", "返回", "撤退", "聚集", "分散", "坚守", "跟随"];
const KW_BUILD = ["金矿", "闹鬼", "缠绕", "传送门", "防御塔", "兵营", "祭坛", "月井", "远古", "世界树", "生命之树", "基地", "磨坊", "商店", "地洞", "通灵", "深渊", "藏宝", "龙鹰", "狮鹫", "奇美拉", "巨龙", "憎恶", "熊", "巨人", "德鲁伊", "猎手", "弓箭", "步兵", "骑士", "迫击", "直升", "坦克", "飞机", "船", "车", "农民", "苦工", "精灵", "侍僧", "食尸", "穴居", "石像", "亡灵", "人族", "兽族", "暗夜", "建筑", "大厅", "城堡", "关口", "遗迹", "蛋", "尸体"];
const KW_AURA = ["光环", "被动", "附加"];
const KW_FORM = ["形态", "变形", "变身", "升级", "进化", "觉醒", "狂暴愤怒", "模式"];
const KW_MECH = ["交换", "送回", "恢复速度", "集结", "警报", "探测", "开火", "游荡", "荒芜", "创建", "黄金", "木材", "资源"];

function hasAny(nm, arr) {
  return arr.some((k) => nm.includes(k));
}
function startsAny(nm, arr) {
  return arr.some((k) => nm.startsWith(k));
}

// 按能力名归类生成定性中文描述
function genDesc(nm) {
  if (hasAny(nm, KW_ITEM)) return `物品能力「${nm}」：装备或使用后产生相应的增益或效果。`;
  if (startsAny(nm, KW_UI)) return `操作指令：${nm}。`;
  if (hasAny(nm, KW_BUILD)) return `建筑或单位能力「${nm}」：提供相应的建造或功能支持。`;
  if (hasAny(nm, KW_AURA)) return `被动能力「${nm}」：持续生效，无需主动施放。`;
  if (hasAny(nm, KW_FORM)) return `形态切换：「${nm}」改变单位的战斗表现。`;
  if (hasAny(nm, KW_MECH)) return `地图机制能力：「${nm}」。`;
  return `能力「${nm}」：在游戏中提供相应效果。`;
}

function main() {
  // 第一遍：汇总所有需填充的能力 id -> 描述（同名同描述，保证四份一致）
  const authored = {};
  for (const f of FILES) {
    const s = JSON.parse(fs.readFileSync(f, "utf8"));
    const A = s.objects.abilities;
    for (const [id, o] of Object.entries(A)) {
      const nm = (o.name || "").trim();
      if (nm && emptyUber(o) && !authored[id]) {
        authored[id] = genDesc(nm);
      }
    }
  }

  // 第二遍：应用填充（仅填当前为空的）
  let total = 0;
  for (const f of FILES) {
    const s = JSON.parse(fs.readFileSync(f, "utf8"));
    const A = s.objects.abilities;
    let cnt = 0;
    for (const [id, o] of Object.entries(A)) {
      const nm = (o.name || "").trim();
      if (nm && emptyUber(o) && authored[id]) {
        const len = padLen(o);
        A[id].uberTips = Array.from({ length: len }, () => authored[id]);
        cnt++;
      }
    }
    fs.writeFileSync(f, JSON.stringify(s, null, 2));
    console.log(path.basename(f) + " : 填充 " + cnt + " 个能力");
    total += cnt;
  }

  // 写出可重放覆盖表（id -> 描述），供 apply-authored.cjs 在重生成后再次应用
  const outPath = path.join(ROOT, "tools/map-zh-patch/authored-ubertips.json");
  fs.writeFileSync(outPath, JSON.stringify(authored, null, 2));
  console.log("\nauthored 覆盖表条目数: " + Object.keys(authored).length);
  console.log("四份侧车共填充: " + total + " 次（含重复计算）");
}

if (require.main === module) {
  main();
}

module.exports = { genDesc };
