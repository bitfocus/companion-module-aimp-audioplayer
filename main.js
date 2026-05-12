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
		this.tracksCache = {}     // { [playlistId]: [{id, label}] }
		this._pollTimer = null
		this._connectionOk = false
	}

	// ── Config ───────────────────────────────────

	getConfigFields() {
		return [
			{ type: 'textinput', id: 'host',        label: 'AIMP API Host',              default: '127.0.0.1', width: 6 },
			{ type: 'number',    id: 'port',         label: 'Port',                        default: 3553, min: 1, max: 65535, width: 3 },
			{ type: 'number',    id: 'pollInterval', label: 'Poll interval (ms, 0 = off)', default: 1000, min: 0, max: 60000, width: 3 },
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

	// ── Bootstrap ────────────────────────────────

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
		await this._poll()
	}

	// ── HTTP ─────────────────────────────────────

	get _baseURL() {
		return `http://${this.config?.host ?? '127.0.0.1'}:${this.config?.port ?? 3553}${BASE_PATH}`
	}

	/**
	 * @param {'GET'|'POST'|'PUT'} method
	 * @param {string} path
	 * @param {object|null} queryParams  – добавляются в URL (?key=val)
	 * @param {object|null} body         – JSON-тело для POST/PUT
	 */
	async _request(method, path, queryParams = null, body = null) {
		let url = `${this._baseURL}${path}`
		if (queryParams) url += `?${new URLSearchParams(queryParams)}`

		this.log('debug', `→ ${method} ${url}${body ? ' ' + JSON.stringify(body) : ''}`)

		const opts = { method, headers: {} }
		if (body) {
			opts.headers['Content-Type'] = 'application/json'
			opts.body = JSON.stringify(body)
		}

		try {
			const ac = new AbortController()
			const tid = setTimeout(() => ac.abort(), 5000)
			const res = await fetch(url, { ...opts, signal: ac.signal })
			clearTimeout(tid)

			if (!res.ok) {
				this.log('warn', `HTTP ${res.status} on ${method} ${path}`)
				return null
			}
			const ct = res.headers.get('content-type') || ''
			if (ct.includes('application/json')) return await res.json()
			const text = await res.text()
			try { return JSON.parse(text) } catch { return text || null }
		} catch (err) {
			if (err.name !== 'AbortError') this.log('warn', `Request error: ${err.message}`)
			return null
		}
	}

	// ── Data loading ─────────────────────────────

	async _loadPlaylists() {
		const data = await this._request('GET', '/playlists')
		// API возвращает { playlists: [...] }
		const list = Array.isArray(data) ? data : data?.playlists
		if (!Array.isArray(list)) return false
		this.playlistChoices = list.map(pl => ({ id: pl.id, label: pl.name }))
		this.log('info', `Loaded ${this.playlistChoices.length} playlists`)
		return true
	}

	/**
	 * Подгружает треки плейлиста и кладёт в кэш.
	 * API возвращает { tracks: [...], total, limit, offset }
	 */
	async _ensureTracksLoaded(playlistId) {
		if (this.tracksCache[playlistId]) return
		const data = await this._request('GET', `/playlists/${playlistId}/tracks`, { limit: 500, offset: 0 })
		// API возвращает { tracks: [...], total, ... }
		const list = Array.isArray(data) ? data : data?.tracks
		if (!Array.isArray(list)) {
			this.tracksCache[playlistId] = [{ id: '0', label: '⚠ Failed to load' }]
			return
		}
		this.tracksCache[playlistId] = list.map((t, idx) => ({
			id: String(t.id ?? idx),   // используем реальный id трека из API
			label: `${idx + 1}. ${[t.artist, t.title].filter(Boolean).join(' – ') || t.file_path || '?'}`,
		}))
	}

	/** Возвращает choices треков для плейлиста (синхронно, использует кэш) */
	_trackChoicesFor(playlistId) {
		return this.tracksCache[playlistId] ?? [{ id: '0', label: '(loading…)' }]
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

		// Запрашиваем статус и плейлисты параллельно
		// GET /api/player/status уже содержит focus_playlist и focus_track,
		// поэтому отдельный GET /api/focus не нужен (но оставим на случай расхождений)
		const [status, playlistsData] = await Promise.all([
			this._request('GET', '/player/status'),
			this._request('GET', '/playlists'),
		])

		// ── Обработка потери связи ────────────────
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

		// ── Player state ──────────────────────────
		// API: { state, position, duration, volume, muted, playing_playlist{...}, playing_track{...}, focus_playlist{...}, focus_track{...} }
		this.state.playerState = status.state    ?? this.state.playerState
		this.state.volume      = status.volume   !== undefined ? status.volume  : this.state.volume
		this.state.muted       = status.muted    !== undefined ? status.muted   : this.state.muted   // "muted", не "mute"
		this.state.position    = status.position ?? this.state.position
		this.state.duration    = status.duration ?? this.state.duration

		// ── Playing track ─────────────────────────
		// playing_playlist и playing_track — объекты (или null если ничего не играет)
		const pp = status.playing_playlist
		const pt = status.playing_track
		this.state.playingPlaylistId   = pp != null ? String(pp.id)   : ''
		this.state.playingPlaylistName = pp != null ? (pp.name ?? '') : ''
		this.state.playingTrackId      = pt != null ? String(pt.id)   : ''
		this.state.playingTrackTitle   = pt != null ? (pt.title  ?? '') : ''
		this.state.playingTrackArtist  = pt != null ? (pt.artist ?? '') : ''

		// ── Focus state ───────────────────────────
		// focus_playlist и focus_track — объекты (всегда присутствуют в статусе)
		const fp = status.focus_playlist
		const ft = status.focus_track
		if (fp != null) {
			const newFocusPlId = String(fp.id)
			if (newFocusPlId !== this.state.focusPlaylistId) {
				// Плейлист в фокусе сменился — подгрузим треки лениво
				this.state.focusPlaylistId   = newFocusPlId
				this.state.focusPlaylistName = fp.name ?? ''
				if (newFocusPlId) {
					this._ensureTracksLoaded(newFocusPlId).then(() => {
						this._updateVariables()
						this.checkFeedbacks()
					})
				}
			} else {
				this.state.focusPlaylistName = fp.name ?? this.state.focusPlaylistName
			}
		}
		if (ft != null) {
			this.state.focusTrackId     = String(ft.id)
			this.state.focusTrackTitle  = ft.title  ?? ''
			this.state.focusTrackArtist = ft.artist ?? ''
			// Вычисляем порядковый индекс из кэша по track id
			this.state.focusTrackIndex  = this._trackIndexById(this.state.focusPlaylistId, String(ft.id))
		}

		// ── Playlists ─────────────────────────────
		const plList = Array.isArray(playlistsData) ? playlistsData : playlistsData?.playlists
		if (Array.isArray(plList)) {
			const newIds = plList.map(p => p.id).join(',')
			if (newIds !== this.state._playlistIds) {
				this.state._playlistIds = newIds
				this.playlistChoices    = plList.map(p => ({ id: p.id, label: p.name }))
				// Удаляем треки удалённых плейлистов из кэша
				const validIds = new Set(plList.map(p => String(p.id)))
				for (const k of Object.keys(this.tracksCache)) {
					if (!validIds.has(k)) delete this.tracksCache[k]
				}
				this.setActionDefinitions(this._buildActions())
				this._registerFeedbacks()
			}
		}

		this._updateVariables()
		this.checkFeedbacks()
	}

	_playlistNameById(id) {
		return this.playlistChoices.find(p => String(p.id) === String(id))?.label ?? String(id ?? '')
	}

	/** Возвращает 0-based индекс трека в кэше по его API-id */
	_trackIndexById(playlistId, trackId) {
		const tracks = this.tracksCache[String(playlistId)]
		if (!tracks) return 0
		const idx = tracks.findIndex(t => t.id === String(trackId))
		return idx >= 0 ? idx : 0
	}

	// ── Variables ────────────────────────────────

	_registerVariables() {
		this.setVariableDefinitions({
			// Player
			player_state:          { name: 'Player State (playing/paused/stopped)' },
			volume_pct:            { name: 'Volume (0–100)' },
			muted:                 { name: 'Muted (true/false)' },
			position:              { name: 'Position (s)' },
			position_fmt:          { name: 'Position (mm:ss)' },
			duration:              { name: 'Duration (s)' },
			duration_fmt:          { name: 'Duration (mm:ss)' },
			remaining:             { name: 'Remaining (s)' },
			remaining_fmt:         { name: 'Remaining (mm:ss)' },
			progress_pct:          { name: 'Progress (%)' },
			// Playing track
			playing_track_title:   { name: 'Playing Track Title' },
			playing_track_artist:  { name: 'Playing Track Artist' },
			playing_playlist_id:   { name: 'Playing Playlist ID' },
			playing_playlist_name: { name: 'Playing Playlist Name' },
			playing_track_id:      { name: 'Playing Track ID' },
			// Focus
			focus_playlist_id:     { name: 'Focus Playlist ID' },
			focus_playlist_name:   { name: 'Focus Playlist Name' },
			focus_track_id:        { name: 'Focus Track ID' },
			focus_track_index:     { name: 'Focus Track Index (0-based)' },
			focus_track_title:     { name: 'Focus Track Title' },
			focus_track_artist:    { name: 'Focus Track Artist' },
		})
	}

	_updateVariables() {
		const s = this.state
		const remaining = Math.max(0, s.duration - s.position)
		const progress  = s.duration > 0 ? Math.round((s.position / s.duration) * 100) : 0

		this.setVariableValues({
			player_state:           s.playerState,
			volume_pct:             Math.round(s.volume),
			muted:                  s.muted,
			position:               s.position.toFixed(1),
			position_fmt:           fmtTime(s.position),
			duration:               s.duration.toFixed(1),
			duration_fmt:           fmtTime(s.duration),
			remaining:              remaining.toFixed(1),
			remaining_fmt:          fmtTime(remaining),
			progress_pct:           progress,
			playing_track_title:    s.playingTrackTitle,
			playing_track_artist:   s.playingTrackArtist,
			playing_playlist_id:    s.playingPlaylistId,
			playing_playlist_name:  s.playingPlaylistName,
			playing_track_id:       s.playingTrackId,
			focus_playlist_id:      s.focusPlaylistId,
			focus_playlist_name:    s.focusPlaylistName,
			focus_track_id:         s.focusTrackId,
			focus_track_index:      s.focusTrackIndex,
			focus_track_title:      s.focusTrackTitle,
			focus_track_artist:     s.focusTrackArtist,
		})
	}

	// ── Feedbacks ────────────────────────────────

	_registerFeedbacks() {
		const plChoices = this.playlistChoices.length
			? this.playlistChoices
			: [{ id: '', label: '(loading)' }]

		this.setFeedbackDefinitions({
			// ── Player state ──────────────────────────
			is_playing: {
				type: 'boolean',
				name: 'Player: Is Playing',
				defaultStyle: { bgcolor: 0x00aa00, color: 0xffffff },
				options: [],
				callback: () => this.state.playerState === 'playing',
			},
			is_paused: {
				type: 'boolean',
				name: 'Player: Is Paused',
				defaultStyle: { bgcolor: 0xcccc00, color: 0x000000 },
				options: [],
				callback: () => this.state.playerState === 'paused',
			},
			is_stopped: {
				type: 'boolean',
				name: 'Player: Is Stopped',
				defaultStyle: { bgcolor: 0xaa0000, color: 0xffffff },
				options: [],
				callback: () => this.state.playerState === 'stopped',
			},

			// ── Mute ──────────────────────────────────
			is_muted: {
				type: 'boolean',
				name: 'Player: Is Muted',
				defaultStyle: { bgcolor: 0x884400, color: 0xffffff },
				options: [],
				callback: () => !!this.state.muted,
			},

			// ── Volume ────────────────────────────────
			volume_above: {
				type: 'boolean',
				name: 'Player: Volume ≥ X%',
				defaultStyle: { bgcolor: 0x00aaaa, color: 0xffffff },
				options: [
					{ type: 'number', id: 'threshold', label: 'Threshold (0–100)', default: 50, min: 0, max: 100 },
				],
				callback: (fb) => this.state.volume >= fb.options.threshold,
			},

			// ── Focus ─────────────────────────────────
			focus_playlist_is: {
				type: 'boolean',
				name: 'Focus: Playlist matches',
				defaultStyle: { bgcolor: 0x0055aa, color: 0xffffff },
				options: [
					{
						type: 'dropdown', id: 'playlistId', label: 'Playlist',
						choices: plChoices,
						default: plChoices[0]?.id ?? '',
					},
				],
				callback: (fb) => String(this.state.focusPlaylistId) === String(fb.options.playlistId),
			},
			focus_track_is: {
				type: 'boolean',
				name: 'Focus: Track matches (by track ID)',
				defaultStyle: { bgcolor: 0x005599, color: 0xffffff },
				options: [
					{
						type: 'dropdown', id: 'playlistId', label: 'Playlist',
						choices: plChoices,
						default: plChoices[0]?.id ?? '',
					},
					{
						type: 'number', id: 'trackId', label: 'Track ID (from API)',
						default: 0, min: 0, max: 99999,
					},
				],
				callback: (fb) =>
					String(this.state.focusPlaylistId) === String(fb.options.playlistId) &&
					String(this.state.focusTrackId)    === String(fb.options.trackId),
			},

			// ── Playing ───────────────────────────────
			playing_playlist_is: {
				type: 'boolean',
				name: 'Playing: Playlist matches',
				defaultStyle: { bgcolor: 0x006600, color: 0xffffff },
				options: [
					{
						type: 'dropdown', id: 'playlistId', label: 'Playlist',
						choices: plChoices,
						default: plChoices[0]?.id ?? '',
					},
				],
				callback: (fb) => String(this.state.playingPlaylistId) === String(fb.options.playlistId),
			},
			playing_track_is: {
				type: 'boolean',
				name: 'Playing: Track matches (playlist + track ID)',
				defaultStyle: { bgcolor: 0x006600, color: 0xffffff },
				options: [
					{
						type: 'dropdown', id: 'playlistId', label: 'Playlist',
						choices: plChoices,
						default: plChoices[0]?.id ?? '',
					},
					{
						type: 'number', id: 'trackId', label: 'Track ID (from API)',
						default: 0, min: 0, max: 99999,
					},
				],
				callback: (fb) =>
					String(this.state.playingPlaylistId) === String(fb.options.playlistId) &&
					String(this.state.playingTrackId)    === String(fb.options.trackId),
			},
		})
	}

	// ── Actions ──────────────────────────────────

	_buildActions() {
		const plChoices = this.playlistChoices.length
			? this.playlistChoices
			: [{ id: '', label: '(no playlists)' }]

		const defaultPlId = plChoices[0]?.id ?? ''
		const defaultTrackChoices = this._trackChoicesFor(defaultPlId)

		return {
			// ══════════════════════════════════════════
			//  PLAYER CONTROLS
			// ══════════════════════════════════════════

			play: {
				name: '▶ Play',
				options: [],
				callback: async () => { await this._request('POST', '/player/play') },
			},
			pause: {
				name: '⏸ Pause',
				options: [],
				callback: async () => { await this._request('POST', '/player/pause') },
			},
			play_pause: {
				name: '▶⏸ Play / Pause Toggle',
				options: [],
				callback: async () => {
					if (this.state.playerState === 'playing') {
						await this._request('POST', '/player/pause')
					} else {
						await this._request('POST', '/player/play')
					}
				},
			},
			stop: {
				name: '⏹ Stop',
				options: [],
				callback: async () => { await this._request('POST', '/player/stop') },
			},
			next: {
				name: '⏭ Next Track',
				options: [],
				callback: async () => { await this._request('POST', '/player/next') },
			},
			prev: {
				name: '⏮ Previous Track',
				options: [],
				callback: async () => { await this._request('POST', '/player/prev') },
			},

			// ══════════════════════════════════════════
			//  VOLUME & MUTE
			// ══════════════════════════════════════════

			mute_toggle: {
				name: '🔇 Mute Toggle',
				options: [],
				callback: async () => { await this._request('POST', '/player/mute') },
			},
			set_volume: {
				name: '🔊 Set Volume (absolute)',
				options: [
					{ type: 'number', id: 'volume', label: 'Volume (0–100)', default: 50, min: 0, max: 100 },
				],
				callback: async (action) => {
					await this._request('PUT', '/player/volume', null, { volume: action.options.volume })
				},
			},
			volume_up: {
				name: '🔊 Volume Up',
				options: [
					{ type: 'number', id: 'step', label: 'Step', default: 5, min: 1, max: 50 },
				],
				callback: async (action) => {
					const next = Math.min(100, Math.round(this.state.volume) + (action.options.step ?? 5))
					await this._request('PUT', '/player/volume', null, { volume: next })
				},
			},
			volume_down: {
				name: '🔉 Volume Down',
				options: [
					{ type: 'number', id: 'step', label: 'Step', default: 5, min: 1, max: 50 },
				],
				callback: async (action) => {
					const next = Math.max(0, Math.round(this.state.volume) - (action.options.step ?? 5))
					await this._request('PUT', '/player/volume', null, { volume: next })
				},
			},

			// ══════════════════════════════════════════
			//  SEEK
			// ══════════════════════════════════════════

			seek_seconds: {
				name: '⏩ Seek to Position (seconds)',
				options: [
					{ type: 'number', id: 'position', label: 'Position (s)', default: 0, min: 0, max: 36000 },
				],
				callback: async (action) => {
					await this._request('PUT', '/player/position', null, { position: action.options.position })
				},
			},
			seek_percent: {
				name: '⏩ Seek to Position (%)',
				options: [
					{ type: 'number', id: 'percent', label: 'Percent (0–100)', default: 0, min: 0, max: 100 },
				],
				callback: async (action) => {
					if (this.state.duration > 0) {
						const pos = (action.options.percent / 100) * this.state.duration
						await this._request('PUT', '/player/position', null, { position: pos })
					}
				},
			},

			// ══════════════════════════════════════════
			//  FOCUS NAVIGATION
			//  Кнопки < Playlist > и < Track >
			// ══════════════════════════════════════════

			focus_playlist_next: {
				name: '▶ Focus: Next Playlist',
				options: [],
				callback: async () => { await this._request('POST', '/focus/playlist/next') },
			},
			focus_playlist_prev: {
				name: '◀ Focus: Previous Playlist',
				options: [],
				callback: async () => { await this._request('POST', '/focus/playlist/prev') },
			},
			focus_track_next: {
				name: '▶ Focus: Next Track',
				options: [],
				callback: async () => { await this._request('POST', '/focus/track/next') },
			},
			focus_track_prev: {
				name: '◀ Focus: Previous Track',
				options: [],
				callback: async () => { await this._request('POST', '/focus/track/prev') },
			},
			focus_play: {
				name: '▶ Focus: Play Focused Track',
				options: [],
				callback: async () => { await this._request('POST', '/focus/play') },
			},

			// ══════════════════════════════════════════
			//  PLAYLIST ACTIONS
			// ══════════════════════════════════════════

			playlist_play: {
				name: '▶ Playlist: Play from Beginning',
				options: [
					{ type: 'dropdown', id: 'playlistId', label: 'Playlist', choices: plChoices, default: defaultPlId },
				],
				callback: async (action) => {
					const id = action.options.playlistId
					if (id === '' || id == null) return
					await this._request('POST', `/playlists/${id}/play`)
				},
			},
			playlist_select: {
				name: '☑ Playlist: Select (activate tab)',
				options: [
					{ type: 'dropdown', id: 'playlistId', label: 'Playlist', choices: plChoices, default: defaultPlId },
				],
				callback: async (action) => {
					const id = action.options.playlistId
					if (id === '' || id == null) return
					await this._request('POST', `/playlists/${id}/select`)
				},
			},

			// ══════════════════════════════════════════
			//  TRACK ACTIONS
			//  Кнопка с выбором плейлиста + трека + action
			//
			//  Используем реальный track.id из API (не порядковый индекс),
			//  поэтому маршруты выглядят как /playlists/:pid/tracks/:tid/play
			// ══════════════════════════════════════════

			track_action: {
				name: '🎵 Track: Play or Focus (enter track ID)',
				options: [
					{
						type: 'dropdown',
						id: 'playlistId',
						label: 'Playlist',
						choices: plChoices,
						default: defaultPlId,
					},
					{
						// Track ID — реальный id из API (поле track.id)
						type: 'number',
						id: 'trackId',
						label: 'Track ID (из API, поле id)',
						default: 0,
						min: 0,
						max: 99999,
					},
					{
						type: 'dropdown',
						id: 'action',
						label: 'Action',
						choices: [
							{ id: 'play',   label: '▶ Play track' },
							{ id: 'select', label: '☑ Set focus (select)' },
						],
						default: 'play',
					},
				],
				callback: async (action) => {
					const { playlistId, trackId, action: act } = action.options
					if (playlistId === '' || playlistId == null) return
					if (act === 'play') {
						await this._request('POST', `/playlists/${playlistId}/tracks/${trackId}/play`)
					} else {
						await this._request('POST', `/playlists/${playlistId}/tracks/${trackId}/select`)
					}
				},
			},

			// Вариант с выбором трека через dropdown (используется кэш треков)
			track_action_browse: {
				name: '🎵 Track: Play or Focus (browse list)',
				options: [
					{
						type: 'dropdown',
						id: 'playlistId',
						label: 'Playlist',
						choices: plChoices,
						default: defaultPlId,
					},
					{
						type: 'dropdown',
						id: 'trackId',
						label: 'Track',
						choices: defaultTrackChoices,
						default: defaultTrackChoices[0]?.id ?? '0',
					},
					{
						type: 'dropdown',
						id: 'action',
						label: 'Action',
						choices: [
							{ id: 'play',   label: '▶ Play track' },
							{ id: 'select', label: '☑ Set focus (select)' },
						],
						default: 'play',
					},
				],
				subscribe: async (action) => {
					const id = action.options.playlistId
					if (id !== '' && id != null) await this._ensureTracksLoaded(id)
				},
				callback: async (action) => {
					const { playlistId, trackId, action: act } = action.options
					if (playlistId === '' || playlistId == null) return
					if (act === 'play') {
						await this._request('POST', `/playlists/${playlistId}/tracks/${trackId}/play`)
					} else {
						await this._request('POST', `/playlists/${playlistId}/tracks/${trackId}/select`)
					}
				},
			},
		}
	}
}

// ─────────────────────────────────────────────
//  Initial state
// ─────────────────────────────────────────────

function buildInitialState() {
	return {
		// Player
		playerState:           'stopped',  // 'playing' | 'paused' | 'stopped'
		volume:                50,         // 0..100
		muted:                 false,      // API поле называется "muted"
		position:              0,          // seconds
		duration:              0,          // seconds

		// Playing track (null когда ничего не играет)
		playingPlaylistId:     '',
		playingPlaylistName:   '',
		playingTrackId:        '',
		playingTrackTitle:     '',
		playingTrackArtist:    '',

		// Focus (навигация кнопками)
		focusPlaylistId:       '',
		focusPlaylistName:     '',
		focusTrackId:          '',
		focusTrackIndex:       0,
		focusTrackTitle:       '',
		focusTrackArtist:      '',

		// Internal
		_playlistIds:          '',
	}
}
