import { Album, Track, Playlist, TmpTrack } from './index'
import {
    checkLinkType,
    getProperURL,
    logEnd,
    logError,
    logInfo,
    logItem,
    logStart,
    logSubItem,
    logSuccess
} from './Util'
import axios from 'axios'
import YTMusic from 'ytmusic-api'
import 'dotenv/config'
import fs from 'fs'
import { closestGenre } from './Util'

const ytm = new YTMusic()

const allGenres = fs.readFileSync('data/mbgenres.txt').toString().split('\n')
const mmReg = /var\s__mxmState\s=\s(.*);<\/script>/
const geniusReg = /data-lyrics-container="true".*?>(.*?)<\/div>/

const musixMatchAlbumInfo = (artist: string, album: string) =>
    `https://www.musixmatch.com/album/${encodeURI(artist.replaceAll(' ', '-'))}/${encodeURI(
        album.replaceAll(' ', '-')
    )}`

const musixMatchTrackInfo = (artist: string, track: string) =>
    `https://www.musixmatch.com/lyrics/${encodeURI(artist.replaceAll(' ', '-'))}/${encodeURI(
        track.replaceAll(' ', '-')
    )}`

const lastfmAlbumInfo = (artist: string, album: string) =>
    `http://ws.audioscrobbler.com/2.0/?method=album.getInfo&artist=${encodeURI(artist.split(',')[0])}&album=${encodeURI(
        album
    )}&api_key=${process.env.LASTFM_KEY}&format=json`

const lastfmTrackInfo = (artist: string, track: string) =>
    `http://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURI(artist.split(',')[0])}&track=${encodeURI(
        track
    )}&api_key=${process.env.LASTFM_KEY}&format=json`

const musicBrainzAlbumInfo = (artist: string, album: string) =>
    `http://musicbrainz.org/ws/2/release-group/?query=${encodeURI(album)}%20AND%20arid:${artist}`

const musicBrainzArtistInfo = (artist: string) => `http://musicbrainz.org/ws/2/artist/?query=${encodeURI(artist)}`

