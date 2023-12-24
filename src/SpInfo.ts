import axios from 'axios'
import { Track, Album, Playlist } from '.'
import {
    logStart,
    checkLinkType,
    getProperURL,
    logItem,
    logEnd,
    logError,
    logSuccess,
    closestGenre,
    logInfo,
    logSubItem
} from './Util'
import { scrapeAlbumInfo, scrapeTrackLyrics } from './Info'
import YTMusic from 'ytmusic-api'
import { LogItemError } from './Queue'

const ytm = new YTMusic()
// Private methods
const get_album_playlist = async (playlistId: string) => {
    // Get the Track ID for every track by scraping from an unlisted Youtube playlist
    let properUrl = `https://m.youtube.com/playlist?list=${playlistId}`
    let resp = await axios.get(properUrl)
    // let resp = await axios.get(properUrl, {headers: { 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; rv:100.0) Gecko/20100101 Firefox/100.0'  }})

    // Scrape json inside script tag
    let ytInitialData = JSON.parse(
        /(?:window\["ytInitialData"\])|(?:ytInitialData) =.*?({.*?});/s.exec(resp.data)?.[1] || '{}'
    )
    let listData =
        ytInitialData.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer
            .contents[0].itemSectionRenderer.contents[0].playlistVideoListRenderer
    return listData.contents
}

/**
 * Get the Track details of the given Spotify Track URL
 * @param {string} url Track URL ex `https://open.spotify.com/track/...`
 * @returns {Track} <Track> if success, `string` if failed
 */
export const getTrack = async (url: string = ''): Promise<Track | String> => {
    try {
        logStart()
        let linkData = checkLinkType(url)
        if (!linkData) return `'${url}' is not a Spotify URL...`
        let properURL = getProperURL(linkData.id, linkData.type)
        let sp = await axios.get(properURL)
        let info: any = /<script id="initial-state" type="text\/plain">(.*?)<\/script>/s.exec(sp.data)

        // Decode the base64 data, then parse as json... info[1] matches the encoded data
        let spData = JSON.parse(Buffer.from(decodeURIComponent(info[1]), 'base64').toString('utf8'))
        // Assign necessary items to a variable
        let spTrk = spData.entities.items[`spotify:${linkData.type}:${linkData.id}`]
        let tags: Track = {
            title: spTrk.name,
            // artist: tempartist,
            artist:
                spTrk.otherArtists.items.length == 0
                    ? spTrk.firstArtist.items[0].profile.name
                    : spTrk.firstArtist.items[0].profile.name +
                      ', ' +
                      spTrk.otherArtists.items.map((i: any) => i?.profile?.name).join(', '),
            // artist: trk.data.entity.artists.map((i: any) => i.name).join(', '),
            // year: spData.data.entity.releaseDate,
            year: `${spTrk.albumOfTrack.date.year}-${spTrk.albumOfTrack.date.month}-${spTrk.albumOfTrack.date.day}`,
            // album: spData.album.name || undefined,
            album: spTrk.albumOfTrack.name,
            id: 'ID',
            // albumCoverURL: spData.data.entity.coverArt.sources[0].url,
            albumCoverURL: spTrk.albumOfTrack.coverArt.sources[0].url,
            //trackNumber: spData.track_number || undefined
            trackNumber: spTrk.trackNumber
        }
        logItem(`Scraping track: ${tags.title} (${tags.artist})`)
        await ytm.initialize()
        let yt_trk = await ytm.searchSongs(`${tags.title} - ${tags.artist}`)
        tags.id = yt_trk[0].videoId
        tags = { ...tags, ...(await scrapeTrackLyrics(tags.artist, tags.title)) }
        logEnd()
        return tags
    } catch (err: any) {
        logEnd()
        msg: return `Caught: ${err.name} | ${err.message}`
    }
}

/**
 * Get the Album details of the given Spotify Album URL
 * @param {string} url Album URL ex `https://open.spotify.com/album/...`
 * @returns {Album} <Album> if success, `string` if failed
 */
