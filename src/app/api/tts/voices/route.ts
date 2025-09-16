import { NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

function getClient() {
  const rawJson = process.env.GOOGLE_TTS_CREDENTIALS_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  let credentials: any | null = null;
  if (rawJson && rawJson.trim().startsWith("{")) credentials = JSON.parse(rawJson);
  else {
    const b64 = process.env.GOOGLE_TTS_CREDENTIALS_B64 || process.env.GOOGLE_APPLICATION_CREDENTIALS_B64 || "";
    if (!b64) throw new Error("Missing GOOGLE_TTS_CREDENTIALS_B64");
    credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  }
  return new textToSpeech.TextToSpeechClient({ credentials });
}

export async function GET() {
  try {
    const client = getClient();
    const [result] = await client.listVoices({ languageCode: "zh" });
    const voices = (result.voices || []).map((v) => ({
      name: v.name,
      languageCodes: v.languageCodes,
      ssmlGender: v.ssmlGender,
      naturalSampleRateHertz: v.naturalSampleRateHertz,
    }));
    return NextResponse.json({ voices });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


