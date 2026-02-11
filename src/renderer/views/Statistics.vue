<template>
  <div
    class="statistics-page h-full flex flex-col bg-gray-50 text-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100"
  >
    <!-- Header -->
    <div
      class="flex-none px-6 py-4 flex justify-between items-center border-b border-gray-200 bg-white z-10"
    >
      <h1 class="text-xl font-bold text-gray-800 tracking-wide">
        {{ i18n?.ui?.menu?.statistics || "抽卡详情" }}
      </h1>
      <!-- <el-switch
        v-model="useMock"
        active-text="Mock"
        inactive-text="Real"
        @change="toggleMock"
        style="--el-switch-on-color: #10b981"
        size="small"
      /> -->
    </div>

    <!-- Type Tabs -->
    <div class="flex-none px-6 pt-4 bg-white border-b border-gray-200">
      <div class="flex gap-6">
        <button
          v-for="type in poolTypes"
          :key="type.key"
          @click="activeType = type.key"
          class="pb-3 px-2 text-sm font-bold transition-all relative"
          :class="
            activeType === type.key
              ? 'text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          "
        >
          {{ type.name }}
          <div
            v-if="activeType === type.key"
            class="absolute bottom-0 left-0 w-full h-0.5 bg-gray-900"
          ></div>
        </button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-6 scroll-smooth">
      <!-- Empty State -->
      <div
        v-if="!currentData || currentData.size === 0"
        class="flex flex-col items-center justify-center text-gray-400 py-32"
      >
        <el-icon class="text-6xl mb-4 text-gray-300"><FolderDelete /></el-icon>
        <p class="text-lg font-medium">暂无数据</p>
        <p class="text-sm mt-1">请先加载数据或开启 Mock 模式</p>
      </div>

      <div v-else class="space-y-6 max-w-6xl mx-auto">
        <!-- Summary Cards for Active Type -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Total Pulls -->
          <div
            class="bg-white rounded-xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div
              class="absolute top-0 left-0 w-1 h-full"
              :class="activeTypeConfig.color"
            ></div>
            <div
              class="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold"
            >
              总抽数 (Total)
            </div>
            <div
              class="text-3xl font-extrabold text-gray-900 font-mono tracking-tight"
            >
              {{ activeStats.total }}
            </div>
          </div>

          <!-- Current Pity -->
          <div
            class="bg-white rounded-xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div
              class="absolute top-0 left-0 w-1 h-full"
              :class="activeTypeConfig.color"
            ></div>
            <div
              class="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold"
            >
              当前已垫 (Pity)
            </div>
            <div
              class="text-3xl font-extrabold font-mono tracking-tight"
              :class="getPityColorText(activeStats.currentPity)"
            >
              {{ activeStats.currentPity
              }}<span class="text-sm font-medium text-gray-400 ml-1"
                >/{{ activeTypeConfig.maxPity }}</span
              >
            </div>
          </div>

          <!-- SSR Count -->
          <div
            class="bg-white rounded-xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div
              class="absolute top-0 left-0 w-1 h-full"
              :class="activeTypeConfig.color"
            ></div>
            <div
              class="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold"
            >
              出卡数 (6★)
            </div>
            <div
              class="text-3xl font-extrabold text-[#d97706] font-mono tracking-tight"
            >
              {{ activeStats.ssrCount }}
            </div>
            <div class="text-xs text-gray-400 mt-1 font-medium">
              平均 {{ activeStats.avgSSR }} 抽
            </div>
          </div>

          <!-- UP Rate -->
          <div
            class="bg-white rounded-xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div
              class="absolute top-0 left-0 w-1 h-full"
              :class="activeTypeConfig.color"
            ></div>
            <div
              class="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold"
            >
              UP 概率
            </div>
            <div
              class="text-3xl font-extrabold text-emerald-600 font-mono tracking-tight"
            >
              {{ activeStats.upRate }}%
            </div>
            <div class="text-xs text-gray-400 mt-1 font-medium">
              歪 {{ activeStats.ssrLost }}
            </div>
          </div>
        </div>

        <!-- Banner Cards List -->
        <div class="space-y-6">
          <div
            v-for="banner in bannerList"
            :key="banner.id"
            class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
          >
            <!-- Banner Header -->
            <div
              class="bg-gray-50/50 px-6 py-4 flex justify-between items-center border-b border-gray-100"
            >
              <div>
                <h3
                  class="text-lg font-bold text-gray-800 flex items-center gap-2"
                >
                  {{ banner.name }}
                  <span
                    v-if="banner.isCurrent"
                    class="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-200 uppercase tracking-wide"
                    >Current</span
                  >
                </h3>
                <div class="text-xs text-gray-500 mt-1 font-mono font-medium">
                  {{ formatDateRange(banner.startTime, banner.endTime) }}
                </div>
              </div>
              <div class="flex items-center gap-3">
                 <!-- Spark Status -->
                 <div class="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-100" v-if="banner.sparkStatus">
                    <span class="text-[10px] uppercase font-bold text-purple-400">Spark (120)</span>
                    <span class="text-xs font-bold font-mono" :class="banner.sparkStatus.used ? 'text-purple-600' : 'text-gray-600'">
                        {{ banner.sparkStatus.text }}
                    </span>
                 </div>

                 <div
                    class="bg-white text-gray-600 text-sm px-4 py-1.5 rounded-full font-bold font-mono border border-gray-200 shadow-sm"
                 >
                    {{ banner.totalPulls }} 抽
                 </div>
              </div>
            </div>

            <!-- Banner Body -->
            <div class="p-6 space-y-6">
              <!-- Icon Summary Grid (Pool UP Characters) -->
              <div class="flex flex-wrap gap-3">
                <div
                  v-for="(item, idx) in banner.upItems"
                  :key="idx"
                  class="relative group cursor-default"
                >
                  <div
                    class="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-sm font-bold shadow-sm select-none overflow-hidden transition-colors"
                    :class="{
                      'border-amber-400 bg-amber-50 text-amber-600':
                        !item.isMajor,
                      'border-red-400 bg-red-50 text-red-600': item.isMajor,
                    }"
                    :title="item.name"
                  >
                    <img
                      v-if="getCharacterIcon(item.name)"
                      :src="getCharacterIcon(item.name)"
                      class="w-full h-full object-cover"
                      :alt="item.name"
                    />
                    <span v-else>{{ item.name[0] }}</span>
                  </div>
                  <!-- Mini Badge for Major UP -->
                  <div
                    v-if="item.isMajor"
                    class="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
                  >
                    <div class="w-1 h-1 bg-white rounded-full"></div>
                  </div>
                  <!-- Mini Badge for Minor UP -->
                  <div
                    v-else
                    class="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
                  ></div>
                </div>
              </div>

              <!-- Detailed Timeline Bars -->
              <div class="space-y-4">
                <div
                  v-for="(record, rIdx) in banner.ssrRecords"
                  :key="rIdx"
                  class="flex items-center gap-5 group/item"
                >
                  <!-- Avatar with large Badge -->
                  <div class="relative shrink-0">
                    <div
                      class="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-lg font-bold shadow-sm text-gray-700 overflow-hidden"
                      :class="{ 'opacity-50 grayscale': !record.isUpMajor && !record.isUpMinor }"
                    >
                      <img
                        v-if="getCharacterIcon(record.name)"
                        :src="getCharacterIcon(record.name)"
                        class="w-full h-full object-cover"
                        :alt="record.name"
                      />
                      <span v-else>{{ record.name[0] }}</span>
                    </div>

                    <!-- Status Tag -->
                    <div
                      v-if="record.isUpMajor"
                      class="absolute -top-2.5 -right-2.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-md shadow-sm font-bold border-2 border-white z-10"
                    >
                      UP
                    </div>
                    <div
                      v-else-if="record.isUpMinor"
                      class="absolute -top-2.5 -right-2.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-md shadow-sm font-bold border-2 border-white z-10"
                    >
                      UP
                    </div>
                    <div
                      v-else
                      class="absolute -top-2.5 -right-2.5 bg-gray-400 text-white text-[10px] px-1.5 py-0.5 rounded-md shadow-sm font-bold border-2 border-white z-10"
                    >
                      歪
                    </div>
                  </div>

                  <!-- Progress Bar Area -->
                  <div class="flex-1 min-w-0">
                    <div class="flex justify-between text-xs mb-1.5 px-0.5">
                      <span class="text-gray-700 font-bold">{{
                        record.name
                      }}</span>
                      <span
                        class="text-gray-400 font-mono text-[10px] mt-0.5"
                        >{{ formatDate(record.time) }}</span
                      >
                    </div>
                    <div
                      class="relative h-8 bg-gray-100 rounded-lg overflow-hidden w-full flex items-center shadow-inner border border-gray-100"
                    >
                      <div
                        class="absolute left-0 top-0 bottom-0 transition-all duration-700 ease-out"
                        :class="getBarColor(record)"
                        :style="{
                          width:
                            getPityPercentage(
                              record.displayPity,
                              record.maxValue,
                            ) + '%',
                        }"
                      ></div>

                      <div
                        class="relative z-10 w-full flex justify-between px-3 text-xs font-bold items-center"
                      >
                        <span
                          :class="
                            getPityPercentage(record.displayPity, record.maxValue) < 50
                              ? 'text-gray-800'
                              : 'text-white drop-shadow-sm'
                          "
                        >
                          {{ record.displayPity }}<span v-if="!record.isFree"> 抽</span>
                        </span>
                        
                        <!-- Removed Tag -->
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- If no SSR -->
              <div
                v-if="banner.ssrRecords.length === 0"
                class="text-center text-gray-400 text-sm py-4 border-t border-gray-100 border-dashed mt-2 italic"
              >
                本期暂无 6★ 记录
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, ref, computed, onMounted } from "vue";
import { generateMockData }from "../mock/gachaData.js";
import poolsData from "../data/pools.json";
import charactersData from "../data/characters.json";
import { FolderDelete } from "@element-plus/icons-vue";
const { ipcRenderer } = require("electron");

