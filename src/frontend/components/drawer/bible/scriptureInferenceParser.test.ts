import { describe, expect, it } from "vitest"
import { inferScriptureReferenceFromTranscript } from "./scriptureInferenceParser"

describe("inferScriptureReferenceFromTranscript", () => {
    it("parses colon references", () => {
        const result = inferScriptureReferenceFromTranscript("Please open John 3:16 now")
        expect(result?.reference).toBe("John 3:16")
        expect(result?.confidence).toBeGreaterThanOrEqual(0.9)
    })

    it("parses spoken number references", () => {
        const result = inferScriptureReferenceFromTranscript("first john three sixteen")
        expect(result?.reference).toBe("1 John 3:16")
    })

    it("parses chapter-only spoken references", () => {
        const result = inferScriptureReferenceFromTranscript("psalm twenty three")
        expect(result?.reference).toBe("Psalms 23")
    })

    it("parses verse ranges", () => {
        const result = inferScriptureReferenceFromTranscript("Romans 8 28 to 30")
        expect(result?.reference).toBe("Romans 8:28-30")
    })

    it("returns null for non-scripture text", () => {
        const result = inferScriptureReferenceFromTranscript("please lower the monitor mix")
        expect(result).toBeNull()
    })
})
