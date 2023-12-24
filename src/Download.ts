import { Album, Track, Playlist, Results, checkType, checkPath } from './index'
import NodeID3, { Tags } from 'node-id3'
import ytdl from 'ytdl-core'
import ffmpeg from 'fluent-ffmpeg'
import axios, { AxiosHeaders } from 'axios'
import { unlinkSync, existsSync } from 'fs'
import {
    fmtAlbumTrack,
    fmtSingleTrack,
    logEnd,
    logError,
    logInfo,
    logItem,
    logStart,
    logSubItem,
    logSuccess
} from './Util'
import fs from 'fs'
import sharp from 'sharp'

// Private Methods
const dl_track = async (id: string, filename: string): Promise<boolean> => {
    return await new Promise<boolean>((resolve, reject) => {
        ffmpeg(ytdl(id, { quality: 'highestaudio', filter: 'audioonly' }))
            .audioBitrate(128)
            .save(filename)
            .on('error', (err: any) => {
                logError(`Failed to write file (${filename}): ${err}`)
                try {
                    unlinkSync(filename)
                } catch (err) {
                    logError(`${err}`)
                }
                resolve(false)
            })
            .on('end', () => {
                resolve(true)
            })
    })
}

const dl_album_normal = async (obj: Album, oPath: string, tags: any): Promise<Results[]> => {
    let Results: any = []
    logStart()
    logItem(`Downloading album (slow): ${obj.name} (${obj.artist})`)
    for await (let res of obj.tracks) {
        logSubItem(`Downloading track: ${res.title}`)
        let filename = `${oPath}${fmtAlbumTrack(res)}.mp3`
        let dlt = await dl_track(res.id, filename)
        tags.title = res.title // Tags
        tags.trackNumber = res.trackNumber
        if (res.unsynchronisedLyrics) tags.unsynchronisedLyrics = res.unsynchronisedLyrics
        if (res.genre) tags.genre = res.genre
        if (res.comment) tags.comment = res.comment
        if (dlt) {
            let tagStatus = NodeID3.update(tags, filename)
            if (tagStatus) {
                logSuccess(`Finished: ${filename}`)
                Results.push({ status: 'Success', filename: filename, ...res, ...tags })
            } else {
                logError(`Failed: ${filename} (tags)`)
                Results.push({ status: 'Failed (tags)', filename: filename, ...res, ...tags })
            }
        } else {
            logError(`Failed: ${filename} (stream)`)
            Results.push({ status: 'Failed (stream)', filename: filename, ...res, ...tags })
        }
    }
    logEnd()
    return Results
}

const dl_album_fast = async (obj: Album, oPath: string, tags: Tags): Promise<Results[]> => {
    let Results: any = []
    let i: number = 0
    return await new Promise<Results[]>(async (resolve, reject) => {
        logStart()
        logItem(`Downloading album: ${obj.name} (${obj.artist})`)
        for await (let res of obj.tracks) {
            let filename = `${oPath}${fmtAlbumTrack(res)}.mp3`
            if (existsSync(filename)) {
                Results.push({ status: 'Success', filename: filename, album_name: obj.name, ...res, ...tags })
                logInfo(`Already exists: ${filename}`)
                i++
                if (i == obj.tracks.length) {
                    logEnd()
                    resolve(Results)
                }
            } else {
                logSubItem(`Downloading track: ${res.title}`)
                ffmpeg(ytdl(res.id, { quality: 'highestaudio', filter: 'audioonly' }))
                    .audioBitrate(128)
                    .save(filename)
                    .on('error', (err: any) => {
                        tags.title = res.title // Tags
                        tags.trackNumber = res.trackNumber
                        Results.push({ status: 'Failed (stream)', filename: filename, ...res, ...tags })
                        logError(`Failed to write file (${filename}): ${err}`)
                        try {
                            unlinkSync(filename)
                        } catch (err) {
                            logError(`${err}`)
                        }
                        i++
                        if (i == obj.tracks.length) {
                            logEnd()
                            resolve(Results)
                        }
                        // reject(err)
                    })
                    .on('end', () => {
                        i++
                        tags.title = res.title
                        tags.trackNumber = res.trackNumber
                        if (res.unsynchronisedLyrics) tags.unsynchronisedLyrics = res.unsynchronisedLyrics
                        if (res.genre) tags.genre = res.genre
                        if (res.comment) tags.comment = res.comment
                        let tagStatus = NodeID3.update(tags, filename)
                        if (tagStatus) {
                            logSuccess(`Finished: ${filename}`)
                            Results.push({ status: 'Success', filename: filename, ...res, ...tags })
                        } else {
                            logError(`Failed to add tags: ${filename}`)
                            Results.push({ status: 'Failed (tags)', filename: filename, ...res, ...tags })
                        }
                        if (i == obj.tracks.length) {
                            logEnd()
                            resolve(Results)
                        }
                    })
            }
        }
    })
}
// END