const i18n = inject("i18n");
const useMock = ref(false);
const rawDataMap = ref(new Map());
// Active Tab: Default to Special (most relevant)
const activeType = ref("E_CharacterGachaPoolType_Special");

const poolTypes = [
  { key: "E_CharacterGachaPoolType_Special", name: "特许寻访" },
  { key: "E_CharacterGachaPoolType_Standard", name: "基础寻访" },
  { key: "E_CharacterGachaPoolType_Beginner", name: "启程寻访" },
];

const toggleMock = async () => {
  if (useMock.value) {
    const mockUIGF = generateMockData();
    rawDataMap.value = adaptUIGFToMap(mockUIGF);
  } else {
    // Fetch real data
    await fetchRealData();
  }
};

const adaptUIGFToMap = (uigfData) => {
  const map = new Map();
  if (uigfData?.hkrpg?.[0]?.list) {
    const list = uigfData.hkrpg[0].list;
    list.forEach(item => {
      const type = item.gacha_type;
      if (!map.has(type)) {
        map.set(type, []);
      }
      map.get(type).push(item);
    });
  }
  return map;
};

// Map legacy IDs to new Enum types
const keyMapping = {
  "1": "E_CharacterGachaPoolType_Standard",
  "11": "E_CharacterGachaPoolType_Special",
  "2": "E_CharacterGachaPoolType_Beginner",
  "300": "300"
};

