import { env } from "cloudflare:workers";

type GenerateRequest = {
  prompt?: string;
  referenceImage?: string | null;
};

type QwenResponse = {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{ image?: string }>;
      };
    }>;
  };
  code?: string;
  message?: string;
  request_id?: string;
};

function getQwenConfig() {
  const runtime = env as unknown as Record<string, string | undefined>;
  const apiKey = runtime.DASHSCOPE_API_KEY;
  const workspaceId = runtime.QWEN_WORKSPACE_ID;
  const region = runtime.QWEN_REGION === "beijing" ? "beijing" : "singapore";

  if (!apiKey || !workspaceId) return null;
  if (!/^[a-zA-Z0-9-]+$/.test(workspaceId)) return null;

  const host = region === "beijing"
    ? `${workspaceId}.cn-beijing.maas.aliyuncs.com`
    : `${workspaceId}.ap-southeast-1.maas.aliyuncs.com`;

  return { apiKey, endpoint: `https://${host}/api/v1/services/aigc/multimodal-generation/generation` };
}

export async function GET() {
  return Response.json({ provider: "qwen-image-2.0-pro", configured: Boolean(getQwenConfig()) });
}

export async function POST(request: Request) {
  const config = getQwenConfig();
  if (!config) {
    return Response.json(
      { error: "qwen_not_configured", message: "A chave e o workspace do Qwen ainda não foram configurados." },
      { status: 503 },
    );
  }

  let body: GenerateRequest;
  try {
    body = await request.json() as GenerateRequest;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt || prompt.length > 12_000) {
    return Response.json({ error: "invalid_prompt" }, { status: 422 });
  }

  const content: Array<Record<string, string>> = [];
  if (body.referenceImage) {
    if (!body.referenceImage.startsWith("data:image/")) {
      return Response.json({ error: "invalid_reference_image" }, { status: 422 });
    }
    content.push({ image: body.referenceImage });
  }
  content.push({ text: prompt });

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen-image-2.0-pro",
        input: { messages: [{ role: "user", content }] },
        parameters: {
          n: 1,
          negative_prompt: "distorted geometry, extra gates, duplicated doors, illegible text, logo, watermark, low resolution",
          prompt_extend: true,
          watermark: false,
          size: "1536*1024",
        },
      }),
    });

    const data = await response.json() as QwenResponse;
    const image = data.output?.choices?.[0]?.message?.content?.find((item) => item.image)?.image;

    if (!response.ok || !image) {
      return Response.json(
        {
          error: data.code || "qwen_generation_failed",
          message: data.message || "O Qwen não retornou uma imagem.",
          requestId: data.request_id,
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    return Response.json({ provider: "qwen-image-2.0-pro", image });
  } catch {
    return Response.json(
      { error: "qwen_unavailable", message: "Não foi possível conectar ao Qwen neste momento." },
      { status: 502 },
    );
  }
}
