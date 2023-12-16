import fs from 'fs'
import { uid } from './Util'
import { ytDl, spDl } from './YtDl'

export interface QueueItem {
    msg?: any
    image?: any
    title?: string
    artist?: string
    album?: string
    fromYoutube?: boolean
    id?: string
    my_id?: string
    url?: string
    trackNumber?: number
    isAlbum?: boolean
    folder?: string
    albumCoverURL?: string
}

export class Queue {
    logPath
    all: QueueItem[] = []
    queue: QueueItem[] = []
    downloading: QueueItem[] = []
    finished: QueueItem[] = []
    errors: QueueItem[] = []
    lost: QueueItem[] = []

    constructor(logPath: string = '../data/log/') {
        this.logPath = logPath
        this.finished.push = function (args: QueueItem) {
            let i = Array.prototype.push.apply(this, [args])
            itemToLog(logPath, 'finished', this[i - 1])
            return i
        }
        this.errors.push = function (args: QueueItem) {
            let i = Array.prototype.push.apply(this, [args])
            itemToLog(logPath, 'errors', this[i - 1])
            return i
        }
        this.lost.push = function (args: QueueItem) {
            let i = Array.prototype.push.apply(this, [args])
            itemToLog(logPath, 'lost', this[i - 1])
            return i
        }
    }

    checkLoss() {
        let loss = []
        let n = 0
        if (this.all.length > this.errors.length + this.finished.length) console.error('LOST SONGS')
        if (this.all.length > this.finished.length) {
            for (let i of this.all) {
                if (this.finished.findIndex((f) => f.title == i.title && f.artist == i.artist) < 0) loss.push(i)
                console.log(`checking ${n} of ${this.all.length}`)
            }
            itemToLog(this.logPath, 'loss', loss)
        } else {
            console.log('finished without loss')
        }
    }

    enqueue(item: QueueItem) {
        item = { ...item, my_id: uid() }
        this.all.push(item)
        this.queue.push(item)
    }

    downloadNext() {
        if (this.queue.length == 0) return
        let item = this.queue.pop()
        this.downloading.push(item!)
        item!.fromYoutube ? ytDl(item!) : spDl(item!)
    }
}

function itemToLog(path: string, type: string, item: any) {
    let filename = `${path}/${type}.json`
    console.log(type, item)
    if (!fs.existsSync(filename)) fs.writeFileSync(filename, '[')
    fs.readFile(filename, function (err, data) {
        /*
      var json = JSON.parse(data);
      json.push(item);
      fs.writeFileSync(filename, JSON.stringify(json, null, 4));
      */
        delete item?.msg?.[0]?.image
        delete item?.image
        delete item?.[0]?.msg?.[0]?.image
        delete item?.[0]?.image
        fs.appendFileSync(filename, JSON.stringify(item?.[0] || item, null, 4) + ',')
    })
}