const fetchRealData = async () => {
  try {
    const data = await ipcRenderer.invoke("READ_DATA");
    if (data && data.dataMap) {
       // dataMap is Map<uid, { result: Map<type, list> }>
       // We need to get the current UID's data
       const currentUid = data.current;
       const userData = data.dataMap.get(currentUid);
       if (userData && userData.result) {
         let rawResult = userData.result;
         
         // Ensure it's a map
         if (!(rawResult instanceof Map)) {
             rawResult = new Map(Array.isArray(rawResult) ? rawResult : Object.entries(rawResult));
         }

         const mappedResult = new Map();
         
         // Map keys
         for (const [key, list] of rawResult.entries()) {
             const newKey = keyMapping[key] || key;
             // Ensure we don't overwrite if multiple keys map to same (unlikely here)
             const existing = mappedResult.get(newKey) || [];
             mappedResult.set(newKey, existing.concat(list));
         }
         
         rawDataMap.value = mappedResult;
       } else {
         rawDataMap.value = new Map();
       }
    }
  } catch (e) {
    console.error("Failed to fetch real data", e);
    rawDataMap.value = new Map();
  }
};

const currentData = computed(() => rawDataMap.value);

// Configuration based on active type
const activeTypeConfig = computed(() => {
  if (activeType.value === "E_CharacterGachaPoolType_Special") {
    return {
      color: "bg-gradient-to-b from-red-500 to-orange-500",
      maxPity: 80,
    };
  }
  if (activeType.value === "E_CharacterGachaPoolType_Beginner") {
    return {
      color: "bg-gradient-to-b from-emerald-500 to-teal-500",
      maxPity: 50,
    };
  }
  return {
    color: "bg-gradient-to-b from-blue-500 to-cyan-500",
    maxPity: 80,
  };
});

