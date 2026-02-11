const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Updated character list based on characters.json
const characters = {
  6: ["余烬", "骏卫", "黎风", "艾尔黛拉", "别礼", "莱万汀", "洁尔佩塔", "伊冯"],
  5: [],
  4: [],
};

const weapons = {
  6: [],
  5: [],
  4: [],
};

const generateMockData = (count = 1000, type = "1") => {
  const data = [];

  // Create a time distribution to simulate banners?
  // For simplicity, just random times within last 2 years
  // But to match pools, we should probably generate within specific ranges if possible.
  // Let's just generate random formatted dates for now, the UI logic handles sorting/grouping.

  for (let i = 0; i < count; i++) {
    const isCharacter = Math.random() > 0.05; // Mostly characters
    let rank = "4";
    const rand = Math.random();

    if (rand < 0.02) {
      rank = "6";
    } else if (rand < 0.1) {
      rank = "5";
    }

    const pool = isCharacter ? characters : weapons;
    const itemType = isCharacter ? "Character" : "Weapon";
    const name = pool[rank][getRandomInt(0, pool[rank].length - 1)];

    // Time: Random within 2023-2026 range to cover our pools.json
    // Start from 2026-01-01 backward
    // Actually pools.json has 2026 dates, so we need recent dates.
    // Let's generate from Jan 2025 to Mar 2026
    const start = new Date("2025-01-01").getTime();
    const end = new Date("2026-03-30").getTime();
    const timeTimestamp = getRandomInt(start, end);
    const time = new Date(timeTimestamp)
      .toLocaleString("zh-CN", { hour12: false })
      .replace(/\//g, "-");

    data.push({
      time,
      name,
      item_type: itemType,
      rank_type: rank,
      id: `${Date.now()}-${i}`,
      gacha_type: type,
    });
  }

  // Sort by time
  data.sort((a, b) => new Date(a.time) - new Date(b.time));

  return data;
};

const mockDataMap = new Map();
// 1: Standard, 11: Limited
mockDataMap.set("1", generateMockData(300, "1"));
mockDataMap.set("11", generateMockData(500, "11")); // More pulls on limited

export default mockDataMap;
