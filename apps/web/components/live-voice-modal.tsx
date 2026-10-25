"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Send,
  Loader2,
  Radio,
  Wrench,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@soryos/schema";

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  messages?: ChatMessage[];
  loading?: boolean;
  status?: string | null;
  onSendMessage?: (content: string) => void;
  onCodeGenerated?: (files: Record<string, string>) => void;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      0: SpeechRecognitionResultItem;
      isFinal: boolean;
    };
  };
}

interface WindowWithSpeech extends Window {
  AudioContext?: typeof AudioContext;
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitAudioContext?: typeof AudioContext;
}

// Clean markdown and code blocks for spoken synthesis
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "J'ai généré les modifications correspondantes dans le projet.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract text content and tool summary from a ChatMessage blocks array */
function extractTurnSummary(msg: ChatMessage): { text: string; tools: string[] } {
  let text = msg.content || "";
  const tools: string[] = [];

  if (msg.blocks && msg.blocks.length > 0) {
    const textBlocks: string[] = [];
    for (const block of msg.blocks) {
      if (block.type === "text" && block.content) {
        textBlocks.push(block.content);
      } else if (block.type === "tool" && block.step) {
        tools.push(`${block.step.name}: ${JSON.stringify(block.step.input)}`);
      }
    }
    if (textBlocks.length > 0) {
      text = textBlocks.join("\n");
    }
  }

  return { text, tools };
}

