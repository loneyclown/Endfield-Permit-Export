const fs = require('fs-extra')
const path = require('path')
const { app, ipcMain, shell } = require('electron')
const { sendMsg, readJSON, saveJSON, detectLocale, userDataPath, localIp, langMap, sleep } = require('./utils')
const config = require('./config')
const i18n = require('./i18n')
const { mergeData } = require('./utils/mergeData')
// const gachaTypeRaw = require('../gachaType.json') // Removed or unused
const fetch = require('electron-fetch').default

const dataMap = new Map()
let apiDomain = 'https://ef-webview.gryphline.com'

const saveData = async (data) => {
    const obj = Object.assign({}, data)
    obj.result = [...obj.result]
    if (obj.typeMap) obj.typeMap = [...obj.typeMap]
    await config.save()
    await saveJSON(`gacha-list-${data.uid}.json`, obj)
}

const extractEfWebview = async () => {
    const homeDir = app.getPath('home')
    const logPaths = [
        path.join(homeDir, "AppData", "LocalLow", "Gryphline", "Endfield", "sdklogs", "HGWebview.log"),
        path.join(homeDir, "AppData", "LocalLow", "Hypergryph", "Endfield", "sdklogs", "HGWebview.log")
    ]

    const allInfos = []

    for (const logPath of logPaths) {
        try {
            if (await fs.pathExists(logPath)) {
                const content = await fs.readFile(logPath, "utf-8")
                const regex = /https:\/\/ef-webview\.(gryphline|hypergryph)\.com[^\s"'<>]*[&\?](u8_token|token)=[^&\s"'<>]+[^\s"'<>]*/g
                const matches = content.match(regex)

                if (matches && matches.length > 0) {
                    const latestUrl = matches[matches.length - 1]
                    const parsed = new URL(latestUrl)
                    const token = parsed.searchParams.get("u8_token") || parsed.searchParams.get("token")
                    const lang = parsed.searchParams.get("lang")
                    const serverRaw = parsed.searchParams.get("server") || parsed.searchParams.get("server_id")

                    if (token && lang && serverRaw) {
                        allInfos.push({
                            token,
                            lang,
                            serverId: serverRaw,
                            host: parsed.host,
                            apiDomain: `${parsed.protocol}//${parsed.host}`
                        })
                    }
                }
            }
        } catch (e) { }
    }

    if (allInfos.length === 0) {
        sendMsg('No valid log files or URLs found.')
        return false
    }

    return allInfos
}

const POOL_TYPES = [
    'E_CharacterGachaPoolType_Standard',
    'E_CharacterGachaPoolType_Special',
    'E_CharacterGachaPoolType_Beginner',
]

const poolIdMap = {
    'E_CharacterGachaPoolType_Standard': '1',
    'E_CharacterGachaPoolType_Special': '11',
    'E_CharacterGachaPoolType_Beginner': '2'
}

const adaptUserLog = (userLog, poolType) => {
    // timestamp "1769062855302" -> "YYYY-MM-DD HH:mm:ss"
    const date = new Date(parseInt(userLog.gachaTs));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const timeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    return {
        id: userLog.seqId,
        item_id: userLog.charId,
        item_type: "Character", // Assuming all are characters for now based on API endpoint
        name: userLog.charName,
        rank_type: userLog.rarity.toString(),
        time: timeStr,
        gacha_id: userLog.poolId,
        gacha_type: poolIdMap[poolType] || '1',
        count: "1"
    }
}

const fetchCharRecord = async ({ token, lang, serverId, poolType, seqId }) => {
    const url = new URL(`${apiDomain}/api/record/char`)
    url.searchParams.append('token', token)
    url.searchParams.append('lang', lang)
    url.searchParams.append('server_id', serverId)
    url.searchParams.append('pool_type', poolType)
    if (seqId) url.searchParams.append('seq_id', seqId)

    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`API error: ${response.status}`)
    return await response.json()
}

const fetchWeaponPools = async ({ lang, token, serverId }) => {
    const url = new URL(`${apiDomain}/api/record/weapon/pool`)
    url.searchParams.append('lang', lang)
    url.searchParams.append('token', token)
    url.searchParams.append('server_id', serverId)
    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`API error: ${response.status}`)
    return await response.json()
}

const fetchWeaponRecord = async ({ token, lang, serverId, poolId, seqId }) => {
    const url = new URL(`${apiDomain}/api/record/weapon`)
    url.searchParams.append('token', token)
    url.searchParams.append('lang', lang)
    url.searchParams.append('server_id', serverId)
    url.searchParams.append('pool_id', poolId)
    if (seqId) url.searchParams.append('seq_id', seqId)

    const response = await fetch(url.toString())
    if (!response.ok) throw new Error(`API error: ${response.status}`)
    return await response.json()
}

