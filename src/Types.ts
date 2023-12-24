export type TrackData = {
    title: string
    artist: string
    year: string
    album: string
    trackNumber: number

    length?: string
    genre?: string
    comment?: {
        language: string
        text: string
    }

    fileUrl?: string
    artistUrl?: string
    subtitle?: string
    language?: string
    mood?: string
    unsynchronisedLyrics?: {
        language: string
        text: string
    }
    image?: {
        mime?: string
        imageBuffer: Buffer
    }
}

export type AlbumData = {
    name: string
    artist: string
    year: string
    tracks: any | null
    albumCoverURL: string
}

export type PlaylistData = {
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

export interface LogItem {
    url: string
    filename: string
}

export interface LogItemSuccess extends LogItem {
    type: 'Track' | 'Playlist' | 'Album'
}

export interface LogItemError extends LogItem {
    mgs: string
}

export interface LogImageError extends LogItemError {
    imageUrl: string
}

export interface LogTrackError extends LogItemError {}

export interface LogAlbumError extends LogItemError {
    tracks: LogTrackError[]
}