export const getAlbum = async (url: string = ''): Promise<Album | string> => {
    try {
        logStart()
        let linkData = checkLinkType(url)
        if (!linkData) throw { name: 'URL Error', message: `'${url}' is not a Spotify URL...` }
        let properURL = getProperURL(linkData.id, linkData.type)
        let sp = await axios.get(properURL)
        let info: any = /<script id="initial-state" type="text\/plain">(.*?)<\/script>/s.exec(sp.data)
        let spData = JSON.parse(Buffer.from(decodeURIComponent(info[1]), 'base64').toString('utf8'))
        // Assign necessary items to a variable
        let spTrk = spData.entities.items[`spotify:${linkData.type}:${linkData.id}`]

        /*
        let artId = spTrk.artists.items[0].uri.split(':').pop()
        let artType = 'artist'
        let artistURL = (0, Util_1.getProperURL)(artId, artType)
        let art = await axios_1.default.get(artistURL)
        let artInfo = /<script id="initial-state" type="text\/plain">(.*?)<\/script>/s.exec(art.data)
        let artData = JSON.parse(Buffer.from(decodeURIComponent(artInfo[1]), 'base64').toString('utf8'))
        console.log(artData.entities.items[`spotify:${artType}:${artId}`])
        */
        let tags: Album = {
            name: spTrk.name,
            artist: spTrk.artists.items.map((e: any) => e.profile.name).join(', '),
            year: `${spTrk.date.year}-${spTrk.date.month}-${spTrk.date.day}`,
            tracks: [],
            albumCoverURL: spTrk.coverArt.sources.pop().url
        }

        let albumData = await scrapeAlbumInfo(tags.artist, tags.name)
        if (albumData.albumCoverURL) tags.albumCoverURL = albumData.albumCoverURL
        if (albumData.genre) tags.genre = albumData.genre
        if (albumData.comment) tags.comment = albumData.comment

        const buildTrackTags = async (title: string, id: string, trackNumber: string) => {
            logSubItem(`Scraping track: ${title}`)
            let t: any = {
                title: title,
                id: id,
                trackNumber: trackNumber
            }
            let lyrics = await scrapeTrackLyrics(tags.artist, title)
            if (lyrics) t.unsynchronisedLyrics = lyrics
            if (tags.genre) t.genre = tags.genre
            if (tags.comment) t.comment = tags.comment

            return t
        }

        // Search the album
        await ytm.initialize()
        let alb = await ytm.searchAlbums(`${tags.artist} - ${tags.name}`)
        let yt_tracks: any | undefined = await get_album_playlist(alb[0].playlistId) // Get track ids from youtube

        if (yt_tracks.length < spTrk.tracks.items.length) {
            logInfo(
                `Youtube has ${yt_tracks.length} tracks for this album but spotify has ${spTrk.tracks.items.length}`
            )
            for (let i = 0; i < yt_tracks.length; i++) {
                tags.tracks.push(
                    await buildTrackTags(
                        spTrk.tracks.items[i].track.name,
                        yt_tracks[i].playlistVideoRenderer.videoId,
                        spTrk.tracks.items[i].track.trackNumber
                    )
                )
            }
        } else {
            for (let i = 0; i < spTrk.tracks.items.length; i++) {
                tags.tracks.push(
                    await buildTrackTags(
                        spTrk.tracks.items[i].track.name,
                        yt_tracks[i].playlistVideoRenderer.videoId,
                        spTrk.tracks.items[i].track.trackNumber
                    )
                )
            }
        }
        logEnd()
        return tags
    } catch (err: any) {
        logError(`Caught: ${err.name} | ${err.message}`)
        logEnd()
        return `Caught: ${err.name} | ${err.message}`
    }
}

/**
 * Get the Playlist details of the given Spotify Playlist URL
 * @param {string} url Playlist URL ex `https://open.spotify.com/playlist/...`
 * @returns {Playlist} <Playlist> if success, `string` if failed
 */
export const getPlaylist = async (url: string = ''): Promise<Playlist | string> => {
    try {
        logStart()
        let linkData = checkLinkType(url)
        if (!linkData) throw { name: 'URL Error', message: `'${url}' is not a Spotify URL...` }
        let properURL = getProperURL(linkData.id, linkData.type)
        let sp = await axios.get(properURL)
        let info: any = /<script id="initial-state" type="text\/plain">(.*?)<\/script>/s.exec(sp.data)
        let spData = JSON.parse(Buffer.from(decodeURIComponent(info[1]), 'base64').toString('utf8'))
        // Assign necessary items to a variable
        let spPlaylist = spData.entities.items[`spotify:${linkData.type}:${linkData.id}`]
        logItem(`Scraping playlist: ${spPlaylist.name}`)
        // Initialize YTMusic
        await ytm.initialize()
        let tags: Playlist = {
            name: spPlaylist.name,
            owner: spPlaylist.ownerV2.data.name,
            description: spPlaylist?.description,
            followerCount: spPlaylist.followers,
            trackCount: spPlaylist.content.totalCount,
            tracks: spPlaylist.content.items.map(async (trk: any) => {
                let trackTitle = trk.itemV2.data.name
                let trackArtists = trk.itemV2.data.artists.items.map((i: any) => i.profile.name).join(', ')
                logSubItem(`Scraping track: ${trackTitle} (${trackArtists})`)
                let yt_trk = await ytm.searchSongs(`${trackTitle} - ${trackArtists}`)
                return {
                    title: trackTitle,
                    artist: trackArtists,
                    // year: Does not exist when scraping
                    album: trk.itemV2.data.albumOfTrack.name,
                    id: yt_trk[0].videoId,
                    albumCoverURL: trk.itemV2.data.albumOfTrack.coverArt.sources[0].url,
                    trackNumber: trk.itemV2.data.trackNumber,
                    ...(await scrapeTrackLyrics(trackArtists, trackTitle))
                }
            }),
            playlistCoverURL: spPlaylist.images.items[0].sources[0].url
        }
        // Search the tracks from youtube concurrently
        await Promise.all(tags.tracks).then((items) => {
            tags.tracks = items
        })
        logEnd()
        return tags
    } catch (err: any) {
        logError(`Caught: ${err.name} | ${err.message}`)
        logEnd()
        return `Caught: ${err.name} | ${err.message}`
    }
}
