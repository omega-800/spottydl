import fs from 'fs'
import { QueueItem } from './Queue'
import { downloadTrack, downloadAlbum, Track, Album, imgPath, queue, spPath } from '.'
import {
    fmtAlbumPath,
    fmtSinglePath,
    fmtSingleTrack,
    sanitize,
    logError,
    fmtAlbumImgName,
    fmtAlbumImgPath
} from './Util'
import path from 'path'
import { getAlbum, getTrack } from './SpInfo'

export function fromSpJson(path: string) {
    if (!fs.existsSync(path)) return logError(`Given Spotify file doesn't exist: ${path}`)

    const library = JSON.parse(fs.readFileSync(path).toString())
    library.tracks.forEach((track: any) => {
        track = { ...track, title: track.track }
        if (!fs.existsSync(`${spPath}/${fmtSinglePath('spotify_likes', track)}/${fmtSingleTrack(track)}`)) {
            queue.enqueue({
                fromYoutube: false,
                id: track.uri.split(':').pop(),
                folder: 'likes',
                type: 'Track'
            })
        }
    })

    library.albums.forEach((album: any) =>
        queue.enqueue({
            fromYoutube: false,
            id: album.uri.split(':').pop(),
            type: 'Album'
        })
    )
}

export function spDl(item: QueueItem) {
    item.type == 'Album' ? dlSpAlbum(item) : dlSpTrack(item)
}

async function dlSpTrack(item: QueueItem) {
    const url = 'https://open.spotify.com/track/' + item.id
    await getTrack(url).then(async (results) => {
        let itemWithUrl = { ...item, url: url }
        if (typeof results == 'string') return queue.pushToLog(results, 'errors', itemWithUrl)

        let path = `${spPath}/${item.folder ? sanitize(item.folder) + '/' : ''}`

        if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
        downloadTrack(results, path).then((track) => {
            if (typeof track == 'string') {
                queue.pushToLog(track, 'errors', itemWithUrl)
            } else if (track[0].status != 'Success') {
                queue.pushToLog(track[0].status, 'errors', itemWithUrl)
            } else {
                queue.pushToLog(track[0].status, 'finished', itemWithUrl)
            }
        })
    })
}

async function dlSpAlbum(item: QueueItem) {
    let url = 'https://open.spotify.com/album/' + item.id
    await getAlbum(url).then(async (results) => {
        let itemWithUrl = { ...item, url: url }
        if (typeof results == 'string') return queue.pushToLog(results, 'errors', itemWithUrl)

        let albumPath = fmtAlbumPath(spPath, results)
        let imgFolder = fmtAlbumImgPath(imgPath, results)
        let img = path.resolve(__dirname, '..', imgFolder, fmtAlbumImgName(results))
        if (!fs.existsSync(albumPath)) fs.mkdirSync(albumPath, { recursive: true })
        if (!fs.existsSync(imgFolder)) fs.mkdirSync(imgFolder, { recursive: true })
        let album = await downloadAlbum(results, albumPath, img)

        if (typeof album == 'string') {
            queue.pushToLog(album, 'errors', itemWithUrl)
        } else {
            album.filter((t) => t?.status != 'Success').forEach((e) => queue.pushToLog(e.status, 'errors', itemWithUrl))
            album
                .filter((t) => t?.status == 'Success')
                .forEach((s) => queue.pushToLog(s.status, 'finished', itemWithUrl))
            queue.pushToLog(url, 'finished', itemWithUrl)
        }
    })
}