// Records for the CURRENT active type tab
const activeRecords = computed(() => {
  const list = rawDataMap.value.get(activeType.value) || [];
  // Make sure to clone and sort
  return [...list].sort((a, b) => new Date(b.time) - new Date(a.time));
});

// Calculate Stats for ACTIVE type
const activeStats = computed(() => {
  const stats = {
    total: 0,
    ssrCount: 0,
    ssrLost: 0,
    upRate: 0,
    avgSSR: 0,
    currentPity: 0,
  };

  // Sort ascending for accurate pity calc
  const records = [...activeRecords.value].sort(
    (a, b) => new Date(a.time) - new Date(b.time),
  );

  let pity = 0;
  let ssr = 0;
  let upMajor = 0;
  let upMinor = 0;
  let ssrPullsTotal = 0;

  records.forEach((r) => {
    // Skip free pulls for Pity calculation
    if (r.isFree) return;

    pity++;
    if (r.rank_type === "6") {
      ssr++;
      ssrPullsTotal += pity;
      pity = 0;

      // Check UP status
      const rTime = new Date(r.time).getTime();
      const pool = poolsData.find(
        (p) =>
          p.type === activeType.value &&
          new Date(p.startTime).getTime() <= rTime &&
          new Date(p.endTime).getTime() >= rTime,
      );

      if (pool) {
        if (pool.up6 && pool.up6.includes(r.name)) upMajor++;
        else if (pool._up6 && pool._up6.includes(r.name)) upMinor++;
        else stats.ssrLost++;
      } else {
        stats.ssrLost++;
      }
    }
  });

  stats.total = records.length; // Total includes free? Or only paid? 
                                // User: "Total (Paid + Free) or just Paid".
                                // Let's simplify: stats.total matches the list size (Paid + Free)
                                // But Pity display below should be Paid Pity.
  stats.ssrCount = ssr;
  stats.currentPity = pity; // This pity is strictly PAID pity
  stats.avgSSR = ssr > 0 ? (ssrPullsTotal / ssr).toFixed(1) : 0;
  stats.upRate = ssr > 0 ? (((upMajor + upMinor) / ssr) * 100).toFixed(1) : 0;

  return stats;
});

// Group ACTIVE records by Banner
const bannerList = computed(() => {
  let relevantPools = poolsData.filter((p) => p.type === activeType.value);
  relevantPools.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  const banners = [];

  relevantPools.forEach((pool) => {
    const start = new Date(pool.startTime).getTime();
    const end = new Date(pool.endTime).getTime();

    // 1. Filter records for this banner
    // activeRecords is sorted DESC (newest first)
    const matchingRecordsDesc = activeRecords.value.filter((r) => {
        // ID-based matching (Priority)
        if (r.gacha_id && r.gacha_id !== "mock_pool" && pool.poolId) {
            return r.gacha_id === pool.poolId;
        }
        
        // Fallback: Time-based matching
        // Only use if gacha_id is missing or generic "mock_pool" (old mock data?)
        // Actually, our new mock data has real IDs, so it should hit the first condition.
        // But for safety/backward compatibility:
        const t = new Date(r.time).getTime();
        return t >= start && t <= end;
    });

    if (matchingRecordsDesc.length === 0) return;

    // 2. Sort ASC to process chronologically for Spark counting
    const matchingRecordsAsc = [...matchingRecordsDesc].sort(
      (a, b) => new Date(a.time) - new Date(b.time)
    );

    const ssrDetails = [];
    
    // Spark Logic Calculation for Header
    // Filter out free records for Spark counting
    const paidRecordsAsc = matchingRecordsAsc.filter(r => !r.isFree);

    let sparkStatus = {
        total: paidRecordsAsc.length,
        used: false,
        at: 0,
        text: `${paidRecordsAsc.length} / 120`
    };

    // Find if/when Spark was used (First MAIN UP character)
    for (let i = 0; i < paidRecordsAsc.length; i++) {
        const r = paidRecordsAsc[i];
        if (r.rank_type === "6") {
            let isMainUp = false;
            // Only MAIN UP (pool.up6) consumes Spark
            if (pool.up6 && pool.up6.includes(r.name)) isMainUp = true;
            
            if (isMainUp) {
                sparkStatus.used = true;
                sparkStatus.at = i + 1;
                sparkStatus.text = `已触发 (${i + 1}抽)`;
                break; // One-time use
            }
        }
    }

    matchingRecordsDesc.forEach((r) => {
      if (r.rank_type === "6") {
        let pity = 0;
        let displayPity = 0;
        if (r.isFree) {
            displayPity = "FREE";
        } else {
            pity = getPityForRecord(r);
            displayPity = pity;
        }

        let isUpMajor = false;
        let isUpMinor = false;
        if (pool.up6 && pool.up6.includes(r.name)) isUpMajor = true;
        else if (pool._up6 && pool._up6.includes(r.name)) isUpMinor = true;

        ssrDetails.push({
          ...r,
          pity, 
          displayPity, 
          maxValue: activeTypeConfig.value.maxPity,
          isUpMajor,
          isUpMinor,
        });
      }
    });

    const upItems = [];
    if (pool.up6) {
      pool.up6.forEach((name) => upItems.push({ name, isMajor: true }));
    }
    if (pool._up6) {
      pool._up6.forEach((name) => upItems.push({ name, isMajor: false }));
    }

    banners.push({
      id: pool.poolId || pool.id, // Use poolId if available, fallback to id
      name: pool.poolName || pool.name, // Use poolName if available
      startTime: pool.startTime,
      endTime: pool.endTime,
      totalPulls: matchingRecordsDesc.length, // Total includes free
      sparkStatus, // Spark info (Paid only)
      ssrRecords: ssrDetails,
      upItems: upItems,
      // Current check might still need time check? 
      // Or just check if today is within range?
      isCurrent: Date.now() >= start && Date.now() <= end,
    });
  });

  return banners;
});

