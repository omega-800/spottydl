import { logError, logItem, logSuccess } from './Util'
import 'dotenv/config'
import fs from 'fs'
import { closestGenre } from './Util'

const allGenres = fs.readFileSync('data/mbgenres.txt').toString().split('\n')
const mmReg = /var\s__mxmState\s=\s(.*);<\/script>/
const geniusReg = /data-lyrics-container="true".*?>(.*?)<\/div>/

const musixMatchAlbumURL = (artist: string, album: string) =>
    `https://www.musixmatch.com/album/${encodeURI(artist.replaceAll(' ', '-'))}/${encodeURI(
        album.replaceAll(' ', '-')
    )}`

const musixMatchTrackURL = (artist: string, track: string) =>
    `https://www.musixmatch.com/lyrics/${encodeURI(artist.replaceAll(' ', '-'))}/${encodeURI(
        track.replaceAll(' ', '-')
    )}`

const lastfmAlbumURL = (artist: string, album: string) =>
    `http://ws.audioscrobbler.com/2.0/?method=album.getInfo&artist=${encodeURI(artist.split(',')[0])}&album=${encodeURI(
        album
    )}&api_key=${process.env.LASTFM_KEY}&format=json`

const lastfmTrackURL = (artist: string, track: string) =>
    `http://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURI(artist.split(',')[0])}&track=${encodeURI(
        track
    )}&api_key=${process.env.LASTFM_KEY}&format=json`

const musicBrainzAlbumURL = (artist: string, album: string) =>
    `http://musicbrainz.org/ws/2/release-group/?query=${encodeURI(album)}%20AND%20arid:${artist}`

const musicBrainzArtistURL = (artist: string) => `http://musicbrainz.org/ws/2/artist/?query=${encodeURI(artist)}`

const musicBrainzCoverURL = (id: string) => `http://coverartarchive.org/release-group/${id}`
const geniusLyricsURL = (artist: string, title: string) =>
    `https://api.genius.com/search?q=${encodeURI(`${artist} ${title}`)}&access_token=${process.env.GENIUS_KEY}`

export const scrapeAlbumInfo = async (artist: string, album: string) => {
    logItem(`Scraping album: ${album} (${artist})`)

    let genres, comment, genre, albumCoverURL

    let mbData = await scrapeMusicBrainzAlbum(artist, album)
    if (mbData?.genres) genres = mbData.genres
    if (mbData?.albumCoverURL) albumCoverURL = mbData.albumCoverURL

    if (process.env.LASTFM_KEY && !genres) {
        let lastfmData = await (await fetch(lastfmAlbumURL(artist, album))).json()
        if (lastfmData.album?.tags?.tag) {
            logSuccess('Successfully scraped genres from lastFM')
            genres = lastfmData.album.tags.tag.map((t: { name: string; url: string }) => t.name)
        }
    }

    if (!albumCoverURL || !genres) {
        let mmData = (await (await fetch(musixMatchAlbumURL(artist, album))).text()).match(mmReg)?.[1]
        if (mmData) {
            let json = JSON.parse(mmData)?.page?.album
            if (!albumCoverURL && json.coverart800x800) {
                logSuccess('Successfully scraped album cover from musixMatch')
                albumCoverURL = json.coverart800x800.replaceAll('\u002F', '/')
            }
            if (!genres && json.primaryGenres.name) {
                logSuccess('Successfully scraped genres from musixMatch')
                genres = json.primaryGenres.name.split('\u002F')
            }
        }
    }

    if (genres) {
        genre = closestGenre(genres, allGenres)
        comment = {
            language: 'en',
            text: genres.join(';')
        }
    } else {
        logError("Couldn't scrape genres")
    }
    return {
        genre: genre,
        comment: comment,
        albumCoverURL: albumCoverURL
    }
}

export const scrapeTrackLyrics = async (artist: string, title: string) => {
    if (process.env.GENIUS_KEY) {
        const response = await (await fetch(geniusLyricsURL(artist, title))).json()
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
    let mmData = (await (await fetch(musixMatchTrackURL(artist, title))).text()).match(mmReg)?.[1]
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

export const scrapeMusicBrainzAlbum = async (artist: string, album: string) => {
    let mbArtistData = (
        await (
            await fetch(musicBrainzArtistURL(artist), {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'AlbumCoverScraper/0.0.1 ( some-email@proton.me )'
                }
            })
        ).json()
    )?.artists?.[0]

    let mbArtistID = mbArtistData?.id
    if (!mbArtistID) return logError("Couldn't scrape album cover and genre from musicbrainz (no id found)")

    let albumInfo = (
        await (
            await fetch(musicBrainzAlbumURL(artist, album), {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'AlbumCoverScraper/0.0.1 ( some-email@proton.me )'
                }
            })
        ).json()
    )?.['release-groups']?.[0]

    if (!albumInfo) return logError("Couldn't scrape album cover and genre from musicbrainz (with id)")

    let tags = albumInfo.tags.map((t: any) => t.name)
    if (tags) logSuccess('Successfully scraped genre from musicbrainz')
    let img = (await (await fetch(musicBrainzCoverURL(albumInfo.id))).json())?.images[0].image
    if (img) logSuccess('Successfully scraped album cover from musicbrainz')

    return { genres: tags, albumCoverURL: img }
}