export function LiveVoiceModal({
  isOpen,
  onClose,
  sessionId: _sessionId,
  messages = [],
  loading = false,
  status = null,
  onSendMessage,
  onCodeGenerated,
}: LiveVoiceModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [transcriptInput, setTranscriptInput] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSpokenMsgIdRef = useRef<string | null>(null);
  const prevLoadingRef = useRef<boolean>(false);

  // Scroll messages to bottom on update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript, status]);

  // Audio synthesis playback
  const speakResponse = useCallback(
    (text: string) => {
      if (!audioEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      window.speechSynthesis.cancel();
      const clean = cleanTextForSpeech(text);
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "fr-FR";
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const frenchVoice = voices.find(
        (v) => v.lang.startsWith("fr") && !v.name.includes("bad"),
      );
      if (frenchVoice) {
        utterance.voice = frenchVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [audioEnabled],
  );

  // Automatic Vocal Response when Assistant finishes turn in shared session
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;

    if (wasLoading && !loading && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === "assistant" && lastMsg.id !== lastSpokenMsgIdRef.current) {
        lastSpokenMsgIdRef.current = lastMsg.id;
        const { text } = extractTurnSummary(lastMsg);
        if (text) {
          speakResponse(text);
        }
      }
    }
  }, [loading, messages, speakResponse]);

  // Dispatch message to shared session
  const sendVoiceCommand = useCallback(
    (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || loading) return;

      setInterimTranscript("");
      setTranscriptInput("");
      onSendMessage?.(trimmed);
    },
    [loading, onSendMessage],
  );

  // Setup Web Audio Analyser for visual frequency waves
  const setupAudioAnalyser = useCallback(async () => {
    try {
      if (typeof window === "undefined" || !navigator.mediaDevices) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const win = window as WindowWithSpeech;
      const AudioCtx = win.AudioContext || win.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn("AudioContext setup notice:", err);
    }
  }, []);

  // Initialize Speech Recognition
  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const win = window as WindowWithSpeech;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn("SpeechRecognition not available in this browser");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "fr-FR";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }

        if (final && final.trim()) {
          setInterimTranscript("");
          sendVoiceCommand(final);
        }
      };

      recognition.onerror = (e: { error: string }) => {
        console.warn("Recognition error:", e.error);
      };

      recognition.onend = () => {
        if (!isMuted && isOpen) {
          try {
            recognition.start();
          } catch {
            // Already active
          }
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Failed to start SpeechRecognition:", err);
    }
  }, [isMuted, isOpen, sendVoiceCommand]);

  // Lifecycle
  useEffect(() => {
    if (!isOpen) return;

    void setupAudioAnalyser();
    startListening();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen, setupAudioAnalyser, startListening]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex h-[88vh] max-h-[760px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#141210] text-white shadow-2xl">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-gradient-to-b from-[#c6623f]/30 to-transparent blur-3xl" />

        {/* Modal Header */}
        <div className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#c6623f] to-[#e88d67] shadow-lg shadow-[#c6623f]/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-white">
                  Live Voice Sync
                </h2>
                <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400 border border-red-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                  SESSION SYNC
                </span>
              </div>
              <p className="text-xs text-white/50">
                Mode vocal synchrone en temps réel avec le Chat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition"
              title={audioEnabled ? "Désactiver le son" : "Activer le son"}
            >
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition"
              title="Fermer la vue Live"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Central Orb & Live Audio Wave */}
        <div className="relative flex flex-col items-center justify-center py-5 px-6 shrink-0">
          <div className="relative flex items-center justify-center">
            {/* Halo */}
            <div
              className={`absolute h-36 w-36 rounded-full transition-all duration-300 ${
                isSpeaking
                  ? "bg-[#c6623f]/40 scale-125 blur-xl animate-pulse"
                  : isListening
                    ? "bg-emerald-500/30 scale-110 blur-xl animate-pulse"
                    : "bg-white/10 scale-95 blur-md"
              }`}
            />

            {/* Core Orb */}
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-gradient-to-b from-[#2a2420] to-[#1a1714] shadow-2xl">
              {isSpeaking ? (
                <div className="flex items-center gap-1.5 h-8">
                  {[40, 75, 100, 60, 85].map((height, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-[#e88d67] animate-pulse"
                      style={{ height: `${height}%`, animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              ) : isListening ? (
                <div className="flex items-center gap-1.5 h-8">
                  {[25, 60, 90, 50, 70].map((base, i) => {
                    const dynamicHeight = Math.max(20, Math.min(100, base * (audioLevel / 40)));
                    return (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-emerald-400 transition-all duration-75"
                        style={{ height: `${dynamicHeight}%` }}
                      />
                    );
                  })}
                </div>
              ) : (
                <Radio className="h-8 w-8 text-white/40" />
              )}
            </div>
          </div>

          <div className="mt-3 text-center">
            <p className="text-sm font-medium text-white/90">
              {loading
                ? "Agent en cours d'exécution..."
                : isSpeaking
                  ? "Gemini répond vocalement..."
                  : isListening
                    ? "À votre écoute, parlez librement..."
                    : "Microphone en pause"}
            </p>

            {/* Live Agent Action / Status Banner */}
            {status && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#c6623f]/40 bg-[#c6623f]/20 px-3 py-1 text-xs font-mono text-[#e88d67]">
                <Wrench className="h-3.5 w-3.5 animate-spin" />
                <span>{status}</span>
              </div>
            )}

            {interimTranscript && (
              <p className="mt-1 text-xs text-[#e88d67] italic font-mono animate-pulse">
                « {interimTranscript} »
              </p>
            )}
          </div>
        </div>

        {/* Live Conversation History (Synced with Chat) */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
          {messages.map((msg) => {
            const { text, tools } = extractTurnSummary(msg);
            if (!text && tools.length === 0) return null;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-[#c6623f] text-white rounded-br-sm"
                      : "bg-white/10 text-white/90 border border-white/10 rounded-bl-sm"
                  }`}
                >
                  {/* Tool executions summary inside Live bubble */}
                  {tools.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {tools.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 font-mono text-[11px] text-[#e88d67]"
                        >
                          <Terminal className="h-3 w-3 shrink-0" />
                          <span className="truncate">{t}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {text && <p className="leading-relaxed whitespace-pre-wrap">{text}</p>}
                </div>
                <span className="mt-1 text-[10px] text-white/40 px-1 font-mono">
                  {msg.role === "user" ? "Vous" : "Agent OpenCode"}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Live Voice Controls */}
        <div className="relative z-10 shrink-0 border-t border-white/10 bg-[#191613] p-4">
          <div className="flex items-center gap-3">
            {/* Mic Toggle Button */}
            <button
              onClick={() => {
                if (isListening) {
                  if (recognitionRef.current) recognitionRef.current.stop();
                  setIsListening(false);
                  setIsMuted(true);
                } else {
                  setIsMuted(false);
                  startListening();
                }
              }}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition shadow-lg ${
                isListening
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 ring-4 ring-emerald-500/20"
                  : "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
              }`}
              title={isListening ? "Couper le micro" : "Activer le micro"}
            >
              {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>

            {/* Fallback Text Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={transcriptInput}
                onChange={(e) => setTranscriptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && transcriptInput.trim()) {
                    sendVoiceCommand(transcriptInput);
                  }
                }}
                placeholder="Parlez au micro ou tapez votre commande..."
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#c6623f] focus:outline-none focus:ring-1 focus:ring-[#c6623f]"
              />
            </div>

            <Button
              onClick={() => {
                if (transcriptInput.trim()) {
                  sendVoiceCommand(transcriptInput);
                }
              }}
              disabled={!transcriptInput.trim() || loading}
              className="h-12 w-12 shrink-0 rounded-2xl bg-[#c6623f] hover:bg-[#b05332] text-white p-0 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