// Helper: Calculate absolute pity for a specific record ID within the ACTIVE TYPE list
const getPityForRecord = (targetRecord) => {
  // Free records have no pity
  if (targetRecord.isFree) return 0;

  const ascRecords = [...activeRecords.value].sort(
    (a, b) => new Date(a.time) - new Date(b.time),
  );
  let pity = 0;
  for (const r of ascRecords) {
    // Only increment pity for paid pulls
    if (!r.isFree) {
        pity++;
    }
    
    if (r.id === targetRecord.id) {
      return pity;
    }
    
    // Reset pity on PAID 6* only
    if (r.rank_type === "6" && !r.isFree) {
      pity = 0;
    }
  }
  return 0;
};

const formatDateRange = (s, e) => {
  const fd = (d) => {
    const date = new Date(d);
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  };
  if (e.includes("2099")) return `${fd(s)} ~ ...`;
  return `${fd(s)} ~ ${fd(e)}`;
};

const formatDate = (str) => {
  if (!str) return "";
  const d = new Date(str);
  return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
};

const getPityPercentage = (val, max) => {
    if (isNaN(val)) return 100; // For 'Free' or '-'
    return Math.min((val / max) * 100, 100);
}

const getBarColor = (record) => {
  if (record.isFree) {
      return "bg-gray-400";
  }

  const val = record.pity;
  
  // Standard Pity Colors per user request
  // 0-20: Green
  // 20-40: Blue
  // 40-60: Amber/Yellow
  // 60-80: Red
  if (val <= 20)
    return "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]";
  if (val <= 40) return "bg-blue-400";
  if (val <= 60) return "bg-amber-400";
  return "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]";
};

const getPityColorText = (pity) => {
  if (pity <= 20) return "text-emerald-600";
  if (pity <= 40) return "text-blue-600";
  if (pity <= 60) return "text-amber-600";
  return "text-red-600";
};

// Removed getTagColor



const getCharacterIcon = (name) => {
  const iconFile = charactersData[name]?.icon;
  if (!iconFile) return null;

  // If still http (download failed?), use as is
  if (iconFile.startsWith("http")) return iconFile;

  // Local asset
  return new URL(`../assets/characters/${iconFile}`, import.meta.url).href;
};

onMounted(async () => {
  // Default to Real data on mount
  useMock.value = false; 
  await toggleMock();
});
</script>

<style scoped>
/* Custom scrollbar for light theme */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: #e5e7eb; /* gray-200 */
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: #d1d5db; /* gray-300 */
}
</style>
