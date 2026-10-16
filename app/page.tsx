"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, BedDouble, Box, Calculator, CarFront, Check, ChevronRight, CookingPot, FileJson, Image as ImageIcon, ImagePlus, Maximize2, MessageCircle, Minus, Pin, PinOff, Plus, Sofa, Sparkles, WandSparkles, Waves, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const materials = ["Filete de pedra", "Porcelanato amadeirado", "Concreto aparente", "Vidro", "Cobogó", "Brise metálico"];

type ResidentialProgram = {
  bedrooms: number;
  hasLivingRoom: boolean;
  hasKitchen: boolean;
  hasSuite: boolean;
  hasPool: boolean;
  hasGarage: boolean;
  areas: { livingRoom: number; kitchen: number; bedrooms: number[]; suite: number; pool: number; garage: number };
};
type FacadeParams = { width: number; height: number; style: string; materials: string[]; gateType: string; clientNeeds: string; program: ResidentialProgram };
type GeneratedImage = { id: string; url: string; label: string };
type ReferenceImage = { name: string; dataUrl: string; mimeType: string };
type FinishLevel = "Econômico" | "Médio" | "Alto padrão";
type ImageProvider = "pollinations" | "puter";

const DEFAULT_PROGRAM: ResidentialProgram = {
  bedrooms: 2,
  hasLivingRoom: true,
  hasKitchen: true,
  hasSuite: true,
  hasPool: false,
  hasGarage: false,
  areas: { livingRoom: 22, kitchen: 14, bedrooms: [11], suite: 16, pool: 20, garage: 24 },
};

function Stepper({ label, value, onChange, min = 1, max = 100, step = 1, suffix = "" }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  const normalize = (next: number) => Math.min(max, Math.max(min, Math.round(next * 10) / 10));
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Diminuir ${label}`} onClick={() => onChange(normalize(value - step))}><Minus /></Button>
        <span className="min-w-12 text-center text-sm font-bold text-slate-800">{value}{suffix}</span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Aumentar ${label}`} onClick={() => onChange(normalize(value + step))}><Plus /></Button>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    puter?: {
      auth: {
        isSignedIn: () => boolean;
        signIn: () => Promise<unknown>;
      };
      ai: {
        txt2img: (
          prompt: string,
          options?: Record<string, unknown>,
        ) => Promise<HTMLImageElement>;
      };
      fs: {
        write: (path: string, data: Blob, options?: { createMissingParents?: boolean }) => Promise<unknown>;
        getReadURL: (path: string, expiresIn?: string) => Promise<string>;
      };
    };
  }
  interface Document {
    modelContext?: { registerTool: (tool: { name: string; title: string; description: string; inputSchema: Record<string, unknown>; execute: (input: unknown) => Promise<unknown>; annotations?: Record<string, boolean> }, options?: { signal: AbortSignal }) => void | Promise<void> };
  }
}

