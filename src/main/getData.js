const fs = require('fs-extra')
const path = require('path')
const { app, ipcMain, shell } = require('electron')
const { sendMsg, readJSON, saveJSON, detectLocale, userDataPath, localIp, langMap } = require('./utils')
const config = require('./config')
const i18n = require('./i18n')
const { mergeData } = require('./utils/mergeData')
const gachaTypeRaw = require('../gachaType.json')
const fetch = require('electron-fetch').default

const dataMap = new Map()
let apiDomain = 'https://ef-webview.gryphline.com'

const saveData = async (data) => {
    const obj = Object.assign({}, data)
    obj.result = [...obj.result]
    await config.save()
    await saveJSON(`gacha-list-${data.uid}.json`, obj)
}

const extractEfWebview = async () => {
    const homeDir = app.getPath('home')
    const logPath = path.join(
        homeDir,
        "AppData",
        "LocalLow",
        "Gryphline",
        "Endfield",
        "sdklogs",
        "HGWebview.log"
    )

    try {
        const content = await fs.readFile(logPath, "utf-8")
        const regex = /https:\/\/ef-webview\.gryphline\.com[^\s"'<>]*u8_token=[^&\s"'<>]+[^\s"'<>]*/g
        const matches = content.match(regex)

        if (!matches || matches.length === 0) {
            sendMsg('Log file found but no URL matches.')
            return false
        }

        const latestUrl = matches[matches.length - 1]
        const parsed = new URL(latestUrl)

        const token = parsed.searchParams.get("u8_token")
        const lang = parsed.searchParams.get("lang")
        const serverRaw = parsed.searchParams.get("server")

        if (!token || !lang || !serverRaw) {
            sendMsg('URL found but content missing.')
            return false
        }

        return { token, lang, serverId: serverRaw }
    } catch (e) {
        sendMsg('Log file not found or unreadable.')
        return false
    }
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

const getAllRecord = async ({ token, lang, serverId }) => {
    const allRecords = []
    const typeMap = new Map()
    // Populate typeMap for UI
    typeMap.set('1', 'Standard Search')
    typeMap.set('11', 'Event Search')
    typeMap.set('2', 'Beginner Search')

    const result = new Map()

    for (const poolType of POOL_TYPES) {
        let hasMore = true
        let lastSeqId = undefined
        const currentPoolRecords = []
        const mappedKey = poolIdMap[poolType]

        sendMsg(`Fetching ${poolType}...`)

        while (hasMore) {
            // Add slight delay to be safe
            await new Promise(r => setTimeout(r, 500))

            const res = await fetchCharRecord({ token, lang, serverId, poolType, seqId: lastSeqId })
            const list = res.data.list

            if (list && list.length > 0) {
                const adaptedList = list.map(item => adaptUserLog(item, poolType))
                currentPoolRecords.push(...adaptedList)
                lastSeqId = list[list.length - 1].seqId
            }
            hasMore = res.data.hasMore
        }

        if (currentPoolRecords.length > 0) {
            // Sort by id ascending (oldest first) for UI pity calculation
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

    const info = await extractEfWebview()
    if (!info) return

    const { token, lang, serverId } = info

    // We need a UID. The API doesn't seem to return it in the record list? 
    // Assuming single account for now or we might need another API call.
    // Using a placeholder UID based on serverId if not available.
    const uid = `EF_${serverId}`

    const data = await getAllRecord({ token, lang, serverId })
    data.uid = uid

    const localData = dataMap.get(uid)
    const mergedResult = mergeData(localData, data)
    data.result = mergedResult

    dataMap.set(uid, data)
    await changeCurrent(uid)
    await saveData(data)
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