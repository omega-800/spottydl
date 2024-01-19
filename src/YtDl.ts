import csv from 'csvtojson'
import fs from 'fs'
import { QueueItem } from './Queue'
import { queue } from '.'
import { checkYtLinkType, logError } from './Util'
import ytpl from 'ytpl'

export async function fromYtPlaylist(id: string) {
    let playlist = await ytpl(id)
    return {
        id: id,
        album: playlist.title.replace(/^Album - /, ''),
        albumCoverURL: playlist.thumbnails[0].url || undefined,
        tracks: playlist.items.map((item) => {
            return {
                id: item.id,
                fromYoutube: true,
                type: 'Track',
                url: item.shortUrl,
                title: item.title,
                trackNumber: item.index,
                artist: item.author.name.replace(/ - Topic$/, '')
            }
        })
    }
}

export function fromYtCsv(path: string) {
    if (!fs.existsSync(path)) {
        logError(`Given Youtube file doesn't exist: ${path}`)
        return
    }
    csv()
        .fromFile(path)
        .then((json: any) => json.forEach((item: any) => queue.enqueue(checkYtLinkType(item['Song URL'])!)))
}

export function ytDl(item: QueueItem) {
    let folder, filename
    /*
    if (item.type == 'Playlist') {
        let album = await fromYtPlaylist(item.id)
        folder = fmtAlbumPath(ytPath, { name: album.album, ...album } as Album)
        filename = fmtAlbumTrack(item as Track)
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
        downloadAlbum(item, folder).then((album) => {
            if (typeof album == 'string') {
                queue.pushToLog(album, 'errors', itemWithUrl)
            } else {
                album
                    .filter((t) => t?.status != 'Success')
                    .forEach((e) => queue.pushToLog(e.status, 'errors', itemWithUrl))
                album
                    .filter((t) => t?.status == 'Success')
                    .forEach((s) => queue.pushToLog(s.status, 'finished', itemWithUrl))
                queue.pushToLog(url, 'finished', itemWithUrl)
            }
        })
    } else {
        folder = fmtSinglePath(ytPath, item as Track)
        filename = fmtSingleTrack(item as Track)
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
        downloadTrack(item, folder).then((track) => {
            if (typeof track == 'string') {
                queue.pushToLog(track, 'errors', item)
            } else if (track[0].status != 'Success') {
                queue.pushToLog(track[0].status, 'errors', item)
            } else {
                queue.pushToLog(track[0].status, 'finished', item)
            }
        })
    }*/
}
