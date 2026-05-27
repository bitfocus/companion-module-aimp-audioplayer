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

		// Choices для dropdown-ов: id = aimp_id (GUID), label = имя
		this.playlistChoices = []
		// Маппинг aimp_id → { index, name, aimpId } для конвертации при API-вызовах
		this.playlistsMap = {}
		// Кэш треков: ключ = aimp_id плейлиста
		this.tracksCache = {}     // { [aimpId]: [{id, label}] }

		this._pollTimer = null
		this._connectionOk = false
		this._bootstrapping = false
		this._pollCount = 0
		this._tracksRefreshing = false
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
		this._bootstrap()
	}

	async configUpdated(config) {
		this.config = config
		this._stopPolling()
		this.tracksCache = {}
		this.playlistChoices = []
		this.playlistsMap = {}
		this._bootstrap()
	}

	async destroy() {
		this._stopPolling()
	}

	// ── Bootstrap ────────────────────────────────

	async _bootstrap() {
		if (this._bootstrapping) return
		this._bootstrapping = true
		try {
			const ok = await this._loadPlaylists()
			if (ok) {
				this.updateStatus(InstanceStatus.Ok)
				this._connectionOk = true
				await Promise.all(
					this.playlistChoices.map(pl => this._ensureTracksLoaded(pl.id))
				)
			} else {
				this.updateStatus(InstanceStatus.ConnectionFailure)
				this._connectionOk = false
			}
			this.setActionDefinitions(this._buildActions())
			this._poll()
			this._startPolling()
		} catch (err) {
			this.log('error', `Bootstrap error: ${err.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
			this._connectionOk = false
			this._startPolling()
		} finally {
			this._bootstrapping = false
		}
	}

	// ── HTTP ─────────────────────────────────────

	get _baseURL() {
		return `http://${this.config?.host ?? '127.0.0.1'}:${this.config?.port ?? 3553}${BASE_PATH}`
	}

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

	// ── Playlist ID helpers ─────────────────────
	// Внутри модуля всё привязано к aimp_id (GUID).
	// API-роуты используют порядковый index (/playlists/{index}/...).
	// Эти хелперы конвертируют между ними.

	/** aimp_id → текущий порядковый index для API-запросов */
	_playlistIndex(aimpId) {
		return this.playlistsMap[aimpId]?.index
	}

	/** aimp_id → имя плейлиста */
	_playlistNameById(aimpId) {
		return this.playlistsMap[aimpId]?.name ?? String(aimpId ?? '')
	}

	/** Обновляет playlistChoices и playlistsMap из сырого массива API */
	_updatePlaylistsFromApi(list) {
		this.playlistChoices = list.map(pl => ({
			id: String(pl.aimp_id),
			label: pl.name,
		}))
		this.playlistsMap = {}
		for (const pl of list) {
			this.playlistsMap[String(pl.aimp_id)] = {
				index: pl.id,        // порядковый index для API-роутов
				name: pl.name,
				aimpId: String(pl.aimp_id),
			}
		}
	}

	// ── Data loading ─────────────────────────────

	async _loadPlaylists() {
		const data = await this._request('GET', '/playlists')
		const list = Array.isArray(data) ? data : data?.playlists
		if (!Array.isArray(list)) return false
		this._updatePlaylistsFromApi(list)
		this.log('info', `Loaded ${this.playlistChoices.length} playlists`)
		return true
	}

	/**
	 * Подгружает треки плейлиста и кладёт в кэш (если ещё не загружены).
	 * @param {string} aimpId — aimp_id плейлиста (GUID)
	 */
	async _ensureTracksLoaded(aimpId) {
		const key = String(aimpId)
		if (this.tracksCache[key]) return
		await this._loadTracks(aimpId)
	}

	/**
	 * Принудительно загружает треки плейлиста из API и обновляет кэш.
	 * @param {string} aimpId — aimp_id плейлиста (GUID)
	 * @returns {boolean} true, если список треков изменился
	 */
	async _loadTracks(aimpId) {
		const key = String(aimpId)
		const idx = this._playlistIndex(key)
		if (idx == null) {
			this.log('warn', `_loadTracks: unknown playlist aimp_id=${key}`)
			return false
		}
		const data = await this._request('GET', `/playlists/${idx}/tracks`, { limit: 500, offset: 0 })
		const list = Array.isArray(data) ? data : data?.tracks
		if (!Array.isArray(list)) {
			const hadCache = !!this.tracksCache[key]
			this.tracksCache[key] = [{ id: '0', label: '⚠ Failed to load' }]
			return hadCache
		}
		const newTracks = list.map((t, i) => ({
			id: String(t.id ?? i),
			label: `${i + 1}. ${[t.artist, t.title].filter(Boolean).join(' – ') || t.file_path || '?'}`,
		}))

		const oldTracks = this.tracksCache[key]
		let changed = false
		if (!oldTracks || oldTracks.length !== newTracks.length) {
			changed = true
		} else {
			for (let i = 0; i < newTracks.length; i++) {
				if (newTracks[i].id !== oldTracks[i].id || newTracks[i].label !== oldTracks[i].label) {
					changed = true
					break
				}
			}
		}

		if (changed) {
			this.tracksCache[key] = newTracks
			this.log('info', `Tracks updated for playlist ${this._playlistNameById(key)}: ${newTracks.length} tracks`)
		}
		return changed
	}

	/**
	 * Принудительно перезагружает треки для ВСЕХ плейлистов.
	 * Если хотя бы один плейлист изменился — перестраивает action definitions.
	 */
	async _refreshAllTracks() {
		if (this._tracksRefreshing) return
		this._tracksRefreshing = true
		try {
			const playlists = this.playlistChoices
			if (playlists.length === 0) return
			const results = await Promise.all(
				playlists.map(pl => this._loadTracks(pl.id))
			)
			if (results.some(Boolean)) {
				this.setActionDefinitions(this._buildActions())
			}
		} catch (err) {
			this.log('warn', `Tracks refresh error: ${err.message}`)
		} finally {
			this._tracksRefreshing = false
		}
	}

	/** Возвращает choices треков для плейлиста (синхронно, использует кэш) */
	_trackChoicesFor(aimpId) {
		return this.tracksCache[String(aimpId)] ?? [{ id: '0', label: '(loading…)' }]
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

	_allFeedbackIds() {
		return [
			'is_playing', 'is_paused', 'is_stopped',
			'is_muted',
			'volume_above',
			'focus_playlist_is', 'focus_track_is',
			'playing_playlist_is', 'playing_track_is',
		]
	}

	async _poll() {
		if (!this.config?.host) return
		try {
			await this._pollInner()
		} catch (err) {
			this.log('error', `Poll error: ${err.message}`)
			if (this._connectionOk) {
				this._connectionOk = false
				this.updateStatus(InstanceStatus.ConnectionFailure)
			}
		}
	}

	async _pollInner() {
		const [status, playlistsData] = await Promise.all([
			this._request('GET', '/player/status'),
			this._request('GET', '/playlists'),
		])

		// ── Обработка потери связи ────────────────
		if (!status) {
			if (this._connectionOk) {
				this._connectionOk = false
				this.updateStatus(InstanceStatus.ConnectionFailure)
				this.tracksCache = {}
				this.state._playlistAimpIds = ''
			}
			return
		}
		if (!this._connectionOk) {
			this._connectionOk = true
			this.updateStatus(InstanceStatus.Ok)
		}

		// ── Player state ──────────────────────────
		this.state.playerState = status.state    ?? this.state.playerState
		this.state.volume      = status.volume   !== undefined ? status.volume  : this.state.volume
		this.state.muted       = status.muted    !== undefined ? status.muted   : this.state.muted
		this.state.position    = status.position ?? this.state.position
		this.state.duration    = status.duration ?? this.state.duration

		// ── Playing track ─────────────────────────
		// playing_playlist содержит aimp_id, playing_track — порядковый id
		const pp = status.playing_playlist
		const pt = status.playing_track
		this.state.playingPlaylistId   = pp != null ? String(pp.aimp_id ?? pp.id) : ''
		this.state.playingPlaylistName = pp != null ? (pp.name ?? '') : ''
		this.state.playingTrackId      = pt != null ? String(pt.id)   : ''
		this.state.playingTrackTitle   = pt != null ? (pt.title  ?? '') : ''
		this.state.playingTrackArtist  = pt != null ? (pt.artist ?? '') : ''

		// ── Focus state ───────────────────────────
		const fp = status.focus_playlist
		const ft = status.focus_track
		if (fp != null) {
			const newFocusPlId = String(fp.aimp_id ?? fp.id)
			if (newFocusPlId !== this.state.focusPlaylistId) {
				this.state.focusPlaylistId   = newFocusPlId
				this.state.focusPlaylistName = fp.name ?? ''
				if (newFocusPlId) {
					this._ensureTracksLoaded(newFocusPlId).then(() => {
						this.setActionDefinitions(this._buildActions())
						this._updateVariables()
						this.checkFeedbacks(...this._allFeedbackIds())
					}).catch((err) => {
						this.log('warn', `Failed to load tracks for playlist ${newFocusPlId}: ${err.message}`)
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
			this.state.focusTrackIndex  = this._trackIndexById(this.state.focusPlaylistId, String(ft.id))
		}

		// ── Playlists ─────────────────────────────
		const plList = Array.isArray(playlistsData) ? playlistsData : playlistsData?.playlists
		if (Array.isArray(plList)) {
			// Отслеживаем по aimp_id — они стабильные
			const newAimpIds = plList.map(p => String(p.aimp_id)).join(',')
			if (newAimpIds !== this.state._playlistAimpIds) {
				const oldAimpIds = new Set(
					this.state._playlistAimpIds ? this.state._playlistAimpIds.split(',') : []
				)
				const newAimpIdSet = new Set(plList.map(p => String(p.aimp_id)))

				this.state._playlistAimpIds = newAimpIds
				this._updatePlaylistsFromApi(plList)

				// Удаляем кэш для удалённых плейлистов
				for (const oldId of oldAimpIds) {
					if (!newAimpIdSet.has(oldId)) {
						delete this.tracksCache[oldId]
					}
				}

				this._registerFeedbacks()
				Promise.all(plList.map(p => this._ensureTracksLoaded(String(p.aimp_id))))
					.then(() => {
						this.setActionDefinitions(this._buildActions())
					})
					.catch((err) => {
						this.log('warn', `Failed to preload tracks: ${err.message}`)
					})
			} else {
				// aimp_id-список не изменился, но порядковые индексы могли сдвинуться —
				// обновляем маппинг на каждый poll
				this._updatePlaylistsFromApi(plList)
			}
		}

		this._updateVariables()
		this.checkFeedbacks(...this._allFeedbackIds())

		// ── Периодическое обновление кэша треков ──
		this._pollCount++
		if (this._pollCount % 5 === 0) {
			this._refreshAllTracks()
		}
	}

	/** Возвращает 0-based индекс трека в кэше по его API-id */
	_trackIndexById(aimpPlaylistId, trackId) {
		const tracks = this.tracksCache[String(aimpPlaylistId)]
		if (!tracks) return 0
		const idx = tracks.findIndex(t => t.id === String(trackId))
		return idx >= 0 ? idx : 0
	}

	// ── Variables ────────────────────────────────

	_registerVariables() {
		this.setVariableDefinitions({
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
			playing_track_title:   { name: 'Playing Track Title' },
			playing_track_artist:  { name: 'Playing Track Artist' },
			playing_playlist_id:   { name: 'Playing Playlist AIMP ID' },
			playing_playlist_name: { name: 'Playing Playlist Name' },
			playing_track_id:      { name: 'Playing Track ID' },
			focus_playlist_id:     { name: 'Focus Playlist AIMP ID' },
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
			is_muted: {
				type: 'boolean',
				name: 'Player: Is Muted',
				defaultStyle: { bgcolor: 0x884400, color: 0xffffff },
				options: [],
				callback: () => !!this.state.muted,
			},
			volume_above: {
				type: 'boolean',
				name: 'Player: Volume ≥ X%',
				defaultStyle: { bgcolor: 0x00aaaa, color: 0xffffff },
				options: [
					{ type: 'number', id: 'threshold', label: 'Threshold (0–100)', default: 50, min: 0, max: 100 },
				],
				callback: (fb) => this.state.volume >= fb.options.threshold,
			},
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
						type: 'number', id: 'trackId', label: 'Track ID',
						default: 0, min: 0, max: 99999,
					},
				],
				callback: (fb) =>
					String(this.state.focusPlaylistId) === String(fb.options.playlistId) &&
					String(this.state.focusTrackId)    === String(fb.options.trackId),
			},
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
						type: 'number', id: 'trackId', label: 'Track ID',
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
					const idx = this._playlistIndex(action.options.playlistId)
					if (idx == null) return
					await this._request('POST', `/playlists/${idx}/play`)
				},
			},
			playlist_select: {
				name: '☑ Playlist: Select (activate tab)',
				options: [
					{ type: 'dropdown', id: 'playlistId', label: 'Playlist', choices: plChoices, default: defaultPlId },
				],
				callback: async (action) => {
					const idx = this._playlistIndex(action.options.playlistId)
					if (idx == null) return
					await this._request('POST', `/playlists/${idx}/select`)
				},
			},
			playlist_action: {
				name: '🎶 Playlist: Play or Focus',
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
						id: 'action',
						label: 'Action',
						choices: [
							{ id: 'play',   label: '▶ Play from beginning' },
							{ id: 'select', label: '☑ Set focus (select tab)' },
						],
						default: 'play',
					},
				],
				callback: async (action) => {
					const idx = this._playlistIndex(action.options.playlistId)
					if (idx == null) return
					const act = action.options.action
					if (act === 'play') {
						await this._request('POST', `/playlists/${idx}/play`)
					} else {
						await this._request('POST', `/playlists/${idx}/select`)
					}
				},
			},

			// ══════════════════════════════════════════
			//  PLAYLIST TRACK NAVIGATION
			//  Next/Prev трека в рамках конкретного плейлиста
			// ══════════════════════════════════════════

			playlist_track_next: {
				name: '⏭ Playlist: Next Track (in playlist)',
				options: [
					{
						type: 'dropdown',
						id: 'playlistId',
						label: 'Playlist',
						choices: plChoices,
						default: defaultPlId,
					},
				],
				callback: async (action) => {
					const aimpId = action.options.playlistId
					const idx = this._playlistIndex(aimpId)
					if (idx == null) return
					await this._ensureTracksLoaded(aimpId)
					const tracks = this.tracksCache[String(aimpId)]
					if (!tracks || tracks.length === 0) return
					const currentTrackId = String(this.state.playingPlaylistId) === String(aimpId)
						? this.state.playingTrackId
						: this.state.focusTrackId
					const currentIdx = tracks.findIndex(t => t.id === String(currentTrackId))
					const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % tracks.length : 0
					await this._request('POST', `/playlists/${idx}/tracks/${tracks[nextIdx].id}/play`)
				},
			},
			playlist_track_prev: {
				name: '⏮ Playlist: Previous Track (in playlist)',
				options: [
					{
						type: 'dropdown',
						id: 'playlistId',
						label: 'Playlist',
						choices: plChoices,
						default: defaultPlId,
					},
				],
				callback: async (action) => {
					const aimpId = action.options.playlistId
					const idx = this._playlistIndex(aimpId)
					if (idx == null) return
					await this._ensureTracksLoaded(aimpId)
					const tracks = this.tracksCache[String(aimpId)]
					if (!tracks || tracks.length === 0) return
					const currentTrackId = String(this.state.playingPlaylistId) === String(aimpId)
						? this.state.playingTrackId
						: this.state.focusTrackId
					const currentIdx = tracks.findIndex(t => t.id === String(currentTrackId))
					const prevIdx = currentIdx > 0 ? currentIdx - 1 : tracks.length - 1
					await this._request('POST', `/playlists/${idx}/tracks/${tracks[prevIdx].id}/play`)
				},
			},

			// ══════════════════════════════════════════
			//  TRACK ACTIONS
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
						type: 'number',
						id: 'trackId',
						label: 'Track ID',
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
					const idx = this._playlistIndex(playlistId)
					if (idx == null) return
					if (act === 'play') {
						await this._request('POST', `/playlists/${idx}/tracks/${trackId}/play`)
					} else {
						await this._request('POST', `/playlists/${idx}/tracks/${trackId}/select`)
					}
				},
			},

			// Вариант с выбором трека через dropdown (browse).
			// Для каждого плейлиста создаётся свой dropdown треков, видимый только
			// когда выбран соответствующий плейлист (isVisibleExpression).
			track_action_browse: {
				name: '🎵 Track: Play or Focus (browse list)',
				options: [
					{
						type: 'dropdown',
						id: 'playlistId',
						label: 'Playlist',
						choices: plChoices,
						default: defaultPlId,
						disableAutoExpression: true,
					},
					...plChoices.map((pl) => {
						const tracks = this._trackChoicesFor(pl.id)
						return {
							type: 'dropdown',
							id: `track_${pl.id}`,
							label: `Track (${pl.label})`,
							choices: tracks,
							default: tracks[0]?.id ?? '0',
							isVisibleExpression: `$(options:playlistId) == '${pl.id}'`,
							allowCustom: true,
							minChoicesForSearch: 5,
						}
					}),
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
					const { playlistId, action: act } = action.options
					if (!playlistId) {
						this.log('warn', `track_action_browse: playlistId is empty`)
						return
					}
					const idx = this._playlistIndex(playlistId)
					if (idx == null) {
						this.log('warn', `track_action_browse: unknown playlist ${playlistId}`)
						return
					}
					const trackField = `track_${playlistId}`
					const trackId = action.options[trackField]
					if (trackId == null || trackId === '') {
						this.log('warn', `track_action_browse: trackId not found in field "${trackField}"`)
						return
					}
					this.log('debug', `track_action_browse: playlist=${playlistId} (idx=${idx}), track=${trackId}, action=${act}`)
					if (act === 'play') {
						await this._request('POST', `/playlists/${idx}/tracks/${trackId}/play`)
					} else {
						await this._request('POST', `/playlists/${idx}/tracks/${trackId}/select`)
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
		playerState:           'stopped',
		volume:                50,
		muted:                 false,
		position:              0,
		duration:              0,

		// Playing — привязка к aimp_id плейлиста
		playingPlaylistId:     '',   // aimp_id (GUID)
		playingPlaylistName:   '',
		playingTrackId:        '',   // track index in playlist
		playingTrackTitle:     '',
		playingTrackArtist:    '',

		// Focus — привязка к aimp_id плейлиста
		focusPlaylistId:       '',   // aimp_id (GUID)
		focusPlaylistName:     '',
		focusTrackId:          '',   // track index in playlist
		focusTrackIndex:       0,
		focusTrackTitle:       '',
		focusTrackArtist:      '',

		// Internal — отслеживание изменений по aimp_id
		_playlistAimpIds:      '',
	}
}
