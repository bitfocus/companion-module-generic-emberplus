import {
	createModuleLogger,
	InstanceBase,
	InstanceStatus,
	type CompanionVariableDefinitions,
	type CompanionVariableValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { type ActionSchema, GetActionsList } from './actions.js'
import { type CompositeElementSchema, UpdateCompositeElements } from './composites.js'
import { connectionVariablesDefault, type EmberPlusConfig, GetConfigFields, portDefault } from './config.js'
import { GetPresetsList } from './presets.js'
import { onlyValueChanged, presetFieldsChanged } from './presets/fields.js'
import { type FeedbackSchema, GetFeedbacksList } from './feedback.js'
import { EmberPlusState } from './state.js'
import {
	EmberClient,
	Model as EmberModel,
	setDebugLogging,
	type Types as EmberTypes,
} from '@phillipivan/emberplus-connection'
import { describe } from './logging.js'
import {
	isMatrixNode,
	isNotFound,
	isNToN,
	loadMatrixContents,
	matrixLabel,
	matrixPaths,
	readSignalLabels,
	signalChoices,
	type MatrixInfo,
} from './matrices.js'
import { StatusManager } from './status.js'
import { UpgradeScripts } from './upgrades.js'
import {
	sanitiseVariableId,
	parseBonjourHost,
	hasConnectionChanged,
	recordParameterAction,
	parseParameterValue,
	discoverFunctionsFromTree,
	isStreamParameter,
	isValidHostname,
	isValidPort,
	resolvePath,
} from './util.js'
import {
	GetMatrixVariablesList,
	GetVariablesList,
	hasParameterVariables,
	matrixVariableValues,
	parameterVariableValue,
	type MatrixVariables,
	type ParameterVariables,
} from './variables.js'
import PQueue from 'p-queue'
import { throttle, debounce } from 'es-toolkit'

/** How often feedbacks are rechecked and variables set, at most: streams, such as meters, should follow quickly */
const FeedbackThrottleRate = 10

/** Where the library's debug output goes, with Verbose Logs on */
const libraryLogger = createModuleLogger('ember plus')

interface updateCompanionBitsOptions {
	updateActions?: boolean
	updateFeedbacks?: boolean
	updatePresets?: boolean
	updateVariables?: boolean
}

export type ModuleTypes = {
	config: EmberPlusConfig
	secrets: undefined
	actions: ActionSchema
	feedbacks: FeedbackSchema
	// One variable per monitored parameter, so the ids are only known at runtime
	variables: CompanionVariableValues
	compositeElements: CompositeElementSchema
}

export { UpgradeScripts }

/** Whether a tree element is a stream parameter, numbered or qualified, which the library can subscribe to */
function isStreamNode(
	node: EmberModel.TreeElement<EmberModel.EmberElement> | undefined,
): node is EmberTypes.ElementOf<EmberModel.Parameter> {
	return (
		node !== undefined &&
		node.contents.type === EmberModel.ElementType.Parameter &&
		isStreamParameter(node.contents) &&
		(EmberModel.isNumbered(node) || EmberModel.isQualified(node))
	)
}

/**
 * Companion instance class for generic EmBER+ Devices
 */
export default class EmberPlusInstance extends InstanceBase<ModuleTypes> {
	private emberClient!: EmberClient
	private config!: EmberPlusConfig
	private state: EmberPlusState = new EmberPlusState()
	private emberQueue: PQueue = new PQueue({ concurrency: 1, autoStart: true })
	private feedbacksToCheck: Set<string> = new Set<string>()
	private variableValueUpdates: CompanionVariableValues = {}
	private lastVariableDefinitions: string | undefined
	private isRecordingActions: boolean = false
	/** Whether the current client has connected and been set up, so a later 'connected' is the library reconnecting */
	private clientSetUp: boolean = false
	/** Whether the current client has loaded the top level of the tree, for the functions it lists */
	private treeLoaded: boolean = false
	/** Paths with a callback registered on the current client. The library keeps them across reconnects */
	private pathCallbacks: Set<string> = new Set()
	/**
	 * The stream parameters subscribed to on the current client, with the node each was subscribed with. The library
	 * subscribes again after a reconnect
	 */
	private streamSubscriptions: Map<string, EmberTypes.ElementOf<EmberModel.Parameter>> = new Map()
	/** Each parameter feedback's latest check, so that a check overtaken by a release or a later check is dropped */
	private feedbackGenerations: Map<string, number> = new Map()
	private feedbackGenerationCounter = 0
	/** Matrices the provider has reported changes to, or that were loaded, for the next throttled update */
	private matricesToUpdate: Set<string> = new Set()
	/** What each matrix's dropdowns last listed, so that the definitions are only rebuilt when that changes */
	private matrixChoiceSignatures: Map<string, string> = new Map()
	/** Each matrix variable's value as last set, serialised, so that only the ones a report changed are set */
	private matrixValuesSet: Map<string, string> = new Map()
	/** The matrix variables' definitions, built once for each change to the matrices or the kinds chosen */
	private matrixVariableDefinitions:
		{ kinds: string; definitions: CompanionVariableDefinitions; serialised: string } | undefined
	private statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 */
	public async init(config: EmberPlusConfig): Promise<void> {
		this.applyConfig(config)
		// Nothing here comes from the device, and a button saved with one of these elements needs its definition whether
		// or not the connection is ever made
		UpdateCompositeElements(this)
		// The variables of the configured paths exist from the start, connected or not
		this.setupMatrices()
		this.setupMonitoredParams()
		this.connect()
	}

	/**
	 * Process an updated configuration array.
	 */
	public async configUpdated(config: EmberPlusConfig): Promise<void> {
		const oldConfig = structuredClone(this.config)
		this.log('debug', `Old Config: ${describe(oldConfig)}`)

		this.applyConfig(config)

		if (hasConnectionChanged(oldConfig, config)) {
			this.resetConnection()
			// The matrices the config now names, for the dropdowns while connecting, or for good if the new host can't be
			// reached. (The monitored paths stay as they were until connected, keeping their variables: see
			// EmberPlusState.clear.)
			this.setupMatrices()
			this.connect()
		} else {
			this.finalizeSetup().catch((e) => this.log('error', `Error during finalize setup: ${describe(e)}`))
		}
	}

	/**
	 * Change the host and/or port of the connection, persisting it to the module config.
	 * Values left undefined are kept as configured.
	 */
	public async setHost(host?: string, port?: number): Promise<void> {
		if (host !== undefined && !isValidHostname(host)) throw new Error(`Set Host: Invalid hostname: ${host}`)
		if (port !== undefined && !isValidPort(port)) throw new Error(`Set Host: Invalid port: ${port}`)

		// bonjourHost takes precedence over host in applyConfig, so it must be cleared
		const config: EmberPlusConfig = {
			...this.config,
			bonjourHost: undefined,
			host: host ?? this.config.host,
			port: port ?? this.config.port,
		}
		this.saveConfig(config)
		await this.configUpdated(config)
	}

	/**
	 * Creates the configuration fields for web config.
	 */
	public getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	/**
	 * Clean up the instance before it is destroyed.
	 */
	public async destroy(): Promise<void> {
		this.throttledFeedbackChecksVariableUpdates.cancel()
		this.debouncedUpdateActionFeedbackDefs.cancel()
		this.debouncedStreamSync.cancel()
		this.emberQueue.clear()
		this.destroyEmberClient()
		this.statusManager.destroy()
	}

	private applyConfig(config: EmberPlusConfig): void {
		this.config = config
		setDebugLogging(Boolean(config.verbose), (message) => libraryLogger.debug(message))
		const [host, port] = parseBonjourHost(config)
		this.config.host = host
		this.config.port = port
		this.log('debug', `New Config: ${describe(this.config)}`)
	}

	/**
	 * Drop the client and what was learnt from its provider: on a host or port change, where the next provider's tree
	 * may be another. The monitored paths stay, so their variables do (see EmberPlusState.clear).
	 */
	private resetConnection(): void {
		this.throttledFeedbackChecksVariableUpdates.cancel()
		this.emberQueue.clear()
		this.feedbacksToCheck.clear()
		this.debouncedUpdateActionFeedbackDefs.cancel()
		this.debouncedStreamSync.cancel()
		this.destroyEmberClient()
		this.variableValueUpdates = {}
		this.state.clear()
		this.matricesToUpdate.clear()
		this.forgetMatrixUpdates()
	}

	/** Forget what was sent for the matrices, so that it is all sent again: the matrices are being loaded afresh */
	private forgetMatrixUpdates(): void {
		this.matrixChoiceSignatures.clear()
		this.matrixValuesSet.clear()
		this.matrixVariableDefinitions = undefined
	}

	/**
	 * Set up on a client's first connection, or after a config change: rebuild the matrices and monitored paths from
	 * the config, and register every path in use with the provider, the configured ones, the actions' (through their
	 * subscribe) and the feedbacks' (through their callback).
	 */
	private async finalizeSetup(): Promise<void> {
		this.state.clearCache()
		this.setupMatrices()
		this.setupMonitoredParams()
		this.updateCompanionBits({
			updateActions: true,
			updateFeedbacks: true,
			updatePresets: true,
			updateVariables: true,
		})
		this.setVariableValues({ host: this.config.host ?? '', port: this.config.port ?? portDefault })
		await this.registerParameters()
		// Re-run subscribe/callbacks so paths registered at runtime are subscribed on the new client.
		// Feedbacks re-register from their callback; actions only register from subscribe, which Companion won't call again on its own.
		this.subscribeActions()
		this.checkAllFeedbacks()
		// Once the actions and feedbacks have registered again, end the streams nothing uses any more: a stream variable
		// turned off, or a configured path removed
		this.debouncedStreamSync()
		await this.loadMatrices()
	}

	/**
	 * Update defintions of actions, feedbacks, variables. Optionally presets
	 */

	public updateCompanionBits(
		options: updateCompanionBitsOptions = {
			updateActions: true,
			updateFeedbacks: true,
			updatePresets: false,
			updateVariables: true,
		},
	): void {
		if (options.updateActions)
			this.setActionDefinitions(GetActionsList(this, this.client, this.config, this.state, this.emberQueue))
		if (options.updateFeedbacks)
			this.setFeedbackDefinitions(GetFeedbacksList(this, this.client, this.config, this.state))
		if (options.updateVariables) this.updateVariableDefinitions()
		if (options.updatePresets) {
			const { structure, presets } = GetPresetsList(this.state)
			this.setPresetDefinitions(structure, presets)
		}
	}

	/**
	 * Send variable definitions only when they differ from the last set sent.
	 * Every feedback re-registering its path after a reconnect lands here, almost always with an unchanged set.
	 */
	private updateVariableDefinitions(): void {
		// A large matrix has thousands of variables, which only change as the matrices do: build them once for that
		const kinds = JSON.stringify(this.matrixVariables)
		if (this.matrixVariableDefinitions?.kinds !== kinds) {
			const definitions = GetMatrixVariablesList(this.state, this.matrixVariables)
			this.matrixVariableDefinitions = { kinds, definitions, serialised: JSON.stringify(definitions) }
		}
		const variables = GetVariablesList(this.state, this.parameterVariables)
		const serialised = JSON.stringify(variables) + this.matrixVariableDefinitions.serialised
		if (serialised === this.lastVariableDefinitions) return
		this.lastVariableDefinitions = serialised
		this.setVariableDefinitions({ ...variables, ...this.matrixVariableDefinitions.definitions })
	}

	/** The definitions and presets, once the registrations or reports that changed them have settled */
	public debouncedUpdateActionFeedbackDefs = debounce(() => {
		this.updateCompanionBits({ updateActions: true, updateFeedbacks: true, updatePresets: true, updateVariables: true })
	}, 500)

	/**
	 * Which parameters get variables (Parameter - Values and Parameter - Streams in Connection Variables). A config
	 * without the option (none should reach here: v300 adds it) gets the default
	 */
	private get parameterVariables(): ParameterVariables {
		const chosen = this.config.variables ?? connectionVariablesDefault
		return { values: chosen.includes('parameterValues'), streams: chosen.includes('parameterStreams') }
	}

	/** Which matrix variables there are (Matrix - Target Names, Source Names and Connections in Connection Variables) */
	private get matrixVariables(): MatrixVariables {
		const chosen = this.config.variables ?? connectionVariablesDefault
		return {
			targetNames: chosen.includes('matrixTargetNames'),
			sourceNames: chosen.includes('matrixSourceNames'),
			connections: chosen.includes('matrixConnections'),
		}
	}

	/**
	 * Whether a stream parameter's values are wanted: while a feedback reads it, or while it has a variable (Parameter -
	 * Streams, for a monitored path). Actions don't keep a stream: they read the value when they run
	 */
	private streamInUse(path: string): boolean {
		return (
			this.state.getFeedbacksByPath(path).size > 0 ||
			(this.parameterVariables.streams && this.state.monitoredParameters.has(path))
		)
	}

	/**
	 * Subscribe to a stream parameter's values while they are in use, and unsubscribe once they aren't: a provider sends
	 * stream values, many times a second, only to the consumers that subscribed. The values reach the path's callback.
	 * Anything else at the path needs nothing.
	 */
	public updateStreamSubscription(path: string): void {
		const client = this.emberClient
		if (!client) return
		const subscribed = this.streamSubscriptions.get(path)
		const node = this.state.emberElement.get(path)
		const stream = isStreamNode(node) ? node : undefined

		if (stream && !subscribed && this.streamInUse(path)) {
			this.streamSubscriptions.set(path, stream)
			this.log('debug', `Subscribing to the stream of ${path}`)
			// A Subscribe made while the connection is down isn't sent, and the library won't send it after reconnecting:
			// so it isn't held as subscribed either, and registerAgain subscribes again
			const notSent = (reason: string) => {
				if (this.streamSubscriptions.get(path) === stream) this.streamSubscriptions.delete(path)
				this.log('warn', `Failed to subscribe to the stream of ${path}: ${reason}`)
			}
			client.subscribe(stream).then(
				(request) => {
					if (!request.sentOk) notSent('not sent')
				},
				(e) => notSent(describe(e)),
			)
		} else if (subscribed && !this.streamInUse(path)) {
			this.unsubscribeStream(client, path, subscribed)
		}
	}

	/**
	 * End a stream. The library holds one subscription for an element, whichever spelling of its path (1.2.3,
	 * device.meters.meter) subscribed: while another spelling is still subscribed, only this one's entry goes. Otherwise
	 * unsubscribing drops every callback the library holds for the element, and the GetDirectory it would send again
	 * after a reconnect: so forget every spelling of the element, and each one's next use registers it afresh.
	 */
	private unsubscribeStream(
		client: EmberClient,
		path: string,
		subscribed: EmberTypes.ElementOf<EmberModel.Parameter>,
	): void {
		this.streamSubscriptions.delete(path)
		const element = client.getInternalNodePath(subscribed)
		const sameElement = (node: EmberModel.TreeElement<EmberModel.EmberElement>) =>
			node === subscribed || (element !== undefined && client.getInternalNodePath(node) === element)

		for (const [other, node] of this.streamSubscriptions) {
			if (sameElement(node)) {
				this.log('debug', `The stream of ${path} goes on for ${other}, the same element`)
				return
			}
		}

		for (const [other, node] of this.state.emberElement) {
			if (other !== path && !sameElement(node)) continue
			this.pathCallbacks.delete(other)
			this.state.emberElement.delete(other)
		}
		this.pathCallbacks.delete(path)
		this.state.emberElement.delete(path)
		this.log('debug', `Unsubscribing from the stream of ${path}`)
		client
			.unsubscribe(subscribed)
			.catch((e) => this.log('warn', `Failed to unsubscribe from the stream of ${path}: ${describe(e)}`))
	}

	/**
	 * Bring the streams in line with what uses them, once a config change or a reconnect has settled: end those no longer
	 * in use, and subscribe to those in use but not subscribed (a Subscribe that wasn't sent)
	 */
	private debouncedStreamSync = debounce(() => {
		const paths = new Set([
			...this.streamSubscriptions.keys(),
			...this.state.monitoredParameters,
			...this.state.feedbackPaths(),
		])
		for (const path of paths) this.updateStreamSubscription(path)
	}, 1000)

	/**
	 * A parameter feedback reads a path: register it, recheck the feedback when it changes, and keep its stream while
	 * the feedback reads it. A feedback edited onto another path leaves the one it read. One that doesn't read the value
	 * (`readsValue` false: a Parameter Property of its name, range and the like) isn't rechecked for a report of only a
	 * new value, as a stream sends many times a second. Returns whether the path holds an element.
	 */
	public async useParameterForFeedback(
		feedbackId: string,
		path: string,
		signal?: AbortSignal,
		readsValue = true,
	): Promise<boolean> {
		// Registering waits in the queue. Meanwhile the feedback may be released, or checked again on another path: then
		// this check's outcome is stale, and applying it would put back a feedback Companion has removed, its stream with it
		const generation = ++this.feedbackGenerationCounter
		this.feedbackGenerations.set(feedbackId, generation)
		const found = (await this.registerNewParameter(path, signal)) !== undefined
		signal?.throwIfAborted()
		if (this.feedbackGenerations.get(feedbackId) !== generation) return found
		const previous = this.state.feedbackPath(feedbackId)
		if (found) this.state.addIdToPathMap(feedbackId, path, readsValue)
		else this.state.removeFeedbackId(feedbackId)
		if (previous !== undefined && previous !== path) this.updateStreamSubscription(previous)
		if (found) this.updateStreamSubscription(path)
		return found
	}

	/** A parameter feedback is removed or disabled: stop rechecking it, and end its stream if nothing else reads it */
	public releaseParameterFeedback(feedbackId: string): void {
		this.feedbackGenerations.delete(feedbackId)
		const previous = this.state.feedbackPath(feedbackId)
		this.state.removeFeedbackId(feedbackId)
		if (previous !== undefined) this.updateStreamSubscription(previous)
	}

	private get client(): EmberClient {
		return this.emberClient
	}

	/**
	 * Whether a client is the one in use. Work that started on a client a host change has since replaced must not
	 * cache what it found: an element from the old provider, cached, would be returned for the path in place of
	 * registering it with the new one.
	 */
	public isCurrentClient(client: EmberClient): boolean {
		return client === this.emberClient
	}

	private destroyEmberClient(): void {
		if (this.emberClient !== undefined) {
			this.emberClient.removeAllListeners()
			// discard() stops the library's reconnect attempts, also for a client that never connected
			this.emberClient.discard()
			this.clientSetUp = false
			this.treeLoaded = false
			this.pathCallbacks.clear()
			this.streamSubscriptions.clear()
			// A host change destroys the client twice, via resetConnection and setupEmberConnection
			this.emberClient = undefined as unknown as EmberClient
		}
	}

	/** Connect without waiting: the library goes on trying, and the events report how it goes */
	private connect(): void {
		this.setupEmberConnection().catch((e) => {
			this.log('error', `Failed to set up the connection: ${describe(e)}`)
			this.statusManager.updateStatus(InstanceStatus.UnknownError, describe(e))
		})
	}

	/**
	 * Build the client for the configured host and connect it. The library retries a connection that fails or drops,
	 * backing off from 5 s to a minute, and once reconnected sends its GetDirectories and Subscribes again, keeping its
	 * tree and callbacks: the module only builds a new client when the host or port changes.
	 */
	private async setupEmberConnection(): Promise<void> {
		this.destroyEmberClient()

		// The action callbacks hold the client they were defined with: define them with this one, so that after a host
		// change none uses the client just discarded, connected or not
		// The host and port variables say where the module is connecting, reachable or not
		const define = () => {
			this.updateCompanionBits({
				updateActions: true,
				updateFeedbacks: true,
				updatePresets: true,
				updateVariables: true,
			})
			this.setVariableValues({ host: this.config.host ?? '', port: this.config.port ?? portDefault })
		}

		if (!this.config.host) {
			this.statusManager.updateStatus(InstanceStatus.BadConfig, 'No Host')
			define()
			return
		}

		this.log('info', `Connecting to ${this.config.host}:${this.config.port}`)
		this.statusManager.updateStatus(InstanceStatus.Connecting)

		const client = new EmberClient(this.config.host, this.config.port)
		this.emberClient = client
		define()

		client.on('error', (e) => this.handleConnectionError(client, e))
		client.on('connected', () => this.handleConnected(client))
		client.on('disconnected', () => this.handleDisconnected(client))

		// Settles once connected, or with the Error of a failed attempt; the library goes on retrying either way, and
		// the error event has logged it
		const result = await client.connect()
		if (result instanceof Error && this.isCurrentClient(client) && !client.connected) {
			this.statusManager.updateStatus(InstanceStatus.ConnectionFailure, result.message)
		}
	}

	private handleConnectionError(client: EmberClient, error: Error): void {
		if (!this.isCurrentClient(client)) return
		this.log('error', `Connection Error: ${describe(error)}`)
		// The library also reports errors on a working connection, such as a message it couldn't decode
		if (!client.connected) this.statusManager.updateStatus(InstanceStatus.ConnectionFailure, error.message)
	}

	private handleConnected(client: EmberClient): void {
		if (!this.isCurrentClient(client)) return
		this.log('info', `Connected to ${this.config.host}:${this.config.port}`)

		if (this.clientSetUp) {
			this.statusManager.updateStatus(InstanceStatus.Ok)
			this.registerAgain(client)
			return
		}
		this.clientSetUp = true

		void (async () => {
			await this.loadTree(client)
			if (!this.isCurrentClient(client)) return
			this.finalizeSetup().catch((e) => this.log('error', `Error during finalize setup: ${describe(e)}`))
		})()
	}

	/**
	 * Load the top level of the tree, for the functions it lists. Registering paths doesn't need it: the library loads
	 * the top level itself for a path it doesn't have
	 */
	private async loadTree(client: EmberClient): Promise<void> {
		try {
			const request = await client.getDirectory(client.tree)
			await request.response
			if (!this.isCurrentClient(client)) return
			this.treeLoaded = true
			discoverFunctionsFromTree(client.tree, this.state)
			this.statusManager.updateStatus(InstanceStatus.Ok)
		} catch (e) {
			if (!this.isCurrentClient(client)) return
			this.log('warn', `Failed to load the top level of the tree: ${describe(e)}`)
			this.statusManager.updateStatus(InstanceStatus.UnknownWarning, describe(e))
		}
	}

	/**
	 * The library reconnected this client, keeping its tree and callbacks, and has sent again the GetDirectories and
	 * Subscribes that reached the provider. What didn't (a lookup that failed, or a Subscribe made while the connection
	 * was down) it knows nothing of, so register every path in use again: one already registered costs nothing more,
	 * having its callback (pathCallbacks), and gets no second one. Then subscribe again to the streams in use.
	 */
	private registerAgain(client: EmberClient): void {
		void (async () => {
			if (!this.treeLoaded) await this.loadTree(client)
			if (!this.isCurrentClient(client)) return
			await this.registerParameters()
			this.subscribeActions()
			this.checkAllFeedbacks()
			this.debouncedStreamSync()
			// Their labels may have changed while disconnected, and a provider may have gained a matrix it lacked
			await this.loadMatrices()
		})().catch((e) => this.log('error', `Error registering again after reconnecting: ${describe(e)}`))
	}

	private handleDisconnected(client: EmberClient): void {
		if (!this.isCurrentClient(client)) return
		this.statusManager.updateStatus(InstanceStatus.Connecting, 'Disconnected')
		this.log('warn', `Disconnected from ${this.config.host}:${this.config.port}`)
	}

	/** Set the matrices from the config, and clear the XY selection */
	private setupMatrices(): void {
		this.state.setMatrixPaths(matrixPaths(this.config.matricesString))
		// A matrix no longer configured takes its variables with it
		this.matrixVariableDefinitions = undefined
		this.state.clearSelection()
	}

	/**
	 * Load the configured matrices from the provider, one by one, on connecting, reconnecting, and after a config change.
	 * Each starts out configured, so one dropped last time, as not a matrix, is looked for again. What was sent for them
	 * is forgotten, so that their definitions and variables are sent afresh.
	 */
	private async loadMatrices(): Promise<void> {
		const client = this.emberClient
		if (!client) return
		this.state.setMatrixPaths(matrixPaths(this.config.matricesString))
		this.forgetMatrixUpdates()
		this.debouncedUpdateActionFeedbackDefs()
		for (const info of [...this.state.matrices.values()]) {
			if (!this.isCurrentClient(client)) return
			await this.loadMatrix(client, info)
		}
	}

	/**
	 * Load a matrix: look it up, following its changes, then send a GetDirectory on it, which a provider answers with its
	 * targets, sources and connections and which asks it to report their changes; then read its labels. A path that
	 * holds no element, or one that isn't a matrix, is dropped with a warning. One that can't be looked up just now (the
	 * connection dropped, or the provider didn't answer) is kept, and looked for again on reconnecting.
	 */
	private async loadMatrix(client: EmberClient, info: MatrixInfo): Promise<void> {
		const { path } = info
		let node: EmberModel.TreeElement<EmberModel.EmberElement> | undefined
		try {
			node = await this.emberQueue.add(async () => this.getElementByPath(path, resolvePath(path)))
		} catch (e) {
			if (!this.isCurrentClient(client)) return
			if (isNotFound(e)) {
				this.dropMatrix(path, 'was not found')
			} else {
				this.log('warn', `Matrix ${path} could not be loaded, and is looked for again on reconnecting: ${describe(e)}`)
			}
			return
		}
		if (!this.isCurrentClient(client) || this.state.matrices.get(path) !== info) return
		if (!isMatrixNode(node)) {
			this.dropMatrix(path, node ? 'is not a matrix' : 'was not found')
			return
		}
		// Another element (the provider was changed) has its connections to load afresh
		if (info.node !== node) info.connectionsLoaded = false
		info.node = node
		this.matrixChanged(path)

		try {
			const answered = await this.emberQueue.add(async () => loadMatrixContents(client, node))
			if (answered && this.isCurrentClient(client) && info.node === node) info.connectionsLoaded = true
		} catch (e) {
			if (!this.isCurrentClient(client)) return
			this.log('warn', `Matrix ${path}: its targets, sources and connections could not be loaded: ${describe(e)}`)
		}

		try {
			// A signal whose label can't be read just now keeps the one it had
			info.labels = await readSignalLabels(
				client,
				node,
				(location, e) => this.log('debug', `Matrix ${path}: no labels from ${location}: ${describe(e)}`),
				info.labels,
			)
		} catch (e) {
			if (!this.isCurrentClient(client)) return
			this.log('warn', `Matrix ${path}: its labels could not be read: ${describe(e)}`)
		}
		if (!this.isCurrentClient(client)) return
		const { targets, sources } = node.contents
		this.log(
			'debug',
			`Matrix ${path} loaded: ${targets?.size ?? node.contents.targetCount ?? 0} targets, ${sources?.size ?? node.contents.sourceCount ?? 0} sources, ${info.labels.targets.size + info.labels.sources.size} labels`,
		)
		this.matrixChanged(path)
	}

	/** Leave out a configured matrix the provider showed not to be one, until the next connection or config change */
	private dropMatrix(path: string, reason: string): void {
		this.log('warn', `Matrix ${path} ${reason}, so it is left out until the next connection or config change`)
		this.state.dropMatrix(path, reason)
		this.matrixVariableDefinitions = undefined
		this.state.getMatrixFeedbacks(path).forEach((id) => this.feedbacksToCheck.add(id))
		this.throttledFeedbackChecksVariableUpdates()
		this.debouncedUpdateActionFeedbackDefs()
	}

	/** A matrix was loaded, or the provider reported a change to it: update what shows it, at the next throttled update */
	private matrixChanged(path: string): void {
		this.matricesToUpdate.add(path)
		this.throttledFeedbackChecksVariableUpdates()
	}

	/**
	 * Bring what shows a matrix up to date: the definitions, when what its dropdowns list has changed (a label, or a
	 * signal, which come with the matrix's own reports); the variable definitions with them; the variables a report
	 * changed; and the Matrix Property feedbacks reading it.
	 */
	private updateMatrix(path: string): void {
		const info = this.state.matrices.get(path)
		if (!info) return
		const signature = JSON.stringify([
			matrixLabel(info),
			isNToN(info.node?.contents),
			signalChoices(info, 'target'),
			signalChoices(info, 'source'),
		])
		if (this.matrixChoiceSignatures.get(path) !== signature) {
			this.matrixChoiceSignatures.set(path, signature)
			this.matrixVariableDefinitions = undefined
			this.updateVariableDefinitions()
			this.debouncedUpdateActionFeedbackDefs()
		}
		for (const [id, value] of Object.entries(matrixVariableValues(info, this.matrixVariables))) {
			const serialised = JSON.stringify(value)
			if (this.matrixValuesSet.get(id) === serialised) continue
			this.matrixValuesSet.set(id, serialised)
			this.variableValueUpdates[id] = value
		}
		this.state.getMatrixFeedbacks(path).forEach((id) => this.feedbacksToCheck.add(id))
	}

	private setupMonitoredParams(): void {
		// Rebuild from config only. Paths registered at runtime by actions and feedbacks are dropped here and
		// re-added by subscribeActions() / checkFeedbacks() in finalizeSetup, which prunes paths no longer in use
		// (eg. a path option driven by a variable that has since changed).
		const params = (this.config.monitoredParametersString ?? '')
			.replaceAll('/', '.')
			.split(',')
			.map((param) => param.trim())
			.filter((param) => param.length > 0)
			.sort()
		this.state.monitoredParameters = new Set(params)
	}

	private async registerParameters() {
		this.log('debug', 'Start parameter registration')
		// A reconnect or config change clears the queue, rejecting the registration awaited below. Stop there, rather
		// than go on to register the remaining paths against the next client, or none
		const client = this.emberClient
		for (const path of this.state.monitoredParameters ?? []) {
			if (!this.isCurrentClient(client)) return
			if (path === '') continue
			this.log('debug', `Attempt to subscribe to ${path}`)
			await this.emberQueue
				.add(async () => {
					try {
						const initial_node = await this.getElementByPath(path)
						if (initial_node && this.isCurrentClient(client)) {
							this.log('debug', `Registered for path ${path}`)
							if (initial_node.contents.type === EmberModel.ElementType.Function) {
								this.state.updateFunctionMap(path, initial_node)
							} else if (initial_node.contents.type === EmberModel.ElementType.Parameter) {
								this.state.updateParameterMap(path, initial_node)
								await this.handleChangedValue(path, initial_node)
							}
						}
					} catch (e) {
						if (this.isCurrentClient(client)) this.log('error', `Failed to subscribe to path ${path}: ${describe(e)}`)
					}
				})
				.catch((e) => {
					this.log('debug', `Failed to register parameter: ${describe(e)}`)
				})
		}
		this.debouncedUpdateActionFeedbackDefs()
	}

	/**
	 * Look up a path, registering a callback for its changes the first time on this client. The library calls every
	 * callback registered for an element, and keeps them across reconnects, so registering on every lookup would run
	 * handleChangedValue once more per change after each config save or cache clear. Each spelling of a path (1.2.3,
	 * device.channel.gain) has its own callback, so each spelling's state, variables and feedbacks follow the element.
	 */
	private async getElementByPath(
		path: string,
		lookup: string = path,
	): Promise<EmberModel.TreeElement<EmberModel.EmberElement> | undefined> {
		const client = this.emberClient
		if (this.pathCallbacks.has(path)) return client.getElementByPath(lookup)

		const node = await client.getElementByPath(lookup, (updatedNode) => {
			if (!this.isCurrentClient(client)) return
			this.handleChangedValue(path, updatedNode).catch((e) =>
				this.log('error', `Error handling parameter ${path}: ${describe(e)}`),
			)
		})
		if (node && this.isCurrentClient(client)) this.pathCallbacks.add(path)
		return node
	}

	/**
	 * Register a path an action or feedback uses: look it up, follow its changes, and for a parameter add it to the
	 * monitored paths, which get variables when the Parameter - Values connection variables are on.
	 */
	public async registerNewParameter(
		path: string,
		signal?: AbortSignal,
	): Promise<EmberModel.TreeElement<EmberModel.EmberElement> | undefined> {
		if (path === '') return undefined

		// Return cached element if already registered. A parameter is registered once it is monitored; anything else
		// (a function, or a matrix an action cached) needs nothing more
		const cached = this.state.emberElement.get(path)
		if (
			cached &&
			(cached.contents.type !== EmberModel.ElementType.Parameter || this.state.monitoredParameters.has(path))
		) {
			return cached
		}

		const client = this.emberClient
		return this.emberQueue
			.add(
				async () => {
					try {
						const node = await this.getElementByPath(path)

						// Found on a client a host change has replaced: caching it would keep the path from being registered
						// with the new provider
						if (!node || !this.isCurrentClient(client)) {
							return undefined
						}

						if (node.contents.type === EmberModel.ElementType.Function) {
							this.log('debug', `Registered function for path ${path}`)
							this.state.updateFunctionMap(path, node)
							this.debouncedUpdateActionFeedbackDefs()
							return node
						}

						if (node.contents.type !== EmberModel.ElementType.Parameter) {
							return node
						}

						this.log('debug', `Registered for path ${path}`)
						if (this.config.verbose) this.log('debug', `${path}: ${describe(node.contents)}`)

						this.state.monitoredParameters.add(path)

						this.state.updateParameterMap(path, node)
						this.updateCompanionBits({
							updateVariables: true,
							updateActions: false,
							updateFeedbacks: false,
							updatePresets: false,
						})
						this.debouncedUpdateActionFeedbackDefs()
						await this.handleChangedValue(path, node)

						return node
					} catch (e) {
						if (this.isCurrentClient(client)) this.log('error', `Failed to subscribe to path ${path}: ${describe(e)}`)
						return undefined
					}
				},
				{ signal },
			)
			.catch((e) => {
				this.log('debug', `Failed to register parameter: ${describe(e)}`)
				return undefined
			})
	}

	// Track whether actions are being recorded
	public handleStartStopRecordActions(isRecording: boolean): void {
		this.isRecordingActions = isRecording
	}

	// Throttled feedback checks and variable updates for better efficiency in busy systems
	private throttledFeedbackChecksVariableUpdates = throttle(
		() => {
			for (const path of this.matricesToUpdate) this.updateMatrix(path)
			this.matricesToUpdate.clear()
			if (this.feedbacksToCheck.size > 0) {
				this.checkFeedbacksById(...this.feedbacksToCheck.values())
				this.feedbacksToCheck.clear()
			}
			if (Object.keys(this.variableValueUpdates).length > 0) {
				this.setVariableValues(this.variableValueUpdates)
				this.variableValueUpdates = {}
			}
		},
		FeedbackThrottleRate,
		{ edges: ['leading', 'trailing'] },
	)

	public async handleChangedValue(path: string, node: EmberModel.TreeElement<EmberModel.EmberElement>): Promise<void> {
		// A configured matrix's connections, targets or sources, or its contents
		if (node.contents.type === EmberModel.ElementType.Matrix) {
			if (this.state.matrices.has(path)) this.matrixChanged(path)
			return
		}
		if (node.contents.type !== EmberModel.ElementType.Parameter) return

		// Every value of every parameter, stream values many times a second: only with Verbose Logs
		if (this.config.verbose)
			this.log('debug', `Got parameter value for ${path}: ${describe(node.contents.value ?? '')}`)
		const previous = this.state.parameters.get(path)
		this.state.updateParameterMap(path, node)
		const parameter = this.state.parameters.get(path) ?? node.contents
		// Its presets follow its type, access, range and online state, not its value
		if (previous && presetFieldsChanged(previous, parameter)) this.debouncedUpdateActionFeedbackDefs()
		// Only a new value, as a stream's: the feedbacks that don't read the value have nothing to recheck
		const valueOnly = previous !== undefined && onlyValueChanged(previous, parameter)

		// A stream identifier may come only with a later report
		this.updateStreamSubscription(path)
		this.updateFeedbacksAndVariables(path, parameter, valueOnly)

		// A meter's values aren't actions to record
		if (!this.isRecordingActions || isStreamParameter(parameter)) return
		const { actionType, value } = parseParameterValue(node.contents)
		// A null value can't be set, and a parameter of another type has no action
		if (actionType !== undefined && value !== null) {
			recordParameterAction(path, actionType, value, this, this.state)
		}
	}

	/**
	 * Recheck the feedbacks reading a parameter, and set its variables if it has them, for any type of parameter: the
	 * Parameter Property feedback reads octet strings and the rest too
	 */
	private updateFeedbacksAndVariables(path: string, parameter: EmberModel.Parameter, valueOnly = false): void {
		for (const fbId of this.state.getFeedbacksByPath(path)) {
			if (!valueOnly || this.state.feedbackReadsValue(fbId)) this.feedbacksToCheck.add(fbId)
		}

		if (hasParameterVariables(parameter, this.parameterVariables)) {
			const varId = sanitiseVariableId(path)
			this.variableValueUpdates[varId] = parameterVariableValue(parameter, Boolean(this.config.factor))
			if (parameter.parameterType === EmberModel.ParameterType.Enum) {
				this.variableValueUpdates[`${varId}_ENUM`] = this.state.getCurrentEnumValue(path)
			}
		}

		this.throttledFeedbackChecksVariableUpdates()
	}
}
