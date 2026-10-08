'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import type {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@/lib/realtime-contract';

type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseClassroomChatOptions {
  sessionId: string;
  myUserId: string;
  isInstructor: boolean;
  socketRef: React.MutableRefObject<RoomSocket | null>;
  isChatOpen: boolean;
  onNotice?: (msg: string) => void;
}

export function useClassroomChat({
  sessionId,
  myUserId,
  isInstructor,
  socketRef,
  isChatOpen,
  onNotice,
}: UseClassroomChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [locked, setLocked] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Clear unread badge whenever chat tab is visible
  useEffect(() => {
    if (isChatOpen) {
      setUnreadChat(0);
    }
  }, [isChatOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleHistory = useCallback((p: { messages: ChatMessage[] }) => {
    setMessages(p.messages);
  }, []);

  const handleNewMessage = useCallback(
    (m: ChatMessage) => {
      setMessages((prev) => [...prev, m]);
      if (!isChatOpen && m.user.userId !== myUserId) {
        setUnreadChat((n) => n + 1);
      }
    },
    [isChatOpen, myUserId],
  );

  const handleLockUpdate = useCallback((p: { locked: boolean }) => {
    setLocked(p.locked);
  }, []);

  const send = useCallback(
    (form: HTMLFormElement) => {
      const input = form.elements.namedItem('body') as HTMLInputElement;
      const body = input.value.trim();
      if (!body) return;
      socketRef.current?.emit('chat:send', { sessionId, body });
      input.value = '';
    },
    [sessionId, socketRef],
  );

  const uploadVoice = useCallback(
    async (blob: Blob) => {
      setUploadingVoice(true);
      try {
        const token = await getRealtimeToken();
        const form = new FormData();
        form.append('file', blob, 'voice.webm');
        const res = await fetch(`${API_URL}/sessions/${sessionId}/voice`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token ?? ''}` },
          body: form,
        });
        if (!res.ok) throw new Error(`upload failed (${res.status})`);
        const { audioUrl } = (await res.json()) as { audioUrl: string };
        socketRef.current?.emit('chat:voice', { sessionId, audioUrl });
      } catch {
        onNotice?.('Could not send the voice note. Try again.');
      } finally {
        setUploadingVoice(false);
      }
    },
    [sessionId, socketRef, onNotice],
  );

  const startRecording = useCallback(async () => {
    if (recording || uploadingVoice) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(voiceChunksRef.current, {
          type: rec.mimeType || 'audio/webm',
        });
        if (blob.size > 0) void uploadVoice(blob);
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
    } catch {
      onNotice?.('Microphone access is needed to record a voice note.');
    }
  }, [recording, uploadingVoice, uploadVoice, onNotice]);

  const stopRecording = useCallback(() => {
    mediaRecRef.current?.stop();
    mediaRecRef.current = null;
    setRecording(false);
  }, []);

  const toggleLock = useCallback(() => {
    if (!isInstructor) return;
    socketRef.current?.emit('chat:lock', { sessionId, locked: !locked });
  }, [isInstructor, sessionId, locked, socketRef]);

  return {
    messages,
    unreadChat,
    locked,
    recording,
    uploadingVoice,
    chatEndRef,
    send,
    uploadVoice,
    startRecording,
    stopRecording,
    toggleLock,
    clearUnread: () => setUnreadChat(0),
    handleHistory,
    handleNewMessage,
    handleLockUpdate,
  };
}