/**
 * Download the Spotify Track, need a <Track> type for first param, the second param is optional
 * @param {Track} obj An object of type <Track>, contains Track details and info
 * @param {string} outputPath - String type, (optional) if not specified the output will be on the current dir
 * @returns {Results[]} <Results[]> if successful, `string` if failed
 */
export const downloadTrack = async (obj: any, outputPath: string = './'): Promise<Results[] | string> => {
    try {
        // Check type and check if file path exists...
        if (checkType(obj) != 'Track') {
            throw Error('obj passed is not of type <Track>')
        }
        let albCover = await axios.get(obj.albumCoverURL, { responseType: 'arraybuffer' })
        let tags: any = {
            title: obj.title,
            artist: obj.artist,
            album: obj.album,
            year: obj.year,
            trackNumber: obj.trackNumber,
            image: {
                imageBuffer: Buffer.from(albCover.data, 'utf-8')
            }
        }
        if (obj.unsynchronisedLyrics) tags.unsynchronisedLyrics = obj.unsynchronisedLyrics
        if (obj.genre) tags.genre = obj.genre
        if (obj.comment) tags.comment = obj.comment
        let filename = `${checkPath(outputPath)}${fmtSingleTrack(obj)}.mp3`
        // EXPERIMENTAL
        if (existsSync(filename)) return [{ status: 'Success', filename: filename, id: obj.id, ...tags }]
        let dlt = await dl_track(obj.id, filename)
        if (dlt) {
            let tagStatus = NodeID3.update(tags, filename)
            if (tagStatus) {
                return [{ status: 'Success', filename: filename, ...tags }]
            } else {
                return [{ status: 'Failed (tags)', filename: filename, ...tags }]
            }
        } else {
            return [{ status: 'Failed (stream)', filename: filename, id: obj.id, ...tags }]
        }
    } catch (err: any) {
        return `Caught: ${err}`
    }
}

/**
 * Download the Spotify Album, need a <Album> type for first param, the second param is optional,
 * function will return an array of <Results>
 * @param {Album} obj An object of type <Album>, contains Album details and info
 * @param {string} outputPath - String type, (optional) if not specified the output will be on the current dir
 * @param {boolean} sync - Boolean type, (optional) can be `true` or `false`. Default (true) is safer/less errors, for slower bandwidths
 * @returns {Results[]} <Results[]> if successful, `string` if failed
 */
export const downloadAlbum = async (
    obj: Album,
    outputPath: string = './',
    imagePath: string = './',
    sync: boolean = true
): Promise<Results[] | string> => {
    try {
        if (checkType(obj) != 'Album') {
            throw Error('obj passed is not of type <Album>')
        }
        let albCover = await axios.get(obj.albumCoverURL, { responseType: 'arraybuffer' })
        let tags: any = {
            artist: obj.artist,
            album: obj.name,
            year: obj.year,
            image: {
                imageBuffer: Buffer.from(albCover.data, 'utf-8')
            }
        }
        let oPath = checkPath(outputPath)

        await dlAlbumCover(imagePath, obj.albumCoverURL)

        if (sync) {
            return await dl_album_normal(obj, oPath, tags)
        } else {
            return await dl_album_fast(obj, oPath, tags)
        }
    } catch (err: any) {
        return `Caught: ${err}`
    }
}

const dlAlbumCover = async (imgPath: string, url: string) => {
    const resp = await axios.get(url, { responseType: 'arraybuffer' })
    fs.writeFile(imgPath, resp.data, async (err) => {
        if (err) logError(`Caught when downloading image: ${err}`)
        logSuccess('Successfully downloaded image')
        try {
            let tmpImg = imgPath.replace(/(.+)(\.[a-z]+)$/, (match, g1, g2) => `${g1}_tmp${g2}`)
            await sharp(imgPath).resize(1080, 1080).toFile(tmpImg)
            await sharp(imgPath)
                .blur(20)
                .resize(1920, 1080)
                .composite([
                    {
                        input: tmpImg,
                        gravity: 'centre'
                    }
                ])
                .toFile(imgPath.replace(/(.+)(\.[a-z]+)$/, (match, g1, g2) => `${g1}_wallpaper${g2}`))
            fs.unlink(tmpImg, (err) => null)
        } catch (e) {
            console.log(e)
        }
    })
}

