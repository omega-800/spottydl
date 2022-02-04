import { Album, Track } from './index'
import axios from 'axios'
import YTMusic from 'ytmusic-api'
const { parse } = require('himalaya')
const ytm = new YTMusic()

/**
 * Get the Track details of the given Spotify Track URL
 * @param {string} url Track URL ex `https://open.spotify.com/track/...`
 * @returns {Track} <Track> if success, `string` if failed
 */
export const getTrack = async (url: string = ''): Promise<Track | string> => {
    try {
        // Check if url is a track URL
        let spURL = url.split('/')
        if (spURL[3] != 'track') {
            throw { name: 'URL Error', message: `'${url}' is not a Spotify Track URL...` }
        }
        let properURL = `http://embed.spotify.com/?uri=spotify:${spURL[3]}:${spURL[4]}`
        let sp = await axios.get(properURL)
        let spData = JSON.parse(decodeURIComponent(parse(sp.data)[2].children[3].children[3].children[0].content))

        // Return tags
        let tags: Track = {
            title: spData.name,
            artist: spData.artists.map((i: any) => i.name).join(', '),
            year: spData.album.release_date,
            album: spData.album.name,
            id: 'ID',
            albumCoverURL: spData.album.images[0].url,
            trackNumber: spData.track_number
        }

        await ytm.initialize()
        let trk = await ytm.search(`${tags.title} - ${tags.artist}`, 'SONG')
        tags.id = trk[0].videoId

        return tags
    } catch (err: any) {
        return `Caught: ${err.name} | ${err.message}`
    }
}

/**
 * Get the Album details of the given Spotify Album URL
 * @param {string} url Album URL ex `https://open.spotify.com/album/...`
 * @returns {Album} <Album> if success, `string` if failed
 */
export const getAlbum = async (url: string = ''): Promise<Album | string> => {
    try {
        // Check if url is a track URL
        let spURL = url.split('/')
        if (spURL[3] != 'album') {
            throw { name: 'URL Error', message: `'${url}' is not a Spotify Album URL...` }
        }
        let properURL = `http://embed.spotify.com/?uri=spotify:${spURL[3]}:${spURL[4]}`
        let sp = await axios.get(properURL)
        let spData = JSON.parse(decodeURIComponent(parse(sp.data)[2].children[3].children[3].children[0].content))
        let tags: Album = {
            name: spData.name,
            artist: spData.artists.map((e: any) => e.name).join(', '),
            year: spData.release_date,
            tracks: [],
            albumCoverURL: spData.images[0].url
        }
        // Search for album in youtube
        await ytm.initialize()
        let alb = await ytm.search(`${tags.artist} - ${tags.name}`, 'ALBUM')
        let albData = await ytm.getAlbum(alb[0].albumId)
        albData.songs.map((i: any, n: number) =>
            tags.tracks.push({
                name: spData.tracks.items[n].name,
                id: i.videoId,
                trackNumber: spData.tracks.items[n].track_number
            })
        )
        return tags
    } catch (err: any) {
        return `Caught: ${err.name} | ${err.message}`
    }
}

