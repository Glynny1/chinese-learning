import { NextRequest, NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

// Env: GOOGLE_TTS_CREDENTIALS_B64 (base64 of service account JSON)
// Optional: GOOGLE_TTS_VOICE, GOOGLE_TTS_RATE, GOOGLE_TTS_PITCH, GOOGLE_TTS_FORMAT

function getClient() {
  const rawJson = process.env.GOOGLE_TTS_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  let credentials: Record<string, unknown> | null = null;
  if (rawJson && rawJson.trim().startsWith("{")) {
    credentials = JSON.parse(rawJson);
  } else {
    const b64 = process.env.GOOGLE_TTS_CREDENTIALS_B64 || process.env.GOOGLE_APPLICATION_CREDENTIALS_B64 || "";
    if (!b64) throw new Error("Missing GOOGLE_TTS_CREDENTIALS_B64");
    const json = Buffer.from(b64, "base64").toString("utf8");
    credentials = JSON.parse(json);
  }
  const client = new textToSpeech.TextToSpeechClient({ credentials: credentials ?? undefined });
  return client;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || "").trim();
    const lang = String(body?.lang || "zh-CN");
    if (!text) return new NextResponse("text required", { status: 400 });

    const voiceName = String(body?.voice || process.env.GOOGLE_TTS_VOICE || "").trim();
    const speakingRate = Number(process.env.GOOGLE_TTS_RATE || body?.rate || 0.9);
    const pitch = Number(process.env.GOOGLE_TTS_PITCH || body?.pitch || 0.0);
    const audioEncoding = (process.env.GOOGLE_TTS_FORMAT || body?.format || "MP3").toUpperCase();

    const client = getClient();
    async function synth(languageCode: string, name?: string) {
      return client.synthesizeSpeech(
        {
          input: { text },
          voice: name ? { name } : { languageCode },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          audioConfig: { audioEncoding: audioEncoding as any, speakingRate, pitch },
        },
        { timeout: 12000 }
      );
    }
    let res;
    try {
      if (voiceName) {
        [res] = await synth(lang, voiceName);
      } else {
        [res] = await synth(lang);
      }
    } catch {
      try {
        [res] = await synth(lang);
      } catch (err2) {
        return NextResponse.json({ error: err2 instanceof Error ? err2.message : "tts failed" }, { status: 400 });
      }
    }
    const audio = res.audioContent ? Buffer.from(res.audioContent as Buffer) : null;
    if (!audio) return NextResponse.json({ error: "No audio" }, { status: 500 });
    const headers = new Headers({
      "Content-Type": audioEncoding === "OGG_OPUS" ? "audio/ogg" : "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    return new NextResponse(audio, { status: 200, headers });
  } catch (e) {
    const raw: unknown = e;
    let msg = "unknown";
    let code = "";
    let details: unknown = undefined;
    if (typeof raw === "object" && raw !== null) {
      const er = raw as { message?: unknown; code?: unknown; cause?: unknown; response?: unknown };
      if (typeof er.message === "string") msg = er.message;
      if (typeof er.code === "string") code = er.code;
      if (er.cause && typeof er.cause === "object") {
        const cause = er.cause as { code?: unknown };
        if (typeof cause.code === "string") code = cause.code;
      }
      if (er.response && typeof er.response === "object") {
        const resp = er.response as { data?: unknown };
        if (typeof resp.data !== "undefined") details = resp.data;
      }
    }
    return NextResponse.json({ error: msg, code, details }, { status: 500 });
  }
}
