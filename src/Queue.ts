import fs from 'fs'
import { logEnd, logError, logInfo, logStart, uid } from './Util'
import { ytDl } from './YtDl'
import { spDl } from './SpDl'
import { ItemType, queue } from '.'

export interface QueueItem {
    id: string
    type: ItemType
    fromYoutube: boolean
    folder?: string
}

export interface LogItem {
    id: string
    url?: string
    filename?: string
}

export interface LogItemSuccess extends LogItem {
    type: ItemType
}

export interface LogItemError extends LogItem {
    msg: string
}

export interface LogImageError extends LogItemError {
    imageUrl: string
}

export interface LogTrackError extends LogItemError {}

export interface LogAlbumError extends LogItemError {
    tracks: LogTrackError[]
}

export class Queue {
    logPath
    all: QueueItem[] = []
    queue: QueueItem[] = []
    downloading: QueueItem[] = []
    finished: LogItem[] = []
    errors: LogItemError[] = []
    lost: LogItem[] = []

    constructor(logPath: string = '../data/log/') {
        this.logPath = logPath
    }

    pushToLog(msg: string, type: 'finished' | 'errors' | 'lost', ...args: QueueItem[] | LogItem[]) {
        if (type != 'lost')
            args.forEach((a) =>
                this[type].push({
                    ...this.downloading.splice(
                        this.downloading.findIndex((q) => q.id == a.id),
                        1
                    )[0],
                    msg: msg
                })
            )
        let filename = `${this.logPath}/${type}.json`
        //console.log(type, item)
        if (!fs.existsSync(filename)) fs.writeFileSync(filename, '[')
        fs.readFile(filename, (err, data) =>
            fs.appendFileSync(
                filename,
                JSON.stringify(
                    args.reduce((str, a) => `${str},${a}`, ''),
                    null,
                    4
                ) + ','
            )
        )
    }

    checkLoss() {
        logStart()
        let loss = []
        let n = 0
        if (this.all.length > this.finished.length + this.finished.length) {
            logError('some songs may have gone missing')
            this.pushToLog(
                "where did it go? i don't know :(",
                'lost',
                ...this.all.filter(
                    (a) =>
                        this.finished.findIndex((f) => f.id == a.id) < 0 && this.errors.findIndex((e) => e.id == a.id)
                )
            )
        } else {
            logInfo('finished without loss')
        }
        logEnd()
    }

    enqueue(item: QueueItem) {
        this.all.push(item)
        this.queue.push(item)
    }

    downloadNext() {
        let item = this.queue.pop()
        if (!item) return
        this.downloading.push(item)
        item.fromYoutube ? ytDl(item) : spDl(item)
    }
}
