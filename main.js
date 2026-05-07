import { InstanceBase, InstanceStatus } from '@companion-module/base'

const BASE_PATH = '/api'

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

function fmtTime(seconds) {
	if (!seconds || seconds < 0) seconds = 0
	const m = Math.floor(seconds / 60)
	const s = Math.floor(seconds % 60)
	return `${m}:${s.toString().padStart(2, '0')}`
}

// ─────────────────────────────────────────────
//  Module
// ─────────────────────────────────────────────

export default class AimpRemote extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.state = buildInitialState()
		this.playlistChoices = []
		this.tracksCache = {}
		this._pollTimer = null
		this._connectionOk = false
	}

	getConfigFields() {
		return [
			{ type: 'textinput', id: 'host', label: 'AIMP API Host', default: '127.0.0.1', width: 6 },
			{ type: 'number', id: 'port', label: 'Port', default: 3553, min: 1, max: 65535, width: 3 },
			{ type: 'number', id: 'pollInterval', label: 'Poll interval (ms, 0 = off)', default: 1000, min: 0, max: 60000, width: 3 },
		]
	}

	async init(config) {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)
		this._registerVariables()
		this._registerFeedbacks()
		await this._bootstrap()
	}

	async configUpdated(config) {
		this.config = config
		this._stopPolling()
		this.tracksCache = {}
		this.playlistChoices = []
		await this._bootstrap()
	}

	async destroy() {
		this._stopPolling()
	}

	async _bootstrap() {
		const ok = await this._loadPlaylists()
		if (ok) {
			this.updateStatus(InstanceStatus.Ok)
			this._connectionOk = true
		} else {
			this.updateStatus(InstanceStatus.ConnectionFailure)
			this._connectionOk = false
		}
		this.setActionDefinitions(this._buildActions())
		this._startPolling()
		this._poll()
	}

	// ── HTTP ─────────────────────────────────────

	get _baseURL() {
		return `http://${this.config?.host ?? '127.0.0.1'}:${this.config?.port ?? 3553}${BASE_PATH}`
	}

	async _request(method, path, queryParams = null) {
		let url = `${this._baseURL}${path}`
		if (queryParams) {
			const qs = new URLSearchParams(queryParams).toString()
			url += `?${qs}`
		}
		this.log('debug', `Request: ${method} ${url}`)  // ← отладочный вывод
		const opts = { method }

		try {
			const ac = new AbortController()
			const tid = setTimeout(() => ac.abort(), 5000)
			const res = await fetch(url, { ...opts, signal: ac.signal })
			clearTimeout(tid)
			if (!res.ok) {
				this.log('debug', `HTTP ${res.status} on ${method} ${path}`)
				return null
			}
			const ct = res.headers.get('content-type') || ''
			if (ct.includes('application/json')) return await res.json()
			const text = await res.text()
			try { return JSON.parse(text) } catch { return text || null }
		} catch (err) {
			if (err.name !== 'AbortError') this.log('debug', `Request error: ${err.message}`)
			return null
		}
	}

	// ── Data loading ─────────────────────────────

	async _loadPlaylists() {
		const data = await this._request('GET', '/playlists')
		if (!Array.isArray(data)) return false
		this.playlistChoices = data.map(pl => ({ id: pl.id, label: pl.name }))
		this.log('info', `Loaded ${this.playlistChoices.length} playlists`)
		return true
	}

	async _loadTracksForPlaylist(playlistId) {
		if (this.tracksCache[playlistId]) return
		const data = await this._request('GET', `/playlist/${playlistId}/tracks`)
		if (!Array.isArray(data)) {
			this.tracksCache[playlistId] = [{ id: '', label: 'Failed to load' }]
			return
		}
		this.tracksCache[playlistId] = data.map((t, idx) => ({
			id: String(idx), // use index as track ID
			label: `${idx + 1}. ${t.artist ?? '?'} – ${t.title ?? '?'}`,
		}))
	}

	// ── Polling ──────────────────────────────────

	_startPolling() {
		this._stopPolling()
		const interval = this.config?.pollInterval
		if (!interval) return
		this._pollTimer = setInterval(() => this._poll(), interval)
	}

	_stopPolling() {
		if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null }
	}

	async _poll() {
		if (!this.config?.host) return

		const [status, playlists] = await Promise.all([
			this._request('GET', '/status'),
			this._request('GET', '/playlists'),
		])

		if (!status) {
			if (this._connectionOk) {
				this._connectionOk = false
				this.updateStatus(InstanceStatus.ConnectionFailure)
			}
			return
		}

		if (!this._connectionOk) {
			this._connectionOk = true
			this.updateStatus(InstanceStatus.Ok)
		}

		// Status fields – может содержать state, volume (0-1), position, duration и т.д.
		this.state.playerState = status.state || 'stopped'
		this.state.volume = status.volume !== undefined ? status.volume : this.state.volume   // 0..1
		this.state.position = status.position ?? this.state.position // seconds
		this.state.duration = status.duration ?? this.state.duration // seconds

		// Если API отдаёт shuffle/repeat – подхватим
		if ('shuffle' in status) this.state.shuffle = status.shuffle
		if ('repeat' in status) this.state.repeat = status.repeat

		// Playlist info
		if (Array.isArray(playlists)) {
			const playingPl = playlists.find(p => p.state === 'playing')
			const selectedPl = playlists.find(p => p.state === 'selected')
			this.state.currentPlaylistId = playingPl?.id ?? ''
			this.state.currentPlaylistName = playingPl?.name ?? ''
			this.state.selectedPlaylistId = selectedPl?.id ?? ''

			// Обновляем выборки при изменении списка
			const newIds = playlists.map(p => p.id).join(',')
			if (newIds !== this.state._playlistIds) {
				this.state._playlistIds = newIds
				this.playlistChoices = playlists.map(p => ({ id: p.id, label: p.name }))
				for (const k of Object.keys(this.tracksCache)) {
					if (!playlists.some(p => p.id === k)) delete this.tracksCache[k]
				}
				this.setActionDefinitions(this._buildActions())
			}
		}

		this._updateVariables()
		this.checkFeedbacks()
	}

	// ── Variables ────────────────────────────────

	_registerVariables() {
		this.setVariableDefinitions({
			player_state:          { name: 'Player State' },
			volume_pct:            { name: 'Volume (%)' },
			position:              { name: 'Position (s)' },
			position_fmt:          { name: 'Position Formatted' },
			duration:              { name: 'Duration (s)' },
			duration_fmt:          { name: 'Duration Formatted' },
			remaining:             { name: 'Remaining (s)' },
			remaining_fmt:         { name: 'Remaining Formatted' },
			progress_pct:          { name: 'Progress (%)' },
			current_playlist_id:   { name: 'Current Playlist ID' },
			current_playlist_name: { name: 'Current Playlist Name' },
			selected_playlist_id:  { name: 'Selected Playlist ID' },
		})
	}

	_updateVariables() {
		const s = this.state
		const volPct = Math.round(s.volume * 100)
		const remaining = Math.max(0, s.duration - s.position)
		const progress = s.duration > 0 ? Math.round((s.position / s.duration) * 100) : 0

		this.setVariableValues({
			player_state:          s.playerState,
			volume_pct:            volPct,
			position:              s.position.toFixed(1),
			position_fmt:          fmtTime(s.position),
			duration:              s.duration.toFixed(1),
			duration_fmt:          fmtTime(s.duration),
			remaining:             remaining.toFixed(1),
			remaining_fmt:         fmtTime(remaining),
			progress_pct:          progress,
			current_playlist_id:   s.currentPlaylistId,
			current_playlist_name: s.currentPlaylistName,
			selected_playlist_id:  s.selectedPlaylistId,
		})
	}

	// ── Feedbacks ────────────────────────────────

	_registerFeedbacks() {
		this.setFeedbackDefinitions({
			is_playing: {
				type: 'boolean', name: 'Is Playing',
				defaultStyle: { bgcolor: 0x00aa00, color: 0xffffff },
				callback: () => this.state.playerState === 'playing',
			},
			is_paused: {
				type: 'boolean', name: 'Is Paused',
				defaultStyle: { bgcolor: 0xcccc00, color: 0x000000 },
				callback: () => this.state.playerState === 'paused',
			},
			is_stopped: {
				type: 'boolean', name: 'Is Stopped',
				defaultStyle: { bgcolor: 0xaa0000, color: 0xffffff },
				callback: () => this.state.playerState === 'stopped',
			},
			volume_above: {
				type: 'boolean', name: 'Volume ≥ X %',
				defaultStyle: { bgcolor: 0x00aaaa, color: 0xffffff },
				options: [{ type: 'number', id: 'threshold', label: 'Threshold (0–100)', default: 50, min: 0, max: 100 }],
				callback: (fb) => (this.state.volume * 100) >= fb.options.threshold,
			},
		})
	}

	// ── Actions ──────────────────────────────────

	_buildActions() {
		const playlistChoices = this.playlistChoices.length
			? this.playlistChoices
			: [{ id: '', label: '(no playlists)' }]

		return {
			play_pause: {
				name: 'Play / Pause',
				options: [],
				callback: async () => { await this._request('POST', '/player/playpause') },
			},
			play: {
				name: 'Play',
				options: [],
				callback: async () => {
					if (this.state.playerState !== 'playing') await this._request('POST', '/player/play')
				},
			},
			pause: {
				name: 'Pause',
				options: [],
				callback: async () => { await this._request('POST', '/player/pause') },
			},
			stop: {
				name: 'Stop',
				options: [],
				callback: async () => { await this._request('POST', '/player/stop') },
			},
			next: {
				name: 'Next Track',
				options: [],
				callback: async () => { await this._request('POST', '/player/next') },
			},
			prev: {
				name: 'Previous Track',
				options: [],
				callback: async () => { await this._request('POST', '/player/prev') },
			},
			set_volume: {
				name: 'Set Volume',
				options: [{ type: 'number', id: 'volume', label: 'Volume (0–100)', default: 50, min: 0, max: 100 }],
				callback: async (action) => {
					const vol = (action.options.volume) / 100
					await this._request('POST', '/player/volume', { volume: vol })
				},
			},
			volume_up: {
				name: 'Volume Up',
				options: [{ type: 'number', id: 'step', label: 'Step', default: 5, min: 1, max: 100 }],
				callback: async (action) => {
					const currentPct = Math.round(this.state.volume * 100)
					const nextPct = Math.min(100, currentPct + (action.options.step ?? 5))
					await this._request('POST', '/player/volume', { volume: nextPct / 100 })
				},
			},
			volume_down: {
				name: 'Volume Down',
				options: [{ type: 'number', id: 'step', label: 'Step', default: 5, min: 1, max: 100 }],
				callback: async (action) => {
					const currentPct = Math.round(this.state.volume * 100)
					const nextPct = Math.max(0, currentPct - (action.options.step ?? 5))
					await this._request('POST', '/player/volume', { volume: nextPct / 100 })
				},
			},
			seek_seconds: {
				name: 'Seek to Position (seconds)',
				options: [{ type: 'number', id: 'position', label: 'Position (s)', default: 0, min: 0, max: 36000 }],
				callback: async (action) => {
					await this._request('POST', '/player/position', { position: action.options.position })
				},
			},
			seek_percent: {
				name: 'Seek to Position (%)',
				options: [{ type: 'number', id: 'percent', label: 'Percent (0–100)', default: 0, min: 0, max: 100 }],
				callback: async (action) => {
					if (this.state.duration > 0) {
						const pos = (action.options.percent / 100) * this.state.duration
						await this._request('POST', '/player/position', { position: pos })
					}
				},
			},
			play_playlist: {
				name: 'Play Playlist',
				options: [
					{ type: 'dropdown', id: 'playlistId', label: 'Playlist', choices: playlistChoices, default: playlistChoices[0]?.id ?? '' },
					{ type: 'number', id: 'trackIndex', label: 'Start Track Index (0-based, optional)', default: 0, min: 0, max: 9999 },
				],
				callback: async (action) => {
					const { playlistId, trackIndex } = action.options
					if (!playlistId) return
					const params = trackIndex !== undefined ? { track: trackIndex } : {}
					await this._request('POST', `/playlist/${playlistId}/play`, params)
				},
			},
			play_track: {
				name: 'Play Track by Index',
				options: [
					{ type: 'dropdown', id: 'playlistId', label: 'Playlist', choices: playlistChoices, default: playlistChoices[0]?.id ?? '' },
					{ type: 'number', id: 'trackIndex', label: 'Track Index (0-based)', default: 0, min: 0, max: 9999 },
				],
				callback: async (action) => {
					const { playlistId, trackIndex } = action.options
					if (!playlistId) return
					await this._request('POST', `/playlist/${playlistId}/play`, { track: trackIndex })
				},
			},
		}
	}
}

function buildInitialState() {
	return {
		playerState: 'stopped',
		volume: 0.5,        // 0..1
		position: 0,
		duration: 0,
		shuffle: false,
		repeat: 'none',
		currentPlaylistId: '',
		currentPlaylistName: '',
		selectedPlaylistId: '',
		_playlistIds: '',
	}
}