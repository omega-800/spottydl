import { Track, Album, Playlist, Results, TmpTrack } from './index'
import { existsSync } from 'fs'
import { isArray } from 'util'
import os from 'os'
import { distance } from 'closest-match'

export const logSuccess = (s: string) => console.log(`\x1b[1;90m\u258c\x1b[0;32m \u2713 ${s}\x1b[0m`)
export const logItem = (s: string) => console.log(`\x1b[1;90m\u258c\x1b[1;35m \u1405 ${s}\x1b[0m`)
export const logSubItem = (s: string) => console.log(`\x1b[1;90m\u258c\x1b[0;35m \u1405\u1405 ${s}\x1b[0m`)
export const logInfo = (s: string) => console.warn(`\x1b[1;90m\u258c\x1b[0;33m \u24d8 ${s}\x1b[0m`)
export const logError = (s: string) => console.error(`\x1b[1;90m\u258c\x1b[0;31m \u20e0 ${s}\x1b[0m`)
export const logStart = () =>
    console.info(`\n\x1b[1;90m\u259b${'\u2580'.repeat(20)}${' \u2580'.repeat(10)}${' \u2598'.repeat(10)}\x1b[0m`)
export const logEnd = () =>
    console.info(`\x1b[1;90m\u2599${'\u2584'.repeat(20)}${' \u2584'.repeat(10)}${' \u2596'.repeat(10)}\x1b[0m\n`)

let illegalChars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
let legalChars = ['﹤', '﹥', '：', '＂', '／', '＼', '｜', '？', '＊']
export const sanitize = (s: string): string => {
    for (let i = 0; i < illegalChars.length; i++) {
        s.replaceAll(illegalChars[i], legalChars[i])
    }
    return s
}

export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).substr(2)
export const fmtAlbumTrack = (item: Track | TmpTrack): string => `${item.trackNumber}. ${sanitize(item.title)}`
export const fmtAlbumPath = (path: string, item: Album): string =>
    `${path}/${sanitize(item.artist)}/${sanitize(item.name)}/`
export const fmtAlbumImgName = (item: Album): string => `${sanitize(item.name)}.png`
export const fmtAlbumImgPath = (path: string, item: Album): string => `${path}/${sanitize(item.artist)}/`
export const fmtSingleTrack = (item: Track): string =>
    `${sanitize(item.title)}${item.artist ? ` - ${sanitize(item.artist)}` : ''}${
        item.album ? ` [${sanitize(item.album)}]` : ''
    }`
export const fmtSinglePath = (path: string, item: Track): string =>
    `${path}${item.artist ? `/${item.artist}` : ''}${item.artist && item.album ? `/${item.album}` : ''}`

export function closestGenre(ar1: string[], ar2: string[]) {
    let diff = Number.MAX_VALUE,
        m = ar1.length,
        n = ar2.length,
        x = 0,
        l = 0,
        r = n - 1,
        res_l,
        res_r

    while (l < m && r >= 0) {
        if (Math.abs(distance(ar1[l], ar2[r]) - x) < diff) {
            res_l = l
            res_r = r
            diff = Math.abs(distance(ar1[l], ar2[r]) - x)
        }
        if (distance(ar1[l], ar2[r]) > x) r--
        else l++
    }
    //console.log('The closest pair is [' + ar1[res_l!] + ', ' + ar2[res_r!] + ']')
    return ar2[res_r!]
}

export const checkLinkType = (link: string) => {
    const reg =
        /^(?:spotify:|(?:https?:\/\/(?:open|play|embed)\.spotify\.com\/))(?:embed|\?uri=spotify:|embed\?uri=spotify:)?\/?(album|track|playlist)(?::|\/)((?:[0-9a-zA-Z]){22})/
    const match = link.match(reg)
    if (match) {
        return {
            type: match[1],
            id: match[2]
        }
    } else {
        throw { name: 'URL Error', message: `'${link}' is not a Spotify URL...` }
    }
}

export const getProperURL = (id: string, type: string) => {
    // UPDATE: Embed link doesn't allow scraping anymore due to new Spotify UI change
    // return `https://embed.spotify.com/?uri=spotify:${type}:${id}`
    return `https://open.spotify.com/${type}/${id}`
}

/**
 * Check the type of the object, can be of type <Track>, <Album> or <Results[]>
 * @param {Track|Album|Playlist|Results[]} ob An object, can be type <Track>, <Album> or <Results[]>
 * @returns {string} "Track" | "Album" | "Playlist" | "Results[]" | "None"
 */
export const checkType = (
    ob: Track | Album | Playlist | Results[]
): 'Track' | 'Album' | 'Playlist' | 'Results[]' | 'None' => {
    if ('title' in ob && 'trackNumber' in ob) {
        return 'Track'
    } else if ('name' in ob && 'tracks' in ob && 'albumCoverURL' in ob) {
        return 'Album'
    } else if ('name' in ob && 'owner' in ob && 'playlistCoverURL' in ob) {
        return 'Playlist'
    } else if ('status' in ob[0] && 'filename' in ob[0] && isArray(ob) == true) {
        return 'Results[]'
    } else {
        return 'None'
    }
}

/**
 * Check the path if it exists, if not then we throw an error
 * @param {string} path A string that specifies the path
 * @returns {string} `path` modified to be absolute
 */
export const checkPath = (path: string) => {
    // First we convert tilda/~ to the home directory
    let c = path.replace(`~`, os.homedir())
    if (!existsSync(c)) {
        throw Error('Filepath:( ' + c + " ) doesn't exist, please specify absolute path")
    } else if (c.slice(-1) != '/') {
        return `${c}/`
    }
    return c
}
