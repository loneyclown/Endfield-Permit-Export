// Mock data generation simulating UIGF format

const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Character definitions
const characters = {
  6: ["余烬", "骏卫", "黎风", "艾尔黛拉", "别礼", "莱万汀", "洁尔佩塔", "伊冯"],
  5: ["大潘", "佩丽卡", "陈千语", "狼卫", "弧光", "艾维文娜", "昼雪", "赛希", "阿列什"],
  4: ["萤石", "卡契尔", "秋栗", "埃特拉", "安塔尔"],
};

const weapons = {
  6: ["基石·壁垒", "基石·破军"], // Example weapon names
  5: [],
  4: [],
};

import poolsData from "../data/pools.json";

// Map pool type string to UIGF gacha_type ID if needed, 
// but we are using E_... strings now.
// We can just use the type from the pool definition.

const generateUIGFList = (count = 5000) => {
  const list = [];

  for (let i = 0; i < count; i++) {
    // Select a random pool from pools.json
    // We want some distribution, maybe bias towards Special
    const randomPoolIndex = Math.floor(Math.random() * poolsData.length);
    let selectedPool = poolsData[randomPoolIndex];

    // Bias: 60% chance to pick a "Special" pool if available
    const specialPools = poolsData.filter(p => p.type === "E_CharacterGachaPoolType_Special");
    if (specialPools.length > 0 && Math.random() < 0.6) {
      selectedPool = specialPools[Math.floor(Math.random() * specialPools.length)];
    }

    const gacha_type = selectedPool.type;
    const gacha_id = selectedPool.poolId; // This is the key change!

    const isCharacter = Math.random() > 0.05;
    let rank = "4";
    const rand = Math.random();

    if (rand < 0.02) {
      rank = "6";
    } else if (rand < 0.1) {
      rank = "5";
    }

    // isFree logic
    // 5% chance, but maybe only valid for certain pools? 
    // For simplicity, allow everywhere for now or restrict to Special.
    const isFree = Math.random() < 0.05;

    const poolSource = isCharacter ? characters : weapons;
    const itemType = isCharacter ? "Character" : "Weapon";

    // Select specific characters
    // If it's the selected pool, try to pick UP characters
    let name = "Unknown";

    if (rank === "6") { // Logic for 6*
      let pickedUp = false;
      if (selectedPool.up6 && Math.random() < 0.5) { // 50% chance for UP
        name = selectedPool.up6[getRandomInt(0, selectedPool.up6.length - 1)];
        pickedUp = true;
      } else if (selectedPool._up6 && Math.random() < 0.5) { // separate chance for minor UP if structured that way?
        // Actually usually up6 is the banner char. _up6 might be secondary?
        // Let's just say if not main UP, check secondary.
        if (!pickedUp) {
          name = selectedPool._up6[getRandomInt(0, selectedPool._up6.length - 1)];
        }
      }

      if (!pickedUp && name === "Unknown") {
        // Fallback to random standard
        name = characters[6][getRandomInt(0, characters[6].length - 1)];
      }
    } else {
      if (poolSource[rank] && poolSource[rank].length > 0) {
        name = poolSource[rank][getRandomInt(0, poolSource[rank].length - 1)];
      } else if (isCharacter) {
        name = characters["4"][0];
      } else {
        name = "制式武器";
      }
    }

    // Time generation: MUST be within the pool's time range for validity?
    // Actually, real data has time. 
    // If we want to test "Out of range" resilience, we could generate random times.
    // But to test "ID matching priority", we should probably generate times 
    // that might match the pool OR might be slightly off, but the ID lines up.
    // For simplicity, let's generate a time strictly within the pool's range.
    const pStart = new Date(selectedPool.startTime).getTime();
    const pEnd = new Date(selectedPool.endTime).getTime();
    // Cap end at now
    const effectiveEnd = Math.min(pEnd, Date.now());
    // If pool hasn't started, skip (or pick another pool). with 5000 it's fine.
    // But pools.json has wide ranges for standard/beginner.

    let timeTs = getRandomInt(pStart, effectiveEnd);
    if (timeTs > Date.now()) timeTs = Date.now(); // Safety

    const date = new Date(timeTs);
    const timeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

    list.push({
      id: `${timeTs}-${i}`,
      uid: "100000001",
      gacha_id: gacha_id, // Use the real pool ID
      gacha_type,
      item_id: "",
      count: "1",
      time: timeStr,
      name,
      lang: "zh-cn",
      item_type: itemType,
      rank_type: rank,
      isFree: isFree
    });
  }

  list.sort((a, b) => new Date(a.time) - new Date(b.time));
  return list;
};

export const generateMockData = () => {
  return {
    info: {
      uid: "100000001",
      lang: "zh-cn",
      export_time: new Date().toLocaleString(),
      app_version: "mock-v1.0",
      uigf_version: "v2.0"
    },
    hkrpg: [{
      uid: "100000001",
      timezone: 8,
      list: generateUIGFList(5000)
    }]
  };
};

export default generateMockData;