// UNDER CONSTRUCTION THIS METHOD IS NOT THE BEST SOLUTION
export const getAlbExp = async (url: string = '') => {
    try {
        // Check if url is a track URL
        let spURL = url.split('/')
        if (spURL[3] != 'album') {
            throw { name: 'URL Error', message: `'${url}' is not a Spotify Album URL...` }
        }
        let properURL = `http://embed.spotify.com/?uri=spotify:${spURL[3]}:${spURL[4]}`
        let sp = await axios.get(properURL)
        let spData = JSON.parse(decodeURIComponent(parse(sp.data)[2].children[3].children[3].children[0].content))
        let tags: Album = {
            name: spData.name, 
            artist: spData.artists.map((e: any) => e.name).join(', '), 
            year: spData.release_date, 
            tracks: [], 
            albumCoverURL: spData.images[0].url 
        } 
        // // Search the album and get all songs from artist then filter by album
        await ytm.initialize();

        let alb = await ytm.search(`${spData.artists[0].name} - ${spData.name}`, "ALBUM")
        // let albData = await ytm.getAlbum(alb[0].albumId);
        let sng = await ytm.getArtistSongs(`${alb[0].artists[0].artistId}`);
        
        // TEST get the playlist ID
        console.log(alb[0].playlistId)

        // let trackNames = spData.tracks.items.map((i: any) => i.name);
        // console.log(trackNames)
        // console.log(spData.tracks.items)

        // get all songs from the album
        // MAIN WORKS but some errors
        let indexes: any = [];
        // let data = sng.map((i: any) => {
        //     for (let k = 0; k < spData.tracks.items.length; k++) {
        //         if (spData.tracks.items[k].name.toUpperCase().indexOf(i.name.toUpperCase()) != -1) {
        //             if (indexes.includes(k)){
        //                 continue;
        //             }
        //             indexes.push(k)
        //             return {
        //                 name: spData.tracks.items[k].name,
        //                 id: i.videoId,
        //                 trackNumber: spData.tracks.items[k].track_number,
        //             }
        //         }  
        //     }
        // })
        let temp: any = [];
        for (let i = 0; i < sng.length; i++) {
            for (let k = 0; k < spData.tracks.items.length; k++) {
                if (spData.tracks.items[k].name.toUpperCase().indexOf(sng[i].name.toUpperCase()) != -1 ) {
                    if (indexes.includes(k)){
                        continue;
                    }
                    indexes.push(k)
                    temp.push({
                        name: spData.tracks.items[k].name,
                        id: sng[i].videoId,
                        trackNumber: spData.tracks.items[k].track_number,
                    })
                    break;
                }  
            }
        }

        // Sort the tracks in order by their trackNumber
        tags.tracks = temp.sort((a: any, b: any) => {
            return a.trackNumber - b.trackNumber
        })
        // MAIN
        // tags.tracks = data.sort((a: any, b: any) => {
        //     return a.trackNumber - b.trackNumber
        // })
       
        
        // let filtered = data.map(i => {
        // })
        // console.log(filtered)

        // // INORDERED
        // let filteredArray: any = sng.map((i: any) => {
        //     if (trackNames.includes(i.name.toUpperCase())) {
        //         return {
        //             name: i.name,
        //             id: i.videoId,
        //             duration: i.duration,
        //         }
        //     }
        // })
        // console.log(filteredArray)
        // SORT TEST
        // let sorted: any = spData.tracks.items.map((i: any, n: number) => {
        //     if (i.name.toUpperCase() == filteredArray[n].name.toUpperCase()) {
        //         return filteredArray[n]
        //     }
        // })
        // console.log(sorted)
        // console.log(filteredArray)
        // Validate every duration
        // for (let i = 0; i < spData.tracks.items.length; i++) {
        //     if (Math.trunc(spData.tracks.items[i].duration_ms / 1000) == filteredArray[i].duration){
        //         filteredArray[i].name = spData.tracks.items[i].name
        //         filteredArray[i].trackNumber = spData.tracks.items[i].track_number
        //     } 
        // }
    
        // console.log(filteredArray)
        
        // turn them in order and change name using spotify
        // console.log(data)
        // let info = data.map((i: any, n:number) => {
        //     return {
        //         name: trackNames[n],
        //         id: i.videoId,
        //         duration: i.duration
        //     }
        // })
        // console.log(info) 
        /* spData.tracks.items.forEach((i: any) => { */
        /*     tags.tracks.push({ */
        /*         name: i.name, */
        /*         id: k.videoId, */
        /*         trackNumber: i.track_number */
        /*     }) */
        /* }) */

        /* console.log(data) */
        /* for (let k = 0; k < spData.tracks.items.length; k++) { */
        /*     for (let i = 0; i < sng.length; i++){ */
        /*         if (sng[i].name.toUpperCase() == spData.tracks.items[k].name.toUpperCase()) { */
        /*             tags.tracks.push({ */
        /*                 name: spData.tracks.items[k].name, */
        /*                 id: sng[i].videoId, */
        /*                 trackNumber: spData.tracks.items[k].track_number, */
        /*             }) */
        /*         } */
        /*     } */
        /* } */
        // EXPERIMENTAL
        // First we push the trackNumber and the names no wait actually lets just place it first in a var
        // let stuffer = spData.tracks.items.map((i: any) => {
        //     return {
        //         name: i.name,
        //         trackNumber: i.track_number
        //     }
        // }) 
        // console.log(stuffer)
        // /* for (let i = 0; i < sng.length; i++) { */
        //     /* stuffer.forEach((k:any, n: number) => { */
        //         /* if (k.name.toUpperCase() == sng[i].name.toUpperCase()){ */
        //         /*     stuffer[n].id = sng[i].videoId */
        //         /* } */
        //     /* }) */                        
        // /* } */
        // for (let k = 0; k < stuffer.length; k++) {
        //     for (let i = 0; i < sng.length; i++) {
        //         if (stuffer[k].name.toUpperCase().indexOf(sng[i].name.toUpperCase()) != -1) {
        //             stuffer[k].id = sng[i].videoId
        //         } 
        //     }
        // }
        // let k = 0;
        // sng.forEach((i: any) => {
        //     if (trackNames.includes(i.name.toUpperCase())) {
        //         stuffer[k].id = i.videoId
        //         k++;
        //     }
        // })
        
        // console.log(stuffer)
        // END

        return tags;
    } catch (err: any) {
        return `Caught: ${err.name} | ${err.message}`
    }
}

export const _getAlbExp = async (id: string = '') => {
    let properUrl = `https://youtube.com/playlist?list=${id}`
    let resp = await axios.get(properUrl);
    let yt = parse(resp.data)[1].children[1].children.filter((i: any)=> {
        return i.tagName = 'script';
    })[15].children[0].content;
    // USE SUBSTR
    let ytdata = JSON.parse(yt.substr(20, yt.length - 1 ))
    // console.log(ytdata.length)
    //
    console.log(ytdata)
    console.log("~~~~~~~~~~~~~~~~~~~")
    // console.log(ytdata[15])
}

