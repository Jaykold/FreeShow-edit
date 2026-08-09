import { get } from "svelte/store"
import { startScripture } from "../../actions/apiHelper"
import { activeScripture, drawerTabsData, scriptureSettings, scriptures, inferredScriptureSuggestion } from "../../../stores"
import { trackScriptureInference } from "../../../utils/analytics"
import { inferScriptureReferenceFromTranscript } from "./scriptureInferenceParser"
import { resolveScriptureReference } from "./scripture"

type SpeechRecognitionResultEvent = Event & { results: SpeechRecognitionResultList }
type SpeechRecognitionErrorEvent = Event & { error?: string }
type SpeechRecognitionCtor = new () => SpeechRecognition
type SpeechRecognitionLike = {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: SpeechRecognitionResultEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
    start: () => void
    stop: () => void
}

interface TranscriptionProvider {
    start(onTranscript: (text: string) => void): boolean
    stop(): void
}

class WebSpeechTranscriptionProvider implements TranscriptionProvider {
    private recognition: SpeechRecognitionLike | null = null
    private running = false
    private shouldRestart = false
    private onTranscript: ((text: string) => void) | null = null

    start(onTranscript: (text: string) => void): boolean {
        this.onTranscript = onTranscript
        if (!this.recognition) {
            const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
            if (!Ctor) {
                console.info("[scripture-inference] SpeechRecognition unavailable")
                return false
            }
            this.recognition = new (Ctor as SpeechRecognitionCtor)()
            this.recognition.continuous = true
            this.recognition.interimResults = false
            this.recognition.onresult = (event: SpeechRecognitionResultEvent) => {
                for (let i = event.results.length - 1; i >= 0; i--) {
                    const result = event.results[i]
                    if (!result?.isFinal) continue
                    const transcript = result[0]?.transcript?.trim()
                    if (transcript) this.onTranscript?.(transcript)
                    break
                }
            }
            this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.warn("[scripture-inference] SpeechRecognition error:", event.error || "unknown")
            }
            this.recognition.onend = () => {
                this.running = false
                if (this.shouldRestart) this.startRecognition()
            }
        }

        this.shouldRestart = true
        this.recognition.lang = getLanguage()
        return this.startRecognition()
    }

    private startRecognition() {
        if (!this.recognition || this.running) return true
        try {
            this.recognition.start()
            this.running = true
            return true
        } catch (err) {
            console.warn("[scripture-inference] Failed to start speech recognition:", err)
            this.running = false
            return false
        }
    }

    stop() {
        this.shouldRestart = false
        if (!this.recognition) return
        try {
            this.recognition.stop()
        } catch (err) {
            console.warn("[scripture-inference] Failed to stop speech recognition:", err)
        } finally {
            this.running = false
        }
    }
}

const provider = new WebSpeechTranscriptionProvider()
const activeMicrophones = new Set<string>()
let lastInferredAt = 0
let lastInferredReference = ""

function getActiveScriptureId() {
    const selectedScriptureId = get(activeScripture).id || get(drawerTabsData).scripture?.activeSubTab || ""
    if (!selectedScriptureId) return ""
    return get(scriptures)[selectedScriptureId]?.collection?.versions?.[0] || selectedScriptureId
}

function getLanguage() {
    return get(scriptureSettings).inferenceLanguage || "en-US"
}

function getInferenceSettings() {
    const settings = get(scriptureSettings)
    return {
        enabled: settings?.micInferenceEnabled === true,
        provider: settings?.inferenceProvider || "web_speech",
        privacyMode: settings?.inferencePrivacyMode || "local",
        confidenceThreshold: Math.max(0, Math.min(1, Number(settings?.inferenceConfidenceThreshold ?? 0.75))),
        debounceMs: Math.max(500, Number(settings?.inferenceDebounceMs ?? 5000)),
        autoPlay: settings?.inferenceAutoPlay === true
    }
}

async function processTranscript(transcript: string) {
    const settings = getInferenceSettings()
    if (!settings.enabled) return

    const inferred = inferScriptureReferenceFromTranscript(transcript)
    if (!inferred || inferred.confidence < settings.confidenceThreshold) return

    const now = Date.now()
    if (lastInferredReference === inferred.reference && now - lastInferredAt < settings.debounceMs) return

    const scriptureId = getActiveScriptureId()
    if (!scriptureId) return

    const resolved = await resolveScriptureReference(inferred.reference, scriptureId)
    if (!resolved) return

    lastInferredReference = inferred.reference
    lastInferredAt = now

    const suggestedReference = `${inferred.reference}`
    inferredScriptureSuggestion.set({ reference: suggestedReference, confidence: inferred.confidence, transcript: inferred.transcript, timestamp: now })
    trackScriptureInference(suggestedReference, inferred.confidence, settings.autoPlay)

    if (!settings.autoPlay) return

    await startScripture({ id: scriptureId, reference: suggestedReference })
}

function shouldRunInference() {
    const settings = getInferenceSettings()
    return settings.enabled && settings.provider === "web_speech" && settings.privacyMode === "local"
}

function syncState() {
    if (!activeMicrophones.size || !shouldRunInference()) {
        provider.stop()
        return
    }
    provider.start(processTranscript)
}

export function startScriptureInferenceForMicrophone(deviceId: string) {
    if (!deviceId) return
    activeMicrophones.add(deviceId)
    syncState()
}

export function stopScriptureInferenceForMicrophone(deviceId: string) {
    if (deviceId) activeMicrophones.delete(deviceId)
    if (!activeMicrophones.size) provider.stop()
}

export async function playSuggestedInferredScripture() {
    const suggestion = get(inferredScriptureSuggestion)
    if (!suggestion?.reference) return

    const scriptureId = getActiveScriptureId()
    if (!scriptureId) return

    await startScripture({ id: scriptureId, reference: suggestion.reference })
}
