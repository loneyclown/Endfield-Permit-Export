const ExcelJS = require('./module/exceljs.min.js')
const getData = require('./getData').getData
const { app, ipcMain, dialog } = require('electron')
const fs = require('fs-extra')
const path = require('path')
const i18n = require('./i18n')
const { sendMsg } = require('./utils')

function pad(num) {
  return `${num}`.padStart(2, "0");
}

function getTimeString() {
  const d = new Date();
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}${MM}${DD}_${HH}${mm}${ss}`;
}

const addRawSheet = (workbook, data) => {
  const sheet = workbook.addWorksheet('rawData', { views: [{ state: 'frozen', ySplit: 1 }] })
  const excelKeys = ['gacha_id', 'gacha_type', 'id', 'item_id', 'item_type', 'lang', 'name', 'rank_type', 'time', 'uid']
  sheet.columns = excelKeys.map((key, index) => {
    return {
      header: key,
      key,
    }
  })
  const temp = []
  for (let [key, value] of data.result) {
    for (let log of value) {
      const arr = []
      arr.push(log.gacha_id)
      arr.push(log.gacha_type)
      arr.push(log.id)
      arr.push(log.item_id)
      arr.push(log.item_type)
      arr.push(data.lang)
      arr.push(log.name)
      arr.push(log.rank_type)
      arr.push(log.time)
      arr.push(data.uid)
      temp.push(arr)
    }
  }
  sheet.addRows(temp)
}

const start = async () => {
  const { header, customFont, filePrefix, fileType, wish2 } = i18n.excel
  const { dataMap, current } = await getData()
  const data = dataMap.get(current)
  const typeMap = new Map()
  if (i18n.gacha && i18n.gacha.type) {
    for (const key in i18n.gacha.type) {
      typeMap.set(key, i18n.gacha.type[key])
    }
  }
  if (data.typeMap) {
    if (data.typeMap instanceof Map) {
      for (const [key, value] of data.typeMap) {
        typeMap.set(key, value)
      }
    } else {
      for (const key in data.typeMap) {
        typeMap.set(key, data.typeMap[key])
      }
    }
  }
  // https://github.com/sunfkny/genshin-gacha-export-js/blob/main/index.js
  const workbook = new ExcelJS.Workbook()
  for (let [key, value] of data.result) {
    const name = typeMap.get(key) || key
    const sheet = workbook.addWorksheet(name.replace(/[*?:\/\\]/g, ' '), { views: [{ state: 'frozen', ySplit: 1 }] })
    let width = [24, 14, 8, 8, 8, 8, 8]
    if (!data.lang.includes('zh-')) {
      width = [24, 32, 16, 12, 12, 12, 8]
    }
    const excelKeys = ['time', 'name', 'type', 'rank', 'total', 'pity', 'remark']
    sheet.columns = excelKeys.map((key, index) => {
      return {
        header: header[key],
        key,
        width: width[index]
      }
    })
    // get gacha logs
    const logs = value
    let total = 0
    let pity = 0
    const temp = []
    for (let log of logs) {
      const arr = []
      total += 1
      pity += 1
      arr.push(log.time)
      arr.push(log.name)
      arr.push(log.item_type)
      arr.push(log.rank_type)
      arr.push(total)
      arr.push(pity)
      temp.push(arr)
      if (log.rank_type === '6') {
        pity = 0
      }
      // if (key === '301') {
      // if (log.gacha_type === '400') {
      //   log.push(wish2)
      // }
      // }
    }

    sheet.addRows(temp)

    // Calculate dynamic column widths
    const colWidths = excelKeys.map((k, i) => {
      // Start with header width
      let maxLen = 0
      const headerText = header[k] || ''
      for (let j = 0; j < headerText.length; j++) {
        maxLen += headerText.charCodeAt(j) > 128 ? 2 : 1
      }

      // Check each row in temp
      temp.forEach(row => {
        const cellText = String(row[i] || '')
        let currentLen = 0
        for (let j = 0; j < cellText.length; j++) {
          currentLen += cellText.charCodeAt(j) > 128 ? 2 : 1
        }
        if (currentLen > maxLen) maxLen = currentLen
      })
      return maxLen + 2 // Add some padding
    })

    sheet.columns = excelKeys.map((key, index) => {
      return {
        header: header[key],
        key,
        width: colWidths[index]
      }
    })
      // set xlsx hearer style
      ; (["A", "B", "C", "D", "E", "F", "G"]).forEach((v) => {
        sheet.getCell(`${v}1`).border = {
          top: { style: 'thin', color: { argb: 'ffc4c2bf' } },
          left: { style: 'thin', color: { argb: 'ffc4c2bf' } },
          bottom: { style: 'thin', color: { argb: 'ffc4c2bf' } },
          right: { style: 'thin', color: { argb: 'ffc4c2bf' } }
        }
        sheet.getCell(`${v}1`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'ffdbd7d3' },
        }
        sheet.getCell(`${v}1`).font = {
          name: customFont,
          color: { argb: "ff757575" },
          bold: true
        }

      })
    // set xlsx cell style
    logs.forEach((v, i) => {
      ; (["A", "B", "C", "D", "E", "F", "G"]).forEach((c) => {
        sheet.getCell(`${c}${i + 2}`).border = {
          top: { style: 'thin', color: { argb: 'ffc4c2bf' } },
          left: { style: 'thin', color: { argb: 'ffc4c2bf' } },
          bottom: { style: 'thin', color: { argb: 'ffc4c2bf' } },
          right: { style: 'thin', color: { argb: 'ffc4c2bf' } }
        }
        sheet.getCell(`${c}${i + 2}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'ffebebeb' },
        }
        // rare rank background color
        const rankColor = {
          4: "ffa256e1", // 4star
          5: "ffDED500", // 5star
          6: "ffff8040", // 6star
        }
        sheet.getCell(`${c}${i + 2}`).font = {
          name: customFont,
          color: { argb: rankColor[v.rank_type] },
          bold: v.rank_type === "6" || v.rank_type === "5" // Updated bold condition
        }
      })
    })
  }

  addRawSheet(workbook, data)

  const buffer = await workbook.xlsx.writeBuffer()
  const filePath = dialog.showSaveDialogSync({
    defaultPath: path.join(app.getPath('downloads'), `${filePrefix}_${getTimeString()}`),
    filters: [
      { name: fileType, extensions: ['xlsx'] }
    ]
  })
  if (filePath) {
    await fs.ensureFile(filePath)
    await fs.writeFile(filePath, buffer)
  }
}

ipcMain.handle('SAVE_EXCEL', async () => {
  await start()
})