const adaptWeaponLog = (userLog, poolId) => {
    // timestamp "1769062855302" -> "YYYY-MM-DD HH:mm:ss"
    const date = new Date(parseInt(userLog.gachaTs));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const timeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    return {
        id: userLog.seqId,
        item_id: userLog.weaponId,
        item_type: "Weapon",
        name: userLog.weaponName,
        rank_type: userLog.rarity.toString(),
        time: timeStr,
        gacha_id: userLog.poolId,
        gacha_type: poolId,
        count: "1"
    }
}

const getAllRecord = async ({ token, lang, serverId }) => {
    const allRecords = []
    const typeMap = new Map()
    // Populate typeMap for UI
    typeMap.set('1', i18n.parse(i18n.gacha.type['1']))
    typeMap.set('11', i18n.parse(i18n.gacha.type['11']))
    typeMap.set('2', i18n.parse(i18n.gacha.type['2']))
    const result = new Map()

    sendMsg(i18n.parse(i18n.log.fetch.gachaType))
    await sleep(1) // Simulate wait or just nice UX
    sendMsg(i18n.parse(i18n.log.fetch.gachaTypeOk))

    for (const poolType of POOL_TYPES) {
        let hasMore = true
        let lastSeqId = undefined
        const currentPoolRecords = []
        const mappedKey = poolIdMap[poolType]
        const name = typeMap.get(mappedKey)
        let page = 1

        // sendMsg(`Fetching ${poolType}...`) // Removed in favor of i18n logs inside loop

        while (hasMore) {
            if (page % 10 === 0 && page > 0) {
                sendMsg(i18n.parse(i18n.log.fetch.interval, { name, page }))
                await sleep(1)
            } else {
                sendMsg(i18n.parse(i18n.log.fetch.current, { name, page }))
            }

            // Retry logic
            let retryCount = 0
            let success = false
            let res = null

            while (retryCount < 5) {
                try {
                    res = await fetchCharRecord({ token, lang, serverId, poolType, seqId: lastSeqId })

                    // Simple check for auth/error based on response structure
                    // Assuming standard structure: { code: 0, data: { ... } }
                    // Use loose check for code as I don't see it defined.
                    // If res.data is missing, it's likely an error.
                    if (!res || !res.data) {
                        const message = res ? res.message : 'Unknown error'
                        if (message === 'auth key timeout' || (res && res.code === -101)) { // Guessing or covering general case if possible
                            throw new Error('AUTH_TIMEOUT')
                        }
                        throw new Error(`API Error: ${message}`)
                    }

                    success = true
                    break
                } catch (e) {
                    if (e.message === 'AUTH_TIMEOUT' || (res && res.code === -101)) {
                        sendMsg(i18n.log.fetch.authTimeout)
                        throw e
                    }

                    retryCount++
                    if (retryCount >= 5) {
                        sendMsg(i18n.parse(i18n.log.fetch.retryFailed, { name, page }))
                        hasMore = false // Stop fetching this pool
                        break
                    }

                    sendMsg(i18n.parse(i18n.log.fetch.retry, { name, page, count: retryCount }))
                    await sleep(5)
                }
            }

            if (!success) break

            const list = res.data.list
            // If success but list is empty, handle normally?

            // Add slight delay to be safe (original logic had 500ms)
            if (!(page % 10 === 0)) {
                await sleep(0.5)
            }

            if (list && list.length > 0) {
                const adaptedList = list.map(item => adaptUserLog(item, poolType))
                currentPoolRecords.push(...adaptedList)
                lastSeqId = list[list.length - 1].seqId
            }
            hasMore = res.data.hasMore
            page++
        }

        if (currentPoolRecords.length > 0) {
            // Sort by id ascending (oldest first) for UI pity calculation
            currentPoolRecords.sort((a, b) => Number(a.id) - Number(b.id))
            result.set(mappedKey, currentPoolRecords)
        }
    }

    // Weapon Fetching
    let weaponPools = []
    try {
        const wpRes = await fetchWeaponPools({ lang, token, serverId })
        if (wpRes && wpRes.data) {
            weaponPools = wpRes.data
        }
    } catch (e) {
        console.error("Failed to fetch weapon pools", e)
    }

    for (const pool of weaponPools) {
        const poolType = pool.poolId
        const poolName = pool.poolName
        typeMap.set(poolType, poolName)

        let hasMore = true
        let lastSeqId = undefined
        const currentPoolRecords = []
        const mappedKey = poolType
        const name = poolName
        let page = 1

        while (hasMore) {
            if (page % 10 === 0 && page > 0) {
                sendMsg(i18n.parse(i18n.log.fetch.interval, { name, page }))
                await sleep(1)
            } else {
                sendMsg(i18n.parse(i18n.log.fetch.current, { name, page }))
            }

            // Retry logic
            let retryCount = 0
            let success = false
            let res = null

            while (retryCount < 5) {
                try {
                    res = await fetchWeaponRecord({ token, lang, serverId, poolId: poolType, seqId: lastSeqId })

                    if (!res || !res.data) {
                        const message = res ? res.message : 'Unknown error'
                        if (message === 'auth key timeout' || (res && res.code === -101)) {
                            throw new Error('AUTH_TIMEOUT')
                        }
                        throw new Error(`API Error: ${message}`)
                    }

                    success = true
                    break
                } catch (e) {
                    if (e.message === 'AUTH_TIMEOUT' || (res && res.code === -101)) {
                        sendMsg(i18n.log.fetch.authTimeout)
                        throw e
                    }

                    retryCount++
                    if (retryCount >= 5) {
                        sendMsg(i18n.parse(i18n.log.fetch.retryFailed, { name, page }))
                        hasMore = false
                        break
                    }

                    sendMsg(i18n.parse(i18n.log.fetch.retry, { name, page, count: retryCount }))
                    await sleep(5)
                }
            }

            if (!success) break

            const list = res.data.list

            if (!(page % 10 === 0)) {
                await sleep(0.5)
            }

            if (list && list.length > 0) {
                const adaptedList = list.map(item => adaptWeaponLog(item, poolType))
                currentPoolRecords.push(...adaptedList)
                lastSeqId = list[list.length - 1].seqId
            }
            hasMore = res.data.hasMore
            page++
        }

        if (currentPoolRecords.length > 0) {
            currentPoolRecords.sort((a, b) => Number(a.id) - Number(b.id))
            result.set(mappedKey, currentPoolRecords)
        }
    }

    return {
        result,
        typeMap,
        time: Date.now(),
        uid: "EndfieldUser", // Since we don't have UID from this API, we might need to fake it or extract it elsewhere
        lang,
        region: serverId
    }
}

