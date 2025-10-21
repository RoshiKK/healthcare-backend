import { ElevenLabsClient } from "elevenlabs";
import { Readable } from "stream";
import ApiError from "../utils/apiError";

const elevenLabs = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_LABS_API_KEY!,
});

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export const generateVoiceResponse = async (text: string): Promise<string> => {
  try {
    const audioStream = await elevenLabs.generate({
      voice: "Rachel",
      model_id: "eleven_monolingual_v1",
      text,
      output_format: "mp3_44100_128", // MP3 for browser compatibility
    });

    // ✅ Convert stream → buffer → base64
    const audioBuffer = await streamToBuffer(audioStream as Readable);
    return audioBuffer.toString("base64");
  } catch (error) {
    console.error("Failed to generate voice response:", error);
    throw new ApiError(500, "Failed to generate voice response");
  }
};

export const createVoiceSession = async (doctorInfo: any) => {
  try {
    const welcomeMessage = `Hello! I'll help you book an appointment with Dr. ${doctorInfo.name}, a ${doctorInfo.specialization}. Please tell me your name.`;

    return {
      sessionId: Date.now().toString(),
      welcomeMessage,
      audio: await generateVoiceResponse(welcomeMessage),
    };
  } catch (error) {
    throw new ApiError(500, "Failed to create voice session");
  }
};
