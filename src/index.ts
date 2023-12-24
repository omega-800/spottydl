import fs from 'fs'
import { Queue } from './Queue'
import { checkLinkType, logInfo, logError, logStart, logEnd, checkYtLinkType } from './Util'
import { fromSpJson } from './SpDl'
import { fromYtCsv } from './YtDl'

export { downloadAlbum, downloadTrack, downloadPlaylist, retryDownload } from './Download'
export { checkPath, checkType } from './Util'

let now = new Date().toISOString()
export const logPath = 'data/log/' + now
export const historyPath = 'data/history.csv'
export const spPath = 'downloads/spotify'
export const ytPath = 'downloads/yt'
export const imgPath = 'downloads/img'

export const queue = new Queue(logPath)

let logTrash = [0, 0, 0, 0, 0]
const csvReg = /.+\.csv$/
const jsonReg = /.+\.json$/

function startDl(urls?: string[]) {
    if (!process.env.LASTFM_KEY) logError("env.LASTFM_KEY isn't set: only limited metadata can be scraped")
    if (!process.env.GENIUS_KEY) logError("env.GENIUS_KEY isn't set: only limited lyrics can be scraped")
    fs.mkdirSync(logPath, { recursive: true })
    if (!fs.existsSync(historyPath)) fs.writeFileSync(historyPath, 'Date;URL')
    if (urls) {
        logStart()
        logInfo('badabingbadaboom')
        logEnd()
        urls.forEach((url) => {
            if (fs.readFileSync(historyPath).toString().split(';').pop() != url)
                fs.appendFileSync(historyPath, `\n${now};${url}`)
            let spMatch = checkLinkType(url)
            let ytMatch = checkYtLinkType(url)
            if (spMatch) {
                if (spMatch.type == 'Playlist') {
                    logInfo('TODO: implement SP playlist')
                } else {
                    queue.enqueue(spMatch)
                }
            } else if (ytMatch) {
                if (ytMatch.type == 'Playlist') {
                    queue.enqueue(ytMatch)
                } else {
                    logInfo('TODO: implement YT track')
                }
            } else if (csvReg.test(url)) {
                fromYtCsv(url)
            } else if (jsonReg.test(url)) {
                fromSpJson(url)
            } else {
                logError('URL is not valid')
            }
        })
    } else {
        logError('No params received')
        // hardcode stuff if u want or prompt
    }

    let timeout = setInterval(function () {
        if (queue.queue.length == 0) {
            if (
                queue.downloading.length == 0 &&
                (queue.finished.length > 0 || queue.errors.length > 0 || queue.lost.length > 0)
            ) {
                queue.checkLoss()
                //checkFiles();
                clearInterval(timeout)
            }
        } else if (
            (queue.downloading.filter((i) => i.type != 'Track').length > 0 && queue.downloading.length < 5) ||
            (queue.downloading.filter((i) => i.type != 'Track').length == 0 && queue.downloading.length < 20)
        ) {
            queue.downloadNext()
        } else {
            let log = [
                queue.queue.length,
                queue.downloading.length,
                queue.finished.length,
                queue.errors.length,
                queue.lost.length
            ]
            if (log[2] != logTrash[2]) {
                logInfo(`queue: ${log[0]} downloading: ${log[1]} finished: ${log[2]} errors: ${log[3]} lost: ${log[4]}`)
                logTrash = log
            }
        }
    }, 100)
}

if (process.argv.length > 2) {
    startDl(process.argv.slice(2, process.argv.length))
} else {
    startDl()
}

export type ItemType = 'Track' | 'Playlist' | 'Album'

export type Track = {
    title: string
    artist: string
    year: string
    album: string
    id: string | any
    albumCoverURL: string
    trackNumber: number
}

export type Album = {
    name: string
    artist: string
    year: string
    tracks: TmpTrack[]
    albumCoverURL: string

    genre?: string
    comment?: {
        language: string
        text: string
    }
}

export type TmpTrack = {
    title: string
    id: string
    trackNumber: string

    length?: string
    unsynchronisedLyrics?: {
        language: string
        text: string
    }
    genre?: string
    comment?: {
        language: string
        text: string
    }
}

export type Playlist = {
    name: string
    owner: string
    description: string | undefined
    followerCount: number
    trackCount: number
    tracks: any | null
    playlistCoverURL: string
}

export interface Results {
    status: 'Success' | 'Failed (stream)' | 'Failed (tags)'
    filename: string
    id?: string
    tags?: object
}
