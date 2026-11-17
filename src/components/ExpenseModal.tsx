import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Mic,
  Plus,
  Split,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  CARD_SUGGESTIONS,
  CURRENCY_CONFIG,
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_META,
  PAYMENT_METHODS,
  UPI_SUGGESTIONS,
  type CurrencyCode,
  type Expense,
  type ExpenseCategory,
  type PaymentMethod,
  type PaymentSplit,
  type VoiceExtractionResult,
} from '../types/expense';
import { formatMoneyExact } from '../services/expenseService';

interface ExpenseModalProps {
  isOpen: boolean;
  currency: CurrencyCode;
  editingExpense: Expense | null;
  autoStartVoice?: boolean;
  onClose: () => void;
  onSave: (
    payload: Omit<Expense, 'id' | 'user_id' | 'created_at'> & { id?: string }
  ) => void;
}

interface LegDraft {
  id: string;
  payment_method: PaymentMethod;
  amountStr: string;
  method_details: string;
}

function toLocalDateTimeInputValue(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function getPreferredAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read audio recording.'));
        return;
      }
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not encode audio recording.'));
    reader.readAsDataURL(blob);
  });
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  currency,
  editingExpense,
  autoStartVoice = false,
  onClose,
  onSave,
}) => {
  const currencySymbol = CURRENCY_CONFIG[currency]?.symbol || '₹';

  // Core Form State
  const [title, setTitle] = useState('');
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food & Dining');
  const [transactionDate, setTransactionDate] = useState(toLocalDateTimeInputValue());
  const [notes, setNotes] = useState('');
  const [rawTranscript, setRawTranscript] = useState('');

  // Payment Engine State
  const [isSplit, setIsSplit] = useState(false);
  const [singleMethod, setSingleMethod] = useState<PaymentMethod>('CASH');
  const [singleDetails, setSingleDetails] = useState('');
  const [splitLegs, setSplitLegs] = useState<LegDraft[]>([
    { id: crypto.randomUUID(), payment_method: 'CASH', amountStr: '', method_details: '' },
    { id: crypto.randomUUID(), payment_method: 'UPI', amountStr: '', method_details: 'GPay' },
  ]);

  // Voice Recording State
  const [voiceStatus, setVoiceStatus] = useState<
    'idle' | 'recording' | 'processing' | 'success' | 'error'
  >('idle');
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([15, 20, 15, 25, 18, 22, 16, 20]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const cleanupMedia = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current !== null) {
      window.cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  // Initialize form when modal opens
  useEffect(() => {
    if (!isOpen) {
      cleanupMedia();
      return;
    }

    setVoiceStatus('idle');
    setVoiceMessage(null);
    setRecordingSeconds(0);

    if (editingExpense) {
      setTitle(editingExpense.title);
      setTotalAmountStr(String(editingExpense.total_amount));
      setCategory(editingExpense.category);
      setTransactionDate(toLocalDateTimeInputValue(editingExpense.transaction_date));
      setNotes(editingExpense.notes || '');
      setRawTranscript(editingExpense.raw_voice_transcript || '');

      const splitMode = editingExpense.is_split || editingExpense.payments.length > 1;
      setIsSplit(splitMode);

      if (splitMode) {
        setSplitLegs(
          editingExpense.payments.map((p) => ({
            id: p.id || crypto.randomUUID(),
            payment_method: p.payment_method,
            amountStr: String(p.amount),
            method_details: p.method_details || '',
          }))
        );
      } else {
        const leg = editingExpense.payments[0];
        setSingleMethod(leg?.payment_method || 'CASH');
        setSingleDetails(leg?.method_details || '');
      }
    } else {
      setTitle('');
      setTotalAmountStr('');
      setCategory('Food & Dining');
      setTransactionDate(toLocalDateTimeInputValue());
      setNotes('');
      setRawTranscript('');
      setIsSplit(false);
      setSingleMethod('CASH');
      setSingleDetails('');
      setSplitLegs([
        { id: crypto.randomUUID(), payment_method: 'CASH', amountStr: '', method_details: '' },
        { id: crypto.randomUUID(), payment_method: 'UPI', amountStr: '', method_details: 'GPay' },
      ]);

      if (autoStartVoice) {
        void startRecording();
      }
    }

    return () => {
      cleanupMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingExpense, autoStartVoice]);

  const startRecording = async () => {
    setVoiceMessage(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setVoiceStatus('error');
      setVoiceMessage(
        'Audio recording is not supported in this browser. Please enter your expense details manually below.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = getPreferredAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalMimeType });
        cleanupMedia();

        if (blob.size < 100) {
          setVoiceStatus('error');
          setVoiceMessage(
            'Recording was too short or empty. Try holding for a couple seconds or enter details manually.'
          );
          return;
        }

        await processAudioWithGemini(blob, finalMimeType);
      };

      // Setup live waveform visualizer using Web Audio API
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateLevels = () => {
            analyser.getByteFrequencyData(dataArray);
            const bars = Array.from({ length: 8 }, (_, idx) => {
              const val = dataArray[idx] || 0;
              return Math.max(15, Math.min(100, Math.round((val / 255) * 100)));
            });
            setAudioLevels(bars);
            animFrameRef.current = window.requestAnimationFrame(updateLevels);
          };
          updateLevels();
        }
      } catch {
        // Non-critical visual fallback
      }

      recorder.start(250);
      setVoiceStatus('recording');
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      cleanupMedia();
      setVoiceStatus('error');
      const errName = err instanceof DOMException ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setVoiceMessage(
          'Microphone permission was denied. Please allow microphone access in your browser settings to use Voice Log, or enter your expense manually below.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setVoiceMessage(
          'No microphone device was detected. You can enter your expense details manually below.'
        );
      } else {
        setVoiceMessage(
          'Unable to access microphone. Please check browser permissions or enter your expense manually.'
        );
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setVoiceStatus('processing');
      mediaRecorderRef.current.stop();
    }
  };

  const processAudioWithGemini = async (blob: Blob, mimeType: string) => {
    setVoiceStatus('processing');
    setVoiceMessage('Transcribing and extracting expense fields...');

    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch('/api/expenses/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType,
          currency,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Voice extraction failed.');
      }

      const extracted = data as VoiceExtractionResult;

      if (extracted.transcript) setRawTranscript(extracted.transcript);
      if (extracted.title) setTitle(extracted.title);
      if (extracted.total_amount > 0) setTotalAmountStr(String(extracted.total_amount));
      if (EXPENSE_CATEGORIES.includes(extracted.category)) {
        setCategory(extracted.category);
      }

      if (extracted.payments && extracted.payments.length > 1) {
        setIsSplit(true);
        setSplitLegs(
          extracted.payments.map((leg) => ({
            id: crypto.randomUUID(),
            payment_method: leg.method,
            amountStr: String(leg.amount),
            method_details: leg.details || '',
          }))
        );
      } else if (extracted.payments && extracted.payments.length === 1) {
        setIsSplit(false);
        setSingleMethod(extracted.payments[0].method);
        setSingleDetails(extracted.payments[0].details || '');
      }

      setVoiceStatus('success');
      setVoiceMessage('Fields populated from voice note. Review and save below.');
    } catch (err: unknown) {
      setVoiceStatus('error');
      setVoiceMessage(
        err instanceof Error
          ? `${err.message} You can still edit or enter details manually.`
          : 'Could not extract fields from audio. Please enter details manually.'
      );
    }
  };

  const parsedTotal = useMemo(() => {
    const n = parseFloat(totalAmountStr);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [totalAmountStr]);

  const splitSummary = useMemo(() => {
    const legValues = splitLegs.map((leg) => {
      const val = parseFloat(leg.amountStr);
      return Number.isFinite(val) && val > 0 ? val : 0;
    });
    const allocated = legValues.reduce((sum, v) => sum + v, 0);
    const remaining = parsedTotal - allocated;
    const allPositive = splitLegs.length >= 2 && legValues.every((v) => v > 0);
    const isBalanced =
      parsedTotal > 0 && allPositive && Math.abs(remaining) <= 0.01;

    return {
      allocated: Math.round(allocated * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      isBalanced,
      allPositive,
    };
  }, [splitLegs, parsedTotal]);

  const canSave = useMemo(() => {
    if (!title.trim() || parsedTotal <= 0) return false;
    if (!isSplit) return true;
    return splitSummary.isBalanced;
  }, [title, parsedTotal, isSplit, splitSummary.isBalanced]);

  const handleToggleSplitMode = (nextSplit: boolean) => {
    setIsSplit(nextSplit);
    if (nextSplit && splitLegs.length >= 2 && parsedTotal > 0) {
      const existingSum = splitLegs.reduce((s, l) => s + (parseFloat(l.amountStr) || 0), 0);
      if (existingSum === 0) {
        const half = Math.floor((parsedTotal / 2) * 100) / 100;
        const rest = Math.round((parsedTotal - half) * 100) / 100;
        setSplitLegs((prev) => [
          { ...prev[0], amountStr: String(half) },
          { ...prev[1], amountStr: String(rest) },
          ...prev.slice(2),
        ]);
      }
    }
  };

  const handleAddSplitLeg = () => {
    const usedMethods = new Set(splitLegs.map((l) => l.payment_method));
    const nextMethod =
      PAYMENT_METHODS.find((m) => !usedMethods.has(m)) || 'UPI';
    const remainingVal =
      splitSummary.remaining > 0 ? String(splitSummary.remaining) : '';
    setSplitLegs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        payment_method: nextMethod,
        amountStr: remainingVal,
        method_details: '',
      },
    ]);
  };

  const handleRemoveSplitLeg = (id: string) => {
    if (splitLegs.length <= 2) return;
    setSplitLegs((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAutoFillLeg = (legId: string) => {
    const otherSum = splitLegs
      .filter((l) => l.id !== legId)
      .reduce((sum, l) => sum + (parseFloat(l.amountStr) || 0), 0);
    const needed = Math.max(0, Math.round((parsedTotal - otherSum) * 100) / 100);
    setSplitLegs((prev) =>
      prev.map((l) => (l.id === legId ? { ...l, amountStr: String(needed) } : l))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const payments: PaymentSplit[] = isSplit
      ? splitLegs.map((leg) => ({
          id: leg.id,
          payment_method: leg.payment_method,
          amount: Math.round(parseFloat(leg.amountStr) * 100) / 100,
          ...(leg.method_details.trim()
            ? { method_details: leg.method_details.trim() }
            : {}),
        }))
      : [
          {
            id: crypto.randomUUID(),
            payment_method: singleMethod,
            amount: Math.round(parsedTotal * 100) / 100,
            ...(singleDetails.trim() ? { method_details: singleDetails.trim() } : {}),
          },
        ];

    onSave({
      ...(editingExpense ? { id: editingExpense.id } : {}),
      title: title.trim(),
      total_amount: Math.round(parsedTotal * 100) / 100,
      category,
      transaction_date: new Date(transactionDate).toISOString(),
      is_split: isSplit,
      payments,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(rawTranscript.trim() ? { raw_voice_transcript: rawTranscript.trim() } : {}),
    });
  };

  if (!isOpen) return null;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2
              id="expense-modal-title"
              className="font-display text-lg font-semibold text-slate-900"
            >
              {editingExpense ? 'Edit Expense' : 'Log New Expense'}
            </h2>
            <p className="text-xs text-slate-500">
              Speak naturally to auto-fill, or enter single / split payments manually
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              cleanupMedia();
              onClose();
            }}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          {/* Voice Recorder Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {voiceStatus === 'recording' ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Recording ({formatTimer(recordingSeconds)})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={voiceStatus === 'processing'}
                    onClick={startRecording}
                    className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>
                      {voiceStatus === 'processing'
                        ? 'Analyzing Audio...'
                        : voiceStatus === 'success'
                          ? 'Record Again'
                          : 'Record Voice Expense'}
                    </span>
                  </button>
                )}

                {voiceStatus === 'recording' && (
                  <div className="flex items-end gap-1 h-6 px-2" aria-hidden="true">
                    {audioLevels.map((lvl, idx) => (
                      <span
                        key={idx}
                        className="w-1 bg-red-500 rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(20, lvl)}%` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <span className="text-xs text-slate-500">
                Try: &ldquo;Paid 400 on groceries, 150 cash and 250 GPay&rdquo;
              </span>
            </div>

            {voiceMessage && (
              <div
                role={voiceStatus === 'error' ? 'alert' : 'status'}
                className={`mt-3 p-3 rounded-lg text-xs flex items-start gap-2 ${
                  voiceStatus === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : voiceStatus === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {voiceStatus === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                ) : voiceStatus === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : null}
                <span>{voiceMessage}</span>
              </div>
            )}

            {rawTranscript && (
              <div className="mt-3 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-600">
                <span className="font-medium text-slate-800">Transcript: </span>
                &ldquo;{rawTranscript}&rdquo;
              </div>
            )}
          </div>

          {/* Core Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="exp-title"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Merchant / Title *
              </label>
              <input
                id="exp-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Auto Rickshaw, Reliance Fresh, Third Wave Coffee"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label
                htmlFor="exp-amount"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Total Amount ({currency}) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-slate-500">
                  {currencySymbol}
                </span>
                <input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={totalAmountStr}
                  onChange={(e) => setTotalAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="exp-category"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Category *
              </label>
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="exp-date"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Date &amp; Time *
              </label>
              <input
                id="exp-date"
                type="datetime-local"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label
                htmlFor="exp-notes"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Notes (Optional)
              </label>
              <input
                id="exp-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional tags or context"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>
          </div>

          {/* Payment Mode Section */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Payment Method
                </h3>
                <p className="text-xs text-slate-500">
                  Use Split Mode when paying a bill across multiple methods
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleToggleSplitMode(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    !isSplit
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Single Payment
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSplitMode(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                    isSplit
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Split className="w-3.5 h-3.5 text-teal-700" />
                  <span>Split Payment</span>
                </button>
              </div>
            </div>

            {!isSplit ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2.5">
                  {PAYMENT_METHODS.map((method) => {
                    const meta = PAYMENT_METHOD_META[method];
                    const active = singleMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setSingleMethod(method)}
                        className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                          active
                            ? 'border-teal-700 bg-teal-50/70 text-teal-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label
                    htmlFor="single-details"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    {singleMethod === 'UPI'
                      ? 'UPI App / Handle (Optional)'
                      : singleMethod === 'CARD'
                        ? 'Card Bank / Last 4 Digits (Optional)'
                        : 'Cash Source / Note (Optional)'}
                  </label>
                  <input
                    id="single-details"
                    type="text"
                    value={singleDetails}
                    onChange={(e) => setSingleDetails(e.target.value)}
                    placeholder={
                      singleMethod === 'UPI'
                        ? 'e.g., GPay, PhonePe, Paytm, Cred'
                        : singleMethod === 'CARD'
                          ? 'e.g., HDFC Credit •••• 4210'
                          : 'e.g., Wallet cash'
                    }
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />

                  {(singleMethod === 'UPI' || singleMethod === 'CARD') && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(singleMethod === 'UPI' ? UPI_SUGGESTIONS : CARD_SUGGESTIONS).map(
                        (hint) => (
                          <button
                            key={hint}
                            type="button"
                            onClick={() => setSingleDetails(hint)}
                            className="px-2.5 py-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                          >
                            {hint}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Split Legs List */}
                {splitLegs.map((leg, idx) => (
                  <div
                    key={leg.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">
                        Payment Leg {idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {parsedTotal > 0 && (
                          <button
                            type="button"
                            onClick={() => handleAutoFillLeg(leg.id)}
                            className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
                          >
                            Auto-fill remaining
                          </button>
                        )}
                        {splitLegs.length > 2 && (
                          <button
                            type="button"
                            aria-label={`Remove payment leg ${idx + 1}`}
                            onClick={() => handleRemoveSplitLeg(leg.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-3">
                        <select
                          aria-label={`Leg ${idx + 1} payment method`}
                          value={leg.payment_method}
                          onChange={(e) => {
                            const nextMethod = e.target.value as PaymentMethod;
                            setSplitLegs((prev) =>
                              prev.map((item) =>
                                item.id === leg.id
                                  ? { ...item, payment_method: nextMethod }
                                  : item
                              )
                            );
                          }}
                          className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {PAYMENT_METHOD_META[m].label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          aria-label={`Leg ${idx + 1} amount`}
                          value={leg.amountStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSplitLegs((prev) =>
                              prev.map((item) =>
                                item.id === leg.id ? { ...item, amountStr: val } : item
                              )
                            );
                          }}
                          placeholder="0.00"
                          className="w-full pl-7 pr-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          aria-label={`Leg ${idx + 1} details`}
                          value={leg.method_details}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSplitLegs((prev) =>
                              prev.map((item) =>
                                item.id === leg.id
                                  ? { ...item, method_details: val }
                                  : item
                              )
                            );
                          }}
                          placeholder={
                            leg.payment_method === 'UPI'
                              ? 'e.g., GPay, PhonePe'
                              : leg.payment_method === 'CARD'
                                ? 'e.g., HDFC Credit'
                                : 'Details (optional)'
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddSplitLeg}
                  className="w-full py-2 border border-dashed border-slate-300 hover:border-teal-600 text-xs font-medium text-slate-600 hover:text-teal-700 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Payment Leg</span>
                </button>

                {/* Real-time Split Balance Feedback */}
                <div
                  className={`p-3.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
                    splitSummary.isBalanced
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {splitSummary.isBalanced ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Split balanced — ready to save</span>
                      </>
                    ) : parsedTotal <= 0 ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Enter a Total Amount above to validate split legs</span>
                      </>
                    ) : !splitSummary.allPositive ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Every split leg must be greater than 0</span>
                      </>
                    ) : splitSummary.remaining > 0.01 ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {formatMoneyExact(splitSummary.remaining, currency)} unallocated
                          — assign remaining amount to save
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="text-red-800">
                          {formatMoneyExact(Math.abs(splitSummary.remaining), currency)}{' '}
                          over-allocated — reduce leg amounts to match total
                        </span>
                      </>
                    )}
                  </div>

                  <div className="font-mono tabular-nums font-semibold">
                    {formatMoneyExact(splitSummary.allocated, currency)} /{' '}
                    {formatMoneyExact(parsedTotal, currency)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                cleanupMedia();
                onClose();
              }}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
            >
              {editingExpense ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