const fetchData = async () => {
    await readData() // Load existing local data

    const allInfos = await extractEfWebview()
    if (!allInfos) return

    for (const info of allInfos) {
        const { token, lang, serverId, host, apiDomain: currentApiDomain } = info

        // Update global apiDomain for this fetch iteration
        apiDomain = currentApiDomain

        // Keep standard Global UID format as EF_serverId, only prefix CN server
        let uid = `EF_${serverId}`
        if (host.includes('hypergryph')) {
            uid = `EF_CN_${serverId}`
        }

        sendMsg(`Processing account: ${uid}`)

        const data = await getAllRecord({ token, lang, serverId })
        data.uid = uid

        const localData = dataMap.get(uid)
        const mergedResult = mergeData(localData, data)
        data.result = mergedResult

        dataMap.set(uid, data)
        await changeCurrent(uid)
        await saveData(data)
    }
}

const readData = async () => {
    await fs.ensureDir(userDataPath)
    const files = await fs.readdir(userDataPath)
    for (let name of files) {
        if (/^gacha-list-.+\.json$/.test(name)) {
            try {
                const data = await readJSON(userDataPath, name)
                if (data.uid) dataMap.set(data.uid, data)
                data.result = new Map(data.result)
                if (data.typeMap) data.typeMap = new Map(data.typeMap)
            } catch (e) { }
        }
    }
}

const changeCurrent = async (uid) => {
    config.current = uid
    await config.save()
}

ipcMain.handle('FETCH_DATA', async () => {
    try {
        await fetchData()
        return { dataMap, current: config.current }
    } catch (e) {
        sendMsg(e.message || e, 'ERROR')
        console.error(e)
    }
})

ipcMain.handle('I18N_DATA', () => {
    return i18n.data
})

ipcMain.handle('LANG_MAP', () => {
    return langMap
})

ipcMain.handle('READ_DATA', async () => {
    await readData()
    return { dataMap, current: config.current }
})

ipcMain.handle('CHANGE_UID', (event, uid) => { changeCurrent(uid) })
ipcMain.handle('GET_CONFIG', () => config.value())
ipcMain.handle('SAVE_CONFIG', (event, [key, value]) => { config[key] = value; config.save() })
ipcMain.handle('OPEN_CACHE_FOLDER', () => { shell.openPath(userDataPath) })

// Exports
exports.getData = () => ({ dataMap, current: config.current })