const musicBrainzCoverInfo = (id: string) => `http://coverartarchive.org/release-group/${id}`

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
export const getTrack = async (url: string = ''): Promise<Track | string> => {
    try {
        logStart()
        let linkData = checkLinkType(url)
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
        logError(`Caught: ${err.name} | ${err.message}`)
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
        logItem(`Scraping album: ${tags.name} (${tags.artist})`)

        let genres
        let albumCoverURL
        let mbArtistData = (
            await (
                await fetch(musicBrainzArtistInfo(tags.artist), {
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'AlbumCoverScraper/0.0.1 ( some-email@proton.me )'
                    }
                })
            ).json()
        )?.artists?.[0]
        let mbArtistID = mbArtistData?.id
        if (mbArtistID) {
            let mbAlbumData = await scrapeAlbumCover(mbArtistID, tags.name)
            if (mbAlbumData?.tags) genres = mbAlbumData.tags
            if (mbAlbumData?.img) albumCoverURL = mbAlbumData.img
        }

        if (process.env.LASTFM_KEY && !genres) {
            let lastfmData = await (await fetch(lastfmAlbumInfo(tags.artist, tags.name))).json()
            if (lastfmData.album?.tags)
                genres = lastfmData.album.tags.tag.map((t: { name: string; url: string }) => t.name)
        }

        if (!albumCoverURL || !genres) {
            let mmData = (await (await fetch(musixMatchAlbumInfo(tags.artist, tags.name))).text()).match(mmReg)?.[1]
            if (mmData) {
                let json = JSON.parse(mmData)
                tags.albumCoverURL = json.page.album.coverart800x800.replaceAll('\u002F', '/')
                logSuccess('Successfully scraped higher quality album cover')
                if (!genres) genres = json.page.album.primaryGenres.name.split('\u002F')
            }
        }

        if (genres) {
            logSuccess('Successfully scraped genres')
            tags.genre = closestGenre(genres, allGenres)
            tags.comment = {
                language: 'en',
                text: genres.join(';')
            }
        } else {
            logError("Couldn't scrape genres")
        }

        if (albumCoverURL) tags.albumCoverURL = albumCoverURL

        // Search the album
        await ytm.initialize()
        let alb = await ytm.searchAlbums(`${tags.artist} - ${tags.name}`)
        let yt_tracks: any | undefined = await get_album_playlist(alb[0].playlistId) // Get track ids from youtube

        if (yt_tracks.length < spTrk.tracks.items.length) {
            logInfo(
                `Youtube has ${yt_tracks.length} tracks for this album but spotify has ${spTrk.tracks.items.length}`
            )
            for (let i = 0; i < yt_tracks.length; i++) {
                logSubItem(`Scraping track: ${spTrk.tracks.items[i].track.name}`)
                let t: any = {
                    title: spTrk.tracks.items[i].track.name,
                    id: yt_tracks[i].playlistVideoRenderer.videoId,
                    trackNumber: spTrk.tracks.items[i].track.trackNumber,
                    length: yt_tracks[i].playlistVideoRenderer.lengthText.simpleText
                }
                let lyrics = await scrapeTrackLyrics(tags.artist, spTrk.tracks.items[0].track.name)
                if (lyrics) t.unsynchronisedLyrics = lyrics
                if (genres) {
                    t.genre = tags.genre
                    t.comment = tags.comment
                }
                tags.tracks.push(t)
            }
        } else {
            for (let i = 0; i < spTrk.tracks.items.length; i++) {
                logSubItem(`Scraping track: ${spTrk.tracks.items[i].track.name}`)
                let t: any = {
                    title: spTrk.tracks.items[i].track.name,
                    id: yt_tracks[i].playlistVideoRenderer.videoId,
                    trackNumber: spTrk.tracks.items[i].track.trackNumber
                }
                let lyrics = await scrapeTrackLyrics(tags.artist, spTrk.tracks.items[0].track.name)
                if (lyrics) t.unsynchronisedLyrics = lyrics
                if (genres) {
                    t.genre = tags.genre
                    t.comment = tags.comment
                }
                tags.tracks.push(t)
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

const scrapeTrackLyrics = async (artist: string, title: string) => {
    if (process.env.GENIUS_KEY) {
        const response = await (
            await fetch(
                `https://api.genius.com/search?q=${encodeURI(`${artist} ${title}`)}&access_token=${
                    process.env.GENIUS_KEY
                }`
            )
        ).json()
        let songUrl = response.response.hits.find((s: any) => s.type == 'song').result.url
        const html = await (await fetch(songUrl)).text()
        if (html.match(geniusReg)?.[1]) {
            logSuccess('Successfully scraped lyrics from genius')
            return {
                language: 'en',
                text: ' ' + html.match(geniusReg)![1].replaceAll('<br/>', '\n').replaceAll('&#x27;', "'")
            }
        }
    }
    let mmData = (await (await fetch(musixMatchTrackInfo(artist, title))).text()).match(mmReg)?.[1]
    if (mmData) {
        let json = JSON.parse(mmData).page.lyrics.lyrics
        if (json) {
            logSuccess('Successfully scraped lyrics from musixmatch')
            return {
                language: json.language,
                text: json.body
            }
        }
    }
    logError("Couldn't scrape lysrics")
    return {}
}

const scrapeAlbumCover = async (artist: string, album: string) => {
    let albumInfo = (
        await (
            await fetch(musicBrainzAlbumInfo(artist, album), {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'AlbumCoverScraper/0.0.1 ( some-email@proton.me )'
                }
            })
        ).json()
    )?.['release-groups']?.[0]
    if (!albumInfo) return logError("Couldn't scrape album cover and genre from musicbrainz")
    let tags = albumInfo.tags.map((t: any) => t.name)
    let img = (await (await fetch(musicBrainzCoverInfo(albumInfo.id))).json())?.images[0].image
    if (img) {
        logSuccess('Successfully scraped album cover and genre from musicbrainz')
    }
    return { tags: tags, img: img }
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
