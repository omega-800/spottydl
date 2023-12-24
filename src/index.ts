export { getAlbum, getTrack, getPlaylist } from './Info'
export { downloadAlbum, downloadTrack, downloadPlaylist, retryDownload } from './Download'
export { checkPath, checkType } from './Util'

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