export default function Home() {
  const [width, setWidth] = useState("12");
  const [height, setHeight] = useState("2.8");
  const [style, setStyle] = useState("Moderno");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(["Concreto aparente", "Porcelanato amadeirado"]);
  const [gateType, setGateType] = useState("Portão de Correr");
  const [clientNeeds, setClientNeeds] = useState("Lixeira embutida, recuo para caixa de correio e floreira iluminada na base.");
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [imageProvider, setImageProvider] = useState<ImageProvider>("pollinations");
  const [bedrooms, setBedrooms] = useState(DEFAULT_PROGRAM.bedrooms);
  const [hasLivingRoom, setHasLivingRoom] = useState(DEFAULT_PROGRAM.hasLivingRoom);
  const [hasKitchen, setHasKitchen] = useState(DEFAULT_PROGRAM.hasKitchen);
  const [hasSuite, setHasSuite] = useState(DEFAULT_PROGRAM.hasSuite);
  const [hasPool, setHasPool] = useState(DEFAULT_PROGRAM.hasPool);
  const [hasGarage, setHasGarage] = useState(DEFAULT_PROGRAM.hasGarage);
  const [livingRoomArea, setLivingRoomArea] = useState(DEFAULT_PROGRAM.areas.livingRoom);
  const [kitchenArea, setKitchenArea] = useState(DEFAULT_PROGRAM.areas.kitchen);
  const [bedroomAreas, setBedroomAreas] = useState<number[]>(Array(8).fill(11));
  const [suiteArea, setSuiteArea] = useState(DEFAULT_PROGRAM.areas.suite);
  const [poolArea, setPoolArea] = useState(DEFAULT_PROGRAM.areas.pool);
  const [garageArea, setGarageArea] = useState(DEFAULT_PROGRAM.areas.garage);
  const [finishLevel, setFinishLevel] = useState<FinishLevel>("Médio");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [floatingImage, setFloatingImage] = useState<GeneratedImage | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<GeneratedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [generationStep, setGenerationStep] = useState(1);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [providerReady, setProviderReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [notice, setNotice] = useState("Preencha os dados para iniciar a geração.");
  const resultsRef = useRef<HTMLElement>(null);
  const generationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!fullscreenImage) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setFullscreenImage(null); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [fullscreenImage]);

  const currentParams = useMemo<FacadeParams>(() => ({
    width: Number(width),
    height: Number(height),
    style,
    materials: selectedMaterials,
    gateType,
    clientNeeds,
    program: {
      bedrooms,
      hasLivingRoom,
      hasKitchen,
      hasSuite,
      hasPool,
      hasGarage,
      areas: { livingRoom: livingRoomArea, kitchen: kitchenArea, bedrooms: bedroomAreas.slice(0, Math.max(0, bedrooms - (hasSuite ? 1 : 0))), suite: suiteArea, pool: poolArea, garage: garageArea },
    },
  }), [width, height, style, selectedMaterials, gateType, clientNeeds, bedrooms, hasLivingRoom, hasKitchen, hasSuite, hasPool, hasGarage, livingRoomArea, kitchenArea, bedroomAreas, suiteArea, poolArea, garageArea]);
  const toggleMaterial = (material: string) => setSelectedMaterials((current) => current.includes(material) ? current.filter((item) => item !== material) : [...current, material]);
  const handleReferenceImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setNotice("Selecione uma imagem válida em JPG, PNG ou WebP."); return; }
    if (file.size > 10 * 1024 * 1024) { setNotice("A imagem de referência deve ter no máximo 10 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setReferenceImage({ name: file.name, dataUrl: reader.result, mimeType: file.type || "image/jpeg" });
      setNotice("Imagem de referência anexada. Ela será usada na próxima geração.");
    };
    reader.onerror = () => setNotice("Não foi possível ler a imagem de referência.");
    reader.readAsDataURL(file);
  };
  const scaleAreas = (factor: number) => {
    const scale = (value: number) => Math.max(4, Math.round(value * factor * 2) / 2);
    setLivingRoomArea((value) => scale(value));
    setKitchenArea((value) => scale(value));
    setBedroomAreas((values) => values.map(scale));
    setSuiteArea((value) => scale(value));
    setPoolArea((value) => scale(value));
    setGarageArea((value) => scale(value));
  };
  const fitAreasToFrontage = () => {
    const ratio = Math.min(2, Math.max(0.6, Number(width) / 12 || 1));
    setLivingRoomArea(Math.round(DEFAULT_PROGRAM.areas.livingRoom * ratio * 2) / 2);
    setKitchenArea(Math.round(DEFAULT_PROGRAM.areas.kitchen * ratio * 2) / 2);
    setBedroomAreas((values) => values.map(() => Math.round(11 * ratio * 2) / 2));
    setSuiteArea(Math.round(DEFAULT_PROGRAM.areas.suite * ratio * 2) / 2);
    setPoolArea(Math.round(DEFAULT_PROGRAM.areas.pool * ratio * 2) / 2);
    setGarageArea(Math.round(DEFAULT_PROGRAM.areas.garage * ratio * 2) / 2);
    setNotice("Áreas ajustadas proporcionalmente à largura da testada.");
  };
  const regularBedroomCount = Math.max(0, bedrooms - (hasSuite ? 1 : 0));
  const visibleBedroomAreas = bedroomAreas.slice(0, regularBedroomCount);
  const setBedroomAreaAt = (index: number, value: number) => setBedroomAreas((areas) => areas.map((area, itemIndex) => itemIndex === index ? value : area));
  const totalProgramArea = (hasLivingRoom ? livingRoomArea : 0) + (hasKitchen ? kitchenArea : 0) + visibleBedroomAreas.reduce((sum, area) => sum + area, 0) + (hasSuite ? suiteArea : 0) + (hasPool ? poolArea : 0) + (hasGarage ? garageArea : 0);
  const budget = useMemo(() => {
    const baseRates: Record<FinishLevel, number> = { "Econômico": 2300, "Médio": 3000, "Alto padrão": 4200 };
    const styleFactors: Record<string, number> = { Moderno: 1.04, Contemporâneo: 1.08, Neoclássico: 1.15, Industrial: 1.1 };
    const gateCosts: Record<string, number> = { "Portão Basculante": 16000, "Portão de Correr": 12500, "Portão Duplo": 14500, "Portão Vazado": 10500, "Fechado em Chapa": 11500 };
    const enclosedProgramArea = (hasLivingRoom ? livingRoomArea : 0) + (hasKitchen ? kitchenArea : 0) + visibleBedroomAreas.reduce((sum, area) => sum + area, 0) + (hasSuite ? suiteArea : 0) + (hasGarage ? garageArea : 0);
    const estimatedBuiltArea = enclosedProgramArea * 1.24;
    const premiumFinishes = selectedMaterials.filter((material) => ["Filete de pedra", "Porcelanato amadeirado", "Vidro", "Cobogó", "Brise metálico"].includes(material)).length;
    const finishFactor = 1 + premiumFinishes * 0.025;
    const house = estimatedBuiltArea * baseRates[finishLevel] * (styleFactors[style] ?? 1) * finishFactor;
    const frontWall = Math.max(0, Number(width) || 0) * Math.max(0, Number(height) || 0) * 850 * finishFactor;
    const gate = gateCosts[gateType] ?? 12000;
    const pool = hasPool ? poolArea * 3600 : 0;
    const technicalAndContingency = (house + frontWall + gate + pool) * 0.12;
    const total = house + frontWall + gate + pool + technicalAndContingency;
    return { baseRate: baseRates[finishLevel], estimatedBuiltArea, house, frontWall, gate, pool, technicalAndContingency, low: total * 0.9, high: total * 1.15 };
  }, [finishLevel, style, selectedMaterials, gateType, width, height, hasLivingRoom, livingRoomArea, hasKitchen, kitchenArea, visibleBedroomAreas, hasSuite, suiteArea, hasGarage, garageArea, hasPool, poolArea]);
  const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  const waitForImage = (url: string, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    const preview = new window.Image();
    const cleanup = () => {
      preview.onload = null;
      preview.onerror = null;
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      preview.src = "";
      reject(new Error("generation_cancelled"));
    };
    preview.onload = () => { cleanup(); resolve(); };
    preview.onerror = () => { cleanup(); reject(new Error("A API gratuita não conseguiu concluir esta imagem.")); };
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    preview.src = url;
  });

  const generateWithParams = async (params: FacadeParams) => {
    if (!params.width || !params.height || params.width <= 0 || params.height <= 0) {
      setNotice("Informe dimensões válidas para o terreno e o muro.");
      return { success: false, error: "invalid_dimensions" };
    }
    generationAbortRef.current?.abort();
    const abortController = new AbortController();
    generationAbortRef.current = abortController;
    setLoading(true); setImages([]); setFloatingImage(null); setGenerationStep(1); setGenerationProgress(0); setNotice("Preparando a geração das fachadas exclusivas…");
    if (window.innerWidth < 1024) {
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
    try {
      const usePuter = Boolean(referenceImage) || imageProvider === "puter";
      const materialsText = params.materials.length
        ? params.materials.join(", ")
        : "architectural concrete and metal";
      const program = params.program ?? DEFAULT_PROGRAM;
      const promptRegularBedrooms = Math.max(0, program.bedrooms - (program.hasSuite ? 1 : 0));
      const programText = [
        `${program.bedrooms} total bedrooms`,
        `${promptRegularBedrooms} regular bedrooms with individual areas: ${program.areas.bedrooms.map((area, index) => `bedroom ${index + 1}: ${area} square meters`).join(", ") || "none"}`,
        program.hasSuite ? `including one suite of approximately ${program.areas.suite} square meters` : "no suite",
        program.hasLivingRoom ? `living room of approximately ${program.areas.livingRoom} square meters` : "no separate living room",
        program.hasKitchen ? `kitchen of approximately ${program.areas.kitchen} square meters` : "no separate kitchen",
        program.hasPool ? `swimming pool area of approximately ${program.areas.pool} square meters` : "no swimming pool",
        program.hasGarage ? `garage of approximately ${program.areas.garage} square meters integrated with the facade` : "no garage",
      ].join(", ");
      const directions = referenceImage ? [
        "Conservative faithful edit. Apply only the requested additions with minimal visual intervention.",
        "Second faithful edit. Vary only the execution detail of the requested additions; keep every original element unchanged.",
        "Third faithful edit. Refine only the requested additions and their realistic construction finish; do not redesign any existing element.",
      ] : [
        "minimalist composition with clean horizontal lines and discreet landscaping",
        "balanced composition with a highlighted pedestrian entrance and warm architectural lighting",
        "bold signature composition with layered volumes, refined material transitions and integrated planters",
      ];
      const generated: GeneratedImage[] = [];
      let puterAuthorized = false;

      for (let index = 0; index < directions.length; index += 1) {
        if (abortController.signal.aborted) throw new Error("generation_cancelled");
        const completedBefore = Math.round((index / directions.length) * 100);
        const waitingLimit = Math.round(((index + 0.9) / directions.length) * 100);
        setGenerationStep(index + 1);
        setGenerationProgress(completedBefore);
        setNotice(`${referenceImage ? "Aprimorando a imagem de referência" : "Gerando conceito"} ${index + 1} de 3 — mantenha esta página aberta…`);
        const prompt = referenceImage ? [
          "IMAGE EDITING TASK. Edit the supplied reference image itself. Do not create or redesign a different facade.",
          "Treat the supplied image as an immutable base. Preserve the exact building shape, facade volumes, dimensions, roofline, walls, openings, gate, pedestrian entrance, materials, colors, camera position, perspective, crop, surroundings and all existing objects.",
          `Make ONLY these client-requested changes: ${params.clientNeeds || "improve image sharpness and photorealism"}.`,
          "Add or improve only what is explicitly requested. Every area not mentioned by the client must remain visually unchanged and in the same position.",
          "Improve realism, resolution, material texture, shadows and construction finish without changing the architectural design.",
          directions[index],
          "No new architectural style, no new volumes, no relocated openings, no different gate, no camera change, no text, no logo, no watermark.",
        ].join(" ") : [
          "Photorealistic architectural front elevation of a single residential property.",
          `Exact lot frontage: ${params.width} meters. Exact front wall height: ${params.height} meters.`,
          `${params.style} architectural style.`,
          `Finishes: ${materialsText}.`,
          `Gate: ${params.gateType}.`,
          `Client requirements: ${params.clientNeeds || "integrated lighting and clear pedestrian access"}.`,
          `Residential program behind the facade: ${programText}. Make the facade composition consistent with this internal program.`,
          directions[index],
          "Straight-on eye-level exterior view, entire frontage visible, buildable proportions, precise gate and pedestrian door geometry, realistic joints and construction details, daylight, Brazilian residential context, no people, no cars blocking the facade, no text, no logo, no watermark.",
        ].join(" ");
        const progressTimer = window.setInterval(() => setGenerationProgress((current) => Math.min(waitingLimit, current + 1)), 700);
        let imageUrl = "";
        try {
          if (usePuter) {
            const puter = window.puter;
            if (!puter?.ai?.txt2img) throw new Error("O gerador Puter ainda está carregando.");
            if (!puterAuthorized && !puter.auth.isSignedIn()) {
              setNotice("Confirme a conexão do Puter para aprimorar a imagem enviada.");
              await puter.auth.signIn();
            }
            puterAuthorized = true;
            const image = await puter.ai.txt2img(prompt, {
              provider: "openai",
              model: "gpt-image-2",
              quality: referenceImage ? "medium" : "high",
              ratio: { w: 3, h: 2 },
              signal: abortController.signal,
              ...(referenceImage ? { input_image: referenceImage.dataUrl, input_image_mime_type: referenceImage.mimeType } : {}),
            });
            if (abortController.signal.aborted) throw new Error("generation_cancelled");
            imageUrl = image.src;
          } else {
            const query = new URLSearchParams({
              model: "flux",
              width: "1024",
              height: "683",
              seed: String(Math.floor(Math.random() * 2147483647)),
              nologo: "true",
              enhance: "true",
            });
            imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${query.toString()}`;
            await waitForImage(imageUrl, abortController.signal);
          }
        } finally {
          window.clearInterval(progressTimer);
        }
        const concept = {
          id: `concept-${Date.now()}-${index + 1}`,
          url: imageUrl,
          label: `${referenceImage ? "Aprimoramento" : "Conceito"} ${String(index + 1).padStart(2, "0")}`,
        };
        generated.push(concept);
        setImages([...generated]);
        setGenerationProgress(Math.round(((index + 1) / directions.length) * 100));
      }

      setNotice(usePuter
        ? referenceImage ? "3 imagens aprimoradas com Puter + modelos de imagem da OpenAI." : "3 fachadas geradas com Puter + modelos de imagem da OpenAI em alta qualidade."
        : "3 fachadas exclusivas geradas pela API gratuita Pollinations.");
      return { success: true, count: generated.length, mode: usePuter ? "puter-openai-image" : "pollinations-free" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "generation_cancelled") {
        setNotice("Geração interrompida. As imagens já concluídas foram mantidas.");
        return { success: false, error: "generation_cancelled" };
      }
      const insufficientFunds = /insufficient_funds|balance|credits|402/i.test(message);
      setNotice(insufficientFunds
        ? "Os créditos do Puter terminaram. Escolha Pollinations para gerar sem créditos ou tente novamente mais tarde."
        : message.includes("API gratuita")
          ? "A API gratuita está ocupada ou atingiu o limite temporário. Tente novamente em alguns instantes."
          : "A geração não foi concluída. Tente novamente em alguns instantes.");
      return { success: false, error: message };
    } finally {
      if (generationAbortRef.current === abortController) generationAbortRef.current = null;
      setLoading(false);
    }
  };

  const cancelGeneration = () => {
    if (!generationAbortRef.current) return;
    setNotice("Interrompendo a geração atual…");
    generationAbortRef.current.abort();
  };

  const exportJson = () => {
    const payload = { project: "Digimax Projetos — Estudo de Fachada", schemaVersion: "1.3", geometry: { frontageWidthM: currentParams.width, wallHeightM: currentParams.height }, architecture: { style: currentParams.style, materials: currentParams.materials, gateType: currentParams.gateType }, residentialProgram: { ...currentParams.program, estimatedProgramAreaM2: totalProgramArea, estimatedBuiltAreaM2: Math.round(budget.estimatedBuiltArea * 10) / 10 }, preliminaryBudget: { finishLevel, baseRateBRLPerM2: budget.baseRate, lowBRL: Math.round(budget.low), highBRL: Math.round(budget.high), disclaimer: "Estimativa paramétrica preliminar; requer orçamento executivo local." }, clientRequirements: currentParams.clientNeeds, referenceImage: referenceImage ? { attached: true, fileName: referenceImage.name } : { attached: false }, generatedAt: new Date().toISOString(), bimReady: true };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `digimax-fachada-${Date.now()}.json`; link.click(); URL.revokeObjectURL(url);
    setNotice("Parâmetros exportados em JSON para futura modelagem BIM.");
  };

  const shareOnWhatsApp = async (image: GeneratedImage) => {
    const whatsappWindow = window.open("about:blank", "_blank");
    setNotice("Preparando um link público da fachada para o WhatsApp…");
    const rooms = [
      `${bedrooms} quarto${bedrooms === 1 ? "" : "s"}${hasSuite ? " (1 suíte)" : ""}`,
      hasLivingRoom ? `sala ${livingRoomArea} m²` : null,
      hasKitchen ? `cozinha ${kitchenArea} m²` : null,
      ...visibleBedroomAreas.map((area, index) => `quarto ${index + 1}: ${area} m²`),
      hasSuite ? `suíte ${suiteArea} m²` : null,
      hasPool ? `piscina ${poolArea} m²` : null,
      hasGarage ? `garagem ${garageArea} m²` : null,
    ].filter(Boolean).join(", ");
    const projectDescription = [
      `*Descrição do projeto — ${image.label}*`,
      `Fachada ${style} para terreno com ${width} m de testada e muro de ${height} m.`,
      `Programa: ${rooms}. Área estimada: ${Math.round(totalProgramArea * 10) / 10} m².`,
      `Investimento preliminar (${finishLevel}): de ${currency(budget.low)} a ${currency(budget.high)}.`,
      `Materiais: ${selectedMaterials.length ? selectedMaterials.join(", ") : "a definir"}.`,
      `Portão: ${gateType}.`,
      clientNeeds ? `Necessidades: ${clientNeeds}` : "",
    ].filter(Boolean).join("\n");
    const tenCharacterGap = "          ";
    try {
      if (image.url.includes("image.pollinations.ai")) {
        const message = `${image.url}\n${tenCharacterGap}\n${projectDescription}`;
        const whatsappUrl = `https://wa.me/5564996170494?text=${encodeURIComponent(message)}`;
        if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
        else window.location.href = whatsappUrl;
        setNotice("WhatsApp aberto com o link gratuito da fachada e os dados do projeto.");
        return;
      }
      const puter = window.puter;
      if (!puter?.fs) throw new Error("Armazenamento de imagens indisponível.");
      if (!puter.auth.isSignedIn()) await puter.auth.signIn();
      const response = await fetch(image.url);
      if (!response.ok) throw new Error("Não foi possível preparar a imagem.");
      const imageBlob = await response.blob();
      const imagePath = `fachadas-compartilhadas/digimax-${Date.now()}.png`;
      await puter.fs.write(imagePath, imageBlob, { createMissingParents: true });
      const publicImageUrl = await puter.fs.getReadURL(imagePath, "24h");
      const message = `${publicImageUrl}\n${tenCharacterGap}\n${projectDescription}`;
      const whatsappUrl = `https://wa.me/5564996170494?text=${encodeURIComponent(message)}`;
      if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
      else window.location.href = whatsappUrl;
      setNotice("WhatsApp aberto com o link público da fachada e os dados do projeto.");
    } catch (error) {
      whatsappWindow?.close();
      const message = `Não foi possível criar o link da imagem.\n${tenCharacterGap}\n${projectDescription}`;
      window.location.href = `https://wa.me/5564996170494?text=${encodeURIComponent(message)}`;
      setNotice(error instanceof Error ? error.message : "Não foi possível criar o link público da fachada.");
    }
  };

  useEffect(() => {
    setHydrated(true);
    setProviderReady(true);
    const splashTimer = window.setTimeout(() => setShowSplash(false), 3000);
    return () => window.clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    const context = document.modelContext; if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "generate_facade_concepts", title: "Gerar conceitos de fachada", description: "Configura o briefing e gera conceitos visuais de fachada e muro frontal.",
      inputSchema: { type: "object", properties: { width: { type: "number", minimum: 1 }, height: { type: "number", minimum: 1 }, style: { type: "string", enum: ["Moderno", "Contemporâneo", "Neoclássico", "Industrial"] }, materials: { type: "array", items: { type: "string" } }, gateType: { type: "string" }, clientNeeds: { type: "string" } }, required: ["width", "height", "style", "materials", "gateType", "clientNeeds"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => { const value = input as FacadeParams; if (!value || value.width <= 0 || value.height <= 0 || !Array.isArray(value.materials)) throw new Error("Parâmetros inválidos para geração."); setWidth(String(value.width)); setHeight(String(value.height)); setStyle(value.style); setSelectedMaterials(value.materials); setGateType(value.gateType); setClientNeeds(value.clientNeeds); return generateWithParams(value); },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return (
    <main className="min-h-screen bg-[#eef1f4] text-[#18202a]">
      {showSplash && <div className="digimax-splash fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[#0b1118] px-3" role="status" aria-label="Carregando Digimax Projetos">
        <div className="digimax-ambient absolute inset-0" />
        <div className="digimax-blueprint absolute inset-0" aria-hidden="true" />
        <div className="relative flex w-full flex-col items-center">
          <figure className="digimax-scene relative aspect-square w-[min(96vw,620px)] [perspective:1100px]">
            <img src="/digimax-splash-base.webp" alt="Mascote Digimax Projetos" className="digimax-mascot absolute inset-0 h-full w-full object-contain" />
            <img src="/digimax-splash-sign.webp" alt="" aria-hidden="true" className="digimax-plate-layer absolute inset-0 h-full w-full object-contain" />
            <img src="/digimax-splash-base.webp" alt="" aria-hidden="true" className="digimax-thumb-layer absolute inset-0 h-full w-full object-contain" />
            <img src="/digimax-splash-final.webp" alt="" aria-hidden="true" className="digimax-contact-layer absolute inset-0 h-full w-full object-contain" />
            <span className="digimax-helmet-shine absolute" aria-hidden="true" />
            <span className="digimax-contact-highlight absolute" aria-hidden="true" />
          </figure>
          <p className="digimax-loader-copy -mt-2 text-sm font-bold uppercase tracking-[0.2em] text-white">Projetando novas possibilidades</p>
          <div className="mt-4 h-1.5 w-56 overflow-hidden rounded-full bg-white/10"><span className="digimax-progress block h-full rounded-full bg-[#f47b20]" /></div>
        </div>
      </div>}
      <header className="border-b border-white/10 bg-[#101820] text-white">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#f47b20] shadow-[0_8px_24px_rgba(244,123,32,.28)]"><Box className="size-5" aria-hidden="true" /></div><div><p className="text-[1.05rem] font-bold tracking-tight">DIGIMAX <span className="font-medium text-slate-300">PROJETOS</span></p><p className="text-xs tracking-[0.14em] text-slate-400">FACHADAS INTELIGENTES</p></div></div>
          <div className="hidden items-center gap-3 sm:flex"><Badge className="border border-white/10 bg-white/5 px-3 py-1 text-slate-300">Projeto sem título</Badge><div className="grid size-9 place-items-center rounded-full bg-[#294b6d] text-sm font-semibold">DP</div></div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1540px] gap-5 p-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:p-6 xl:p-8">
        <Card className="overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-[0_12px_40px_rgba(22,34,47,.08)]">
          <form onSubmit={(event) => event.preventDefault()} className="space-y-6 p-6">
            <fieldset><legend className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><span className="grid size-6 place-items-center rounded-md bg-[#eaf1f8] text-xs text-[#315b82]">01</span>Dimensões geométricas</legend><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-600">Frente do Terreno<div className="relative mt-2"><Input type="number" min="1" step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} className="h-11 pr-9" aria-label="Largura da frente do terreno em metros" /><span className="absolute right-3 top-3 text-sm text-slate-400">m</span></div></label><label className="text-sm font-medium text-slate-600">Altura do muro<div className="relative mt-2"><Input type="number" min="1" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className="h-11 pr-9" aria-label="Altura do muro em metros" /><span className="absolute right-3 top-3 text-sm text-slate-400">m</span></div></label></div></fieldset>
            <fieldset><legend className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><span className="grid size-6 place-items-center rounded-md bg-[#eaf1f8] text-xs text-[#315b82]">02</span>Linguagem arquitetônica</legend><label className="text-sm font-medium text-slate-600">Estilo<Select value={style} onValueChange={setStyle}><SelectTrigger className="mt-2 h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{["Moderno", "Contemporâneo", "Neoclássico", "Industrial"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label></fieldset>
            <fieldset><legend className="mb-3 text-sm font-bold text-slate-800">Materiais de acabamento</legend><div className="grid grid-cols-2 gap-2">{materials.map((material) => { const checked = selectedMaterials.includes(material); return <label key={material} className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${checked ? "border-[#315b82] bg-[#edf4fa] text-[#244a6c]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}><Checkbox checked={checked} onCheckedChange={() => toggleMaterial(material)} /><span>{material}</span></label>; })}</div></fieldset>
            <fieldset className="space-y-4">
              <legend className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><span className="grid size-6 place-items-center rounded-md bg-[#eaf1f8] text-xs text-[#315b82]">04</span>Portão e necessidades</legend>
              <label className="block text-sm font-medium text-slate-600">Tipo de portão<Select value={gateType} onValueChange={setGateType}><SelectTrigger className="mt-2 h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{["Portão Basculante", "Portão de Correr", "Portão Duplo", "Portão Vazado", "Fechado em Chapa"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label>
              <label className="block text-sm font-medium text-slate-600">Necessidades do cliente<Textarea value={clientNeeds} onChange={(e) => setClientNeeds(e.target.value)} className="mt-2 min-h-28 resize-none leading-6" placeholder="Descreva acessos, iluminação, lixeira, paisagismo…" /></label>
              <div>
                <p className="text-sm font-medium text-slate-600">Imagem de referência <span className="font-normal text-slate-400">(opcional)</span></p>
                {referenceImage ? <div className="relative mt-2 overflow-hidden rounded-xl border border-[#315b82]/25 bg-[#edf4fa]">
                  <img src={referenceImage.dataUrl} alt="Prévia da imagem de referência" className="h-36 w-full object-cover" />
                  <div className="flex items-center justify-between gap-3 px-3 py-2"><span className="min-w-0 truncate text-xs font-medium text-[#244a6c]">{referenceImage.name}</span><Button type="button" variant="ghost" size="icon-sm" aria-label="Remover imagem de referência" onClick={() => { setReferenceImage(null); setNotice("Imagem de referência removida."); }} className="shrink-0 text-slate-600 hover:bg-white"><X /></Button></div>
                  <p className="border-t border-[#315b82]/15 px-3 py-2 text-xs font-medium leading-5 text-[#244a6c]">Modo edição fiel: mantém a fachada atual e acrescenta somente as necessidades do cliente.</p>
                </div> : <label className="mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition hover:border-[#315b82] hover:bg-[#edf4fa]">
                  <ImagePlus className="mb-2 size-6 text-[#315b82]" />
                  <span className="text-sm font-semibold text-slate-700">Anexar imagem de referência</span>
                  <span className="mt-1 text-xs text-slate-400">JPG, PNG ou WebP · até 10 MB</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => handleReferenceImage(event.target.files?.[0])} />
                </label>}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><span className="grid size-6 place-items-center rounded-md bg-[#eaf1f8] text-xs text-[#315b82]">05</span>Motor de geração</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" aria-pressed={imageProvider === "pollinations"} onClick={() => setImageProvider("pollinations")} className={`h-auto min-h-14 justify-start gap-3 rounded-xl px-3 text-left ${imageProvider === "pollinations" ? "border-[#f47b20] bg-[#fff5ed] text-[#a3480d]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f47b20] text-white"><Sparkles className="size-4" /></span><span><span className="block text-sm font-bold">Pollinations</span><span className="block text-xs font-normal opacity-75">Grátis, sem chave</span></span>
                </Button>
                <Button type="button" variant="outline" aria-pressed={imageProvider === "puter"} onClick={() => setImageProvider("puter")} className={`h-auto min-h-14 justify-start gap-3 rounded-xl px-3 text-left ${imageProvider === "puter" ? "border-[#315b82] bg-[#edf4fa] text-[#244a6c]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#315b82] text-white"><WandSparkles className="size-4" /></span><span><span className="block text-sm font-bold">Puter + OpenAI</span><span className="block text-xs font-normal opacity-75">Qualidade melhor</span></span>
                </Button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{referenceImage ? "A imagem de referência exige Puter para manter a fachada e aplicar apenas suas necessidades." : imageProvider === "puter" ? "A primeira geração pedirá conexão com o Puter; o modelo OpenAI prioriza qualidade." : "Pollinations é a opção principal gratuita; pode ter fila ou limite temporário."}</p>
            </fieldset>
            <Button type="button" onClick={() => void generateWithParams(currentParams)} disabled={loading || !hydrated || !providerReady} className="h-12 w-full touch-manipulation rounded-xl bg-[#f47b20] text-base font-bold shadow-[0_10px_24px_rgba(244,123,32,.25)] hover:bg-[#db6714]">{!hydrated || !providerReady ? <><Sparkles className="animate-pulse" />Carregando IA…</> : loading ? <><Sparkles className="animate-pulse" />{referenceImage ? "Aprimorando" : "Gerando"} {generationStep}/3 · {generationProgress}%</> : <><WandSparkles />{referenceImage ? "Aprimorar imagem enviada" : "Gerar fachadas exclusivas"}<ChevronRight /></>}</Button>
            {loading && <Button type="button" variant="outline" onClick={cancelGeneration} className="h-11 w-full border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"><X />Interromper geração</Button>}
            <p className="text-center text-xs leading-5 text-slate-500">Você pode trocar o motor a qualquer momento antes de gerar. Com referência anexada, o Puter é aplicado automaticamente.</p>
          </form>
        </Card>

        <section ref={resultsRef} className="flex min-h-[760px] scroll-mt-4 flex-col overflow-hidden rounded-2xl bg-[#16212c] text-white shadow-[0_18px_60px_rgba(22,34,47,.16)]">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><ImageIcon className="size-4 text-[#f47b20]" /><span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Exploração visual</span></div><h2 aria-live="polite" className="mt-1 text-2xl font-bold tracking-tight">{loading ? `Gerando imagem ${generationStep} de 3 — ${generationProgress}%` : "Conceitos gerados"}</h2>{loading && <div className="mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#f47b20] transition-[width] duration-500" style={{ width: `${generationProgress}%` }} /></div>}</div><div className="flex flex-wrap gap-2">{loading && <Button type="button" variant="outline" onClick={cancelGeneration} className="border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 hover:text-white"><X />Interromper</Button>}<Button type="button" variant="outline" onClick={exportJson} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><FileJson />Exportar parâmetros</Button></div></div>
          <div className="flex-1 p-5 sm:p-6">
            {loading || images.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{images.map((image) => <article key={image.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.06] transition hover:-translate-y-1 hover:border-white/25"><button type="button" onClick={() => setFullscreenImage(image)} aria-label={`Abrir ${image.label} em tela cheia`} className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-slate-800 text-left"><img src={image.url} alt={`${image.label}: fachada ${style}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /><div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" /><Badge className="absolute left-3 top-3 bg-black/45 text-white backdrop-blur">{image.label}</Badge><span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur"><Maximize2 className="size-4" /></span><span className="absolute bottom-3 left-3 text-sm font-semibold">{style} · {width} m</span></button><div className="p-4"><div className="mb-4 flex flex-wrap gap-1.5">{selectedMaterials.slice(0, 2).map((item) => <span key={item} className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-slate-300">{item}</span>)}</div><Button type="button" variant="outline" onClick={() => setFloatingImage(image)} className="w-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"><Pin />Dados do projeto</Button></div></article>)}{loading && Array.from({ length: Math.max(0, 3 - images.length) }, (_, index) => <div key={`pending-${images.length + index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"><Skeleton className="aspect-[4/3] w-full rounded-none bg-white/10" /><div className="space-y-3 p-4"><p className="text-sm font-semibold text-slate-400">Aguardando imagem {images.length + index + 1}</p><Skeleton className="h-3 w-full bg-white/10" /><Skeleton className="h-10 w-full bg-white/10" /></div></div>)}</div> : <div className="grid min-h-[510px] place-items-center rounded-2xl border border-dashed border-white/15 bg-[radial-gradient(circle_at_50%_35%,rgba(49,91,130,.22),transparent_45%)] p-8 text-center"><div className="max-w-md"><div className="mx-auto mb-5 grid size-20 place-items-center rounded-3xl border border-white/10 bg-white/5"><WandSparkles className="size-8 text-[#f47b20]" /></div><h3 className="text-xl font-bold">Seu painel de alternativas está pronto</h3><p className="mt-2 leading-7 text-slate-400">Ao gerar, você receberá três direções visuais para apresentar ao cliente e refinar antes da modelagem.</p><div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-300"><Check className="size-4 text-[#f47b20]" />Geometria precisa <span className="text-slate-600">·</span> <Check className="size-4 text-[#f47b20]" />Render diurno</div></div></div>}
          </div>
          <footer className="flex flex-col gap-3 border-t border-white/10 bg-black/10 px-6 py-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between"><p aria-live="polite">{notice}</p><span className="flex shrink-0 items-center gap-2"><ArrowDownToLine className="size-4" />JSON compatível com fluxo BIM</span></footer>
        </section>
      </section>
      {floatingImage && <aside className="fixed inset-x-3 bottom-3 z-50 max-h-[94vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#101820] text-white shadow-[0_24px_80px_rgba(0,0,0,.45)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[430px]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="flex items-center gap-2 text-sm font-bold"><Pin className="size-4 text-[#f47b20]" />{floatingImage.label} fixado</span><Button type="button" variant="ghost" size="icon-sm" aria-label="Fechar imagem flutuante" onClick={() => setFloatingImage(null)} className="text-white hover:bg-white/10 hover:text-white"><X /></Button></div>
        <button type="button" onClick={() => setFullscreenImage(floatingImage)} aria-label="Abrir fachada em tela cheia" className="group relative block w-full cursor-zoom-in overflow-hidden">
          <img src={floatingImage.url} alt={`${floatingImage.label} em visualização flutuante`} className="aspect-[3/2] w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          <span className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur"><Maximize2 className="size-5" /></span>
        </button>
        <div className="space-y-3 bg-[#eef1f4] p-4 text-slate-800">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold"><span className="grid size-6 place-items-center rounded-md bg-[#315b82] text-xs text-white">03</span>Programa da residência</h3><Badge className="bg-[#315b82] text-white">{Math.round(totalProgramArea * 10) / 10} m²</Badge></div>
          <Stepper label="Quartos" value={bedrooms} onChange={setBedrooms} min={1} max={8} />
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Sala", checked: hasLivingRoom, set: setHasLivingRoom, icon: Sofa },
              { label: "Cozinha", checked: hasKitchen, set: setHasKitchen, icon: CookingPot },
              { label: "Suíte", checked: hasSuite, set: setHasSuite, icon: BedDouble },
              { label: "Piscina", checked: hasPool, set: setHasPool, icon: Waves },
              { label: "Garagem", checked: hasGarage, set: setHasGarage, icon: CarFront },
            ].map((item) => <label key={item.label} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${item.checked ? "border-[#315b82] bg-[#e5eef7] text-[#244a6c]" : "border-slate-200 bg-white text-slate-500"}`}><Checkbox checked={item.checked} onCheckedChange={(checked) => item.set(Boolean(checked))} /><item.icon className="size-4" /><span>{item.label}</span></label>)}
          </div>
          <div className="space-y-2">
            {hasLivingRoom && <Stepper label="Sala" value={livingRoomArea} onChange={setLivingRoomArea} min={8} max={80} step={0.5} suffix=" m²" />}
            {hasKitchen && <Stepper label="Cozinha" value={kitchenArea} onChange={setKitchenArea} min={5} max={50} step={0.5} suffix=" m²" />}
            {visibleBedroomAreas.map((area, index) => <Stepper key={`bedroom-${index}`} label={`Quarto ${index + 1}`} value={area} onChange={(value) => setBedroomAreaAt(index, value)} min={6} max={40} step={0.5} suffix=" m²" />)}
            {hasSuite && <Stepper label="Suíte" value={suiteArea} onChange={setSuiteArea} min={8} max={60} step={0.5} suffix=" m²" />}
            {hasPool && <Stepper label="Piscina" value={poolArea} onChange={setPoolArea} min={8} max={100} step={1} suffix=" m²" />}
            {hasGarage && <Stepper label="Garagem" value={garageArea} onChange={setGarageArea} min={12} max={100} step={0.5} suffix=" m²" />}
          </div>
          <div className="grid grid-cols-3 gap-2"><Button type="button" variant="outline" size="sm" onClick={() => scaleAreas(0.9)}><Minus />10%</Button><Button type="button" variant="outline" size="sm" onClick={fitAreasToFrontage}>Ajustar</Button><Button type="button" variant="outline" size="sm" onClick={() => scaleAreas(1.1)}><Plus />10%</Button></div>
          <section className="rounded-2xl border border-[#315b82]/20 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3"><h4 className="flex items-center gap-2 text-sm font-bold text-slate-800"><span className="grid size-8 place-items-center rounded-lg bg-[#eaf1f8] text-[#315b82]"><Calculator className="size-4" /></span>Estimativa preliminar</h4><Select value={finishLevel} onValueChange={(value) => setFinishLevel(value as FinishLevel)}><SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger><SelectContent>{(["Econômico", "Médio", "Alto padrão"] as FinishLevel[]).map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select></div>
            <div className="rounded-xl bg-[#16212c] px-4 py-3 text-white"><p className="text-xs uppercase tracking-[.14em] text-slate-400">Faixa estimada da obra</p><p className="mt-1 text-lg font-bold text-[#ff9138]">{currency(budget.low)} a {currency(budget.high)}</p><p className="mt-1 text-xs text-slate-300">Área construída estimada: {budget.estimatedBuiltArea.toFixed(1).replace(".", ",")} m²</p></div>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between gap-3"><span>Residência e acabamentos</span><strong className="text-slate-800">{currency(budget.house)}</strong></div>
              <div className="flex justify-between gap-3"><span>Muro frontal</span><strong className="text-slate-800">{currency(budget.frontWall)}</strong></div>
              <div className="flex justify-between gap-3"><span>Portão</span><strong className="text-slate-800">{currency(budget.gate)}</strong></div>
              {hasPool && <div className="flex justify-between gap-3"><span>Piscina</span><strong className="text-slate-800">{currency(budget.pool)}</strong></div>}
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><span>Projetos e reserva técnica</span><strong className="text-slate-800">{currency(budget.technicalAndContingency)}</strong></div>
            </div>
            <p className="mt-3 text-[11px] leading-4 text-slate-500">Cálculo paramétrico para estudo inicial, com base de {currency(budget.baseRate)}/m². Não inclui terreno, móveis, impostos ou condições específicas do local. Confirme com orçamento executivo.</p>
          </section>
          <Button type="button" onClick={() => void shareOnWhatsApp(floatingImage)} className="w-full bg-[#25D366] font-bold text-white hover:bg-[#20bd5a]"><MessageCircle />Fazer Pedido de Projetos</Button>
          <p className="text-center text-xs leading-5 text-slate-500">O sistema cria um link público temporário da fachada, coloca-o primeiro na mensagem e depois envia os dados do projeto.</p>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-slate-300"><span>A fachada permanece visível enquanto você ajusta.</span><Button type="button" variant="ghost" size="sm" onClick={() => setFloatingImage(null)} className="shrink-0 text-white hover:bg-white/10 hover:text-white"><PinOff />Soltar</Button></div>
      </aside>}
      {fullscreenImage && <div role="dialog" aria-modal="true" aria-label={`${fullscreenImage.label} em tela cheia`} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-2 backdrop-blur-sm sm:p-6" onClick={() => setFullscreenImage(null)}>
        <Button type="button" variant="ghost" size="icon" aria-label="Fechar tela cheia" onClick={() => setFullscreenImage(null)} className="absolute right-3 top-3 z-10 size-12 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white sm:right-6 sm:top-6"><X className="size-6" /></Button>
        <img src={fullscreenImage.url} alt={`${fullscreenImage.label}: fachada ${style}`} onClick={(event) => event.stopPropagation()} className="max-h-full max-w-full rounded-lg object-contain shadow-[0_24px_80px_rgba(0,0,0,.65)]" />
      </div>}
    </main>
  );
}
