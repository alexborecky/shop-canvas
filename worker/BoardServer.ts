import { YServer } from 'y-partyserver'
import * as Y from 'yjs'

/**
 * One instance per board (Durable Object). Holds the board's Yjs document in memory while
 * people are connected, relays edits + presence between them, and persists the document to
 * this Durable Object's built-in SQLite storage.
 *
 * The document is stored as a single Yjs update split into chunks (SQLite rows max out at 2 MB).
 * Board content is independent of the canvas library: see `shared/boardSchema.ts`.
 */
const CHUNK_SIZE = 1_000_000

export class BoardServer extends YServer<Env> {
	// Let the DO sleep between messages; sockets stay open at the Cloudflare edge.
	static options = { hibernate: true }

	// Save at most every ~2s while editing, and at least every 10s.
	static callbackOptions = { debounceWait: 2000, debounceMaxWait: 10000, timeout: 5000 }

	private ensureTable() {
		this.ctx.storage.sql.exec(
			'CREATE TABLE IF NOT EXISTS doc_chunks (idx INTEGER PRIMARY KEY, data BLOB NOT NULL)'
		)
	}

	async onLoad() {
		this.ensureTable()
		const rows = this.ctx.storage.sql
			.exec<{ data: ArrayBuffer }>('SELECT data FROM doc_chunks ORDER BY idx')
			.toArray()
		if (rows.length === 0) return

		const parts = rows.map((r) => new Uint8Array(r.data))
		const total = parts.reduce((n, p) => n + p.length, 0)
		const update = new Uint8Array(total)
		let offset = 0
		for (const p of parts) {
			update.set(p, offset)
			offset += p.length
		}
		Y.applyUpdate(this.document, update)
	}

	async onSave() {
		this.ensureTable()
		const update = Y.encodeStateAsUpdate(this.document)
		this.ctx.storage.transactionSync(() => {
			this.ctx.storage.sql.exec('DELETE FROM doc_chunks')
			for (let i = 0; i * CHUNK_SIZE < update.length; i++) {
				const chunk = update.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
				this.ctx.storage.sql.exec('INSERT INTO doc_chunks (idx, data) VALUES (?, ?)', i, chunk)
			}
		})
	}
}