/**
 * Download the Spotify Playlist, need a <Playlist> type for first param, the second param is optional,
 * function will return an array of <Results>
 * @param {Playlist} obj An object of type <Playlist>, contains Playlist details and info
 * @param {string} outputPath - String type, (optional) if not specified the output will be on the current dir
 * @returns {Results[]} <Results[]> if successful, `string` if failed
 */
export const downloadPlaylist = async (obj: Playlist, outputPath: string = './'): Promise<Results[] | string> => {
    try {
        let Results: any = []
        if (checkType(obj) != 'Playlist') {
            throw Error('obj passed is not of type <Playlist>')
        }

        let oPath = checkPath(outputPath)
        for await (let res of obj.tracks) {
            let filename = `${oPath}${fmtSingleTrack(res)}.mp3`
            let dlt = await dl_track(res.id, filename)
            let albCover = await axios.get(res.albumCoverURL, { responseType: 'arraybuffer' })
            let tags: any = {
                title: res.title,
                artist: res.artist,
                album: res.album,
                // year: 0, // Year tag doesn't exist when scraping
                trackNumber: res.trackNumber,
                image: {
                    imageBuffer: Buffer.from(albCover.data, 'utf-8')
                }
            }
            if (res.unsynchronisedLyrics) tags.unsynchronisedLyrics = res.unsynchronisedLyrics
            if (res.genre) tags.genre = res.genre
            if (res.comment) tags.comment = res.comment
            if (dlt) {
                let tagStatus = NodeID3.update(tags, filename)
                if (tagStatus) {
                    logSuccess(`Finished: ${filename}`)
                    Results.push({ status: 'Success', filename: filename, ...tags })
                } else {
                    logError(`Failed: ${filename} (tags)`)
                    Results.push({ status: 'Failed (tags)', filename: filename, ...tags })
                }
            } else {
                logError(`Failed: ${filename} (stream)`)
                Results.push({ status: 'Failed (stream)', filename: filename, id: res.id, ...tags })
            }
        }

        return Results
    } catch (err: any) {
        return `Caught: ${err}`
    }
}

/**
 * Retries the download process if there are errors. Only use this after `downloadTrack()` or `downloadAlbum()` methods
 * checks for failed downloads then tries again, returns <Results[]> object array
 * @param {Results[]} Info An object of type <Results[]>, contains an array of results
 * @returns {Results[]} <Results[]> array if the download process is successful, `true` if there are no errors and `false` if an error happened.
 */
export const retryDownload = async (Info: Results[]): Promise<Results[] | boolean> => {
    try {
        if (checkType(Info) != 'Results[]') {
            throw Error('obj passed is not of type <Results[]>')
        }
        // Filter the results
        let failedStream = Info.filter((i) => i.status == 'Failed (stream)' || i.status == 'Failed (tags)')
        if (failedStream.length == 0) {
            return true
        }
        let Results: any = []
        failedStream.map(async (i: any) => {
            if (i.status == 'Failed (stream)') {
                let dlt = await dl_track(i.id, i.filename)
                if (dlt) {
                    let tagStatus = NodeID3.update(i.tags, i.filename)
                    if (tagStatus) {
                        Results.push({ status: 'Success', filename: i.filename, ...i.tags })
                    } else {
                        Results.push({ status: 'Failed (tags)', filename: i.filename, ...i.tags })
                    }
                } else {
                    Results.push({ status: 'Failed (stream)', filename: i.filename, id: i.id, ...i.tags })
                }
            } else if (i.status == 'Failed (tags)') {
                let tagStatus = NodeID3.update(i.tags, i.filename)
                if (tagStatus) {
                    Results.push({ status: 'Success', filename: i.filename, ...i.tags })
                } else {
                    Results.push({ status: 'Failed (tags)', filename: i.filename, ...i.tags })
                }
            }
        })
        return Results
    } catch (err) {
        logError(`Caught: ${err}`)
        return false
    }
}
