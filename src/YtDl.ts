import ytpl from 'ytpl'
import csv from 'csvtojson'
import fs from 'fs'
import { QueueItem } from './Queue'
import { Queue } from './Queue'
import { downloadTrack, downloadAlbum, Track, Album } from '.'
import { getTrack, getAlbum } from './Info'
import {
    fmtAlbumPath,
    fmtAlbumTrack,
    fmtSinglePath,
    fmtSingleTrack,
    checkLinkType,
    sanitize,
    logInfo,
    logError,
    logStart,
    logEnd,
    fmtAlbumImgName,
    fmtAlbumImgPath
} from './Util'
import path from 'path'

let logPath = 'data/log/'
let historyPath = 'data/history.csv'
let spPath = 'downloads/spotify'
let ytPath = 'downloads/yt'
let imgPath = 'downloads/img'

async function fromYtPlaylist(id: string) {
    const playlist = await ytpl(id)
    playlist.items.forEach((item) => {
        queue.enqueue({
            id: item.id,
            fromYoutube: true,
            url: item.shortUrl,
            title: item.title,
            trackNumber: item.index,
            artist: item.author.name.replace(/ - Topic$/, ''),
            album: playlist.title.replace(/^Album - /, ''),
            albumCoverURL: playlist.thumbnails[0].url || undefined
        })
    })
}

function fromYtCsv(path: string) {
    if (!fs.existsSync(path)) {
        logError(`Given Youtube file doesn't exist: ${path}`)
        return
    }
    csv()
        .fromFile(path)
        .then((json: any) => {
            json.forEach((item: any) =>
                queue.enqueue({
                    fromYoutube: true,
                    url: item['Song URL'],
                    title: item['Song title'],
                    artist: item['Artist names'],
                    album: item['Album title']
                })
            )
        })
}

function fromSpJson(path: string) {
    if (!fs.existsSync(path)) {
        logError(`Given Spotify file doesn't exist: ${path}`)
        return
    }
    const library = JSON.parse(fs.readFileSync(path).toString())
    library.tracks.forEach((track: any) => {
        track = { ...track, title: track.track }
        if (!fs.existsSync(`${spPath}/${fmtSinglePath('spotify_likes', track)}/${fmtSingleTrack(track)}`)) {
            queue.enqueue({
                fromYoutube: false,
                id: track.uri.split(':').pop(),
                folder: 'likes'
            })
        }
    })

    library.albums.forEach((album: any) => {
        queue.enqueue({
            fromYoutube: false,
            id: album.uri.split(':').pop(),
            isAlbum: true
        })
    })
}

export function ytDl(item: QueueItem) {
    let folder, filename
    if (item.artist && item.trackNumber && item.album) {
        folder = fmtAlbumPath(ytPath, { name: item.album, ...item } as Album)
        filename = fmtAlbumTrack(item as Track)
    } else {
        folder = fmtSinglePath(ytPath, item as Track)
        filename = fmtSingleTrack(item as Track)
    }
    if (!fs.existsSync(`${folder}/${filename}.mp3`)) {
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })

        downloadTrack(item as Track, folder).then((track) => {
            queue.downloading.splice(queue.downloading.findIndex((i) => i.id == item.id))
            if (typeof track == 'string') {
            } else if (track[0].status != 'Success') {
                queue.errors.push({ ...track[0], ...item })
            } else {
                queue.finished.push(track[0])
            }
        })
    } else {
        queue.finished.push(
            queue.downloading.splice(
                queue.downloading.findIndex((i) => i.id == item.id),
                1
            )[0]
        )
    }
}

export function spDl(item: QueueItem) {
    item.isAlbum ? dlSpAlbum(item.id!) : dlSpTrack(item.id!, item?.folder)
}

async function dlSpTrack(id: string, folder?: string) {
    await getTrack('https://open.spotify.com/track/' + id).then(async (results) => {
        results = results as Track
        let path = `${spPath}/${folder ? sanitize(folder) + '/' : ''}`

        if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
        let track = await downloadTrack(results, path)

        queue.downloading.splice(queue.downloading.findIndex((i) => i.id == id))
        if (typeof track == 'string') {
        } else if (track[0].status != 'Success') {
            queue.errors.push({ ...track[0], ...results })
        } else {
            queue.finished.push(track[0])
        }
    })
}

async function dlSpAlbum(id: string) {
    await getAlbum('https://open.spotify.com/album/' + id).then(async (results) => {
        if (typeof results == 'string') {
            queue.errors.push({
                msg: results,
                ...queue.downloading.splice(queue.downloading.findIndex((i) => i.id == id))[0]
            })
            return
        }
        let albumPath = fmtAlbumPath(spPath, results)
        let imgFolder = fmtAlbumImgPath(imgPath, results)
        let img = path.resolve(__dirname, '..', imgFolder, fmtAlbumImgName(results))
        if (!fs.existsSync(albumPath)) fs.mkdirSync(albumPath, { recursive: true })
        if (!fs.existsSync(imgFolder)) fs.mkdirSync(imgFolder, { recursive: true })
        let album = await downloadAlbum(results, albumPath, img, false)
        queue.downloading.splice(queue.downloading.findIndex((i) => i.id == id))
        if (typeof album == 'string') {
            queue.errors.push({ msg: album, ...results })
        } else {
            album.filter((t) => t?.status != 'Success').forEach((e) => queue.errors.push(e))
            album.filter((t) => t?.status == 'Success').forEach((s) => queue.finished.push(s))
            queue.finished.push(album as QueueItem)
        }
    })
}

let logTrash = [0, 0, 0, 0, 0]
const ytReg = /(https:\/\/)?(www|music)?.?youtu(\.be|be\.com)\/(playlist|watch)\?(list|v)=(.*)\/?&?/
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
            try {
                let res = checkLinkType(url)
                if (res.type == 'album') {
                    queue.enqueue({
                        fromYoutube: false,
                        id: res.id,
                        isAlbum: true
                    })
                } else if (res.type == 'track') {
                    queue.enqueue({
                        fromYoutube: false,
                        id: res.id,
                        isAlbum: false
                    })
                } else {
                    logInfo('TODO: implement SP playlist')
                }
            } catch (e) {
                if (ytReg.test(url)) {
                    let match = url.match(ytReg)
                    let type = match?.[5]
                    let id = match?.[6]
                    if (type == 'list' && id) {
                        fromYtPlaylist(id)
                    } else if (type == 'v') {
                        logInfo('TODO: implement YT track')
                    } else {
                        logError('Cannot parse yt URL')
                    }
                } else if (csvReg.test(url)) {
                    fromYtCsv(url)
                } else if (jsonReg.test(url)) {
                    fromSpJson(url)
                } else {
                    logError('URL is not valid')
                }
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
            (queue.downloading.filter((i) => i?.album).length > 0 && queue.downloading.length < 5) ||
            (queue.downloading.filter((i) => i?.album).length == 0 && queue.downloading.length < 20)
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

let now = new Date().toISOString()
logPath = logPath + now
let queue = new Queue(logPath)

if (process.argv.length > 2) {
    startDl(process.argv.slice(2, process.argv.length))
} else {
    startDl()
}
