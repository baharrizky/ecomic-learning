import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  GraduationCap, LayoutDashboard, BookOpen, PenLine, TrendingUp, User,
  Lightbulb, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, LogOut, Database, Users,
  Mail, Lock, Loader2, RefreshCw, MessageCircle, Sparkles, ClipboardList, Lock as LockIcon,
  ZoomIn, ZoomOut, Send, Clock, Trophy, Award,
} from "lucide-react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, collection, query, where, getDocs,
} from "firebase/firestore";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ---------------- DATA: Peta konsep (sesuai Knowledge Base) ----------------
const CONCEPTS = {
  E1: { name: "Pangkat Positif", short: "aⁿ", prereq: [] },
  E2: { name: "Pangkat Nol", short: "a⁰", prereq: ["E1"] },
  E3: { name: "Pangkat Negatif", short: "a⁻ⁿ", prereq: ["E1"] },
  E4: { name: "Pangkat Pecahan", short: "a^(m/n)", prereq: ["E1", "E2"] },
  E5: { name: "Perkalian Pangkat Sama Basis", short: "aᵐ·aⁿ", prereq: ["E1"] },
  E6: { name: "Persamaan Eksponen", short: "aˣ=b", prereq: ["E1", "E2", "E3", "E4", "E5"] },
};
const CONCEPT_ORDER = ["E1", "E2", "E3", "E4", "E5", "E6"];
const EMPTY_ATTEMPTS = { E1: [], E2: [], E3: [], E4: [], E5: [], E6: [] };
const EMPTY_POOLIDX = { E1: 0, E2: 0, E3: 0, E4: 0, E5: 0, E6: 0 };

const MATERI = {
  E1: { formula: "aⁿ = a × a × ... (n kali)", penjelasan: "Pangkat positif berarti basis dikalikan dengan dirinya sendiri sebanyak n kali.", contoh: "2³ = 2 × 2 × 2 = 8" },
  E2: { formula: "a⁰ = 1", penjelasan: "Bilangan apa pun (kecuali 0) yang dipangkatkan nol hasilnya selalu 1.", contoh: "7⁰ = 1" },
  E3: { formula: "a⁻ⁿ = 1/aⁿ", penjelasan: "Pangkat negatif berarti kebalikan dari pangkat positifnya — bukan tanda minus di depan hasil.", contoh: "2⁻² = 1/2² = 1/4" },
  E4: { formula: "a^(m/n) = ⁿ√aᵐ", penjelasan: "Pangkat pecahan berarti bentuk akar: pembilang jadi pangkat di dalam akar, penyebut jadi indeks akarnya.", contoh: "8^(1/3) = ³√8 = 2" },
  E5: { formula: "aᵐ × aⁿ = aᵐ⁺ⁿ", penjelasan: "Kalau basisnya sama, cukup jumlahkan pangkatnya. Basisnya sendiri tidak berubah.", contoh: "3² × 3³ = 3⁵ = 243" },
  E6: { formula: "aˣ = b", penjelasan: "Untuk mencari x, samakan dulu basis kedua ruas, baru samakan pangkatnya.", contoh: "2ˣ = 8 → 2ˣ = 2³ → x = 3" },
};

const HINTS = {
  E1: { t1: "Ingat: pangkat berarti basis dikalikan dengan dirinya sendiri sebanyak pangkatnya — bukan basis dikali pangkat.", t2: "Contoh: 2³ = 2 × 2 × 2 = 8 (bukan 2 × 3 = 6).", full: "2³ artinya 2 dikalikan 3 kali berturut-turut: 2 × 2 × 2 = 8." },
  E2: { t1: "Ingat: a⁰ = 1 berlaku untuk semua a ≠ 0 — hasilnya bukan 0, dan bukan a itu sendiri.", t2: "Contoh: 4⁰ = 1, sama seperti 100⁰ = 1.", full: "Berapa pun basisnya (asal bukan 0), pangkat nol selalu sama dengan 1." },
  E3: { t1: "Pangkat negatif berarti kebalikan (1 per basis-pangkat-positifnya), bukan tanda minus di depan hasil.", t2: "Contoh: 3⁻² = 1/3² = 1/9.", full: "a⁻ⁿ = 1/aⁿ. Jadi 2⁻² = 1/2² = 1/4 — bukan −4 dan bukan 4." },
  E4: { t1: "Ingat: pangkat pecahan berarti bentuk akar — a^(m/n) = akar pangkat n dari aᵐ, bukan a dibagi n.", t2: "Contoh: 8^(1/3) = akar pangkat 3 dari 8 = 2 (bukan 8/3).", full: "a^(m/n) = ⁿ√(aᵐ). Ubah dulu ke bentuk akar sebelum menghitung." },
  E5: { t1: "Kalau basisnya sama, pangkatnya dijumlahkan — basisnya sendiri tidak berubah dan tidak ikut dikalikan.", t2: "Contoh: 3² × 3³ = 3⁽²⁺³⁾ = 3⁵ = 243.", full: "aᵐ × aⁿ = aᵐ⁺ⁿ. Basis tetap sama, hanya pangkatnya yang dijumlahkan." },
  E6: { t1: "Untuk menyelesaikan aˣ = b, samakan dulu basis kedua ruas, baru samakan pangkatnya.", t2: "Contoh: 2ˣ = 8 → 2ˣ = 2³ → x = 3.", full: "Kalau basis kedua ruas bisa disamakan, pangkatnya pasti sama, sehingga x bisa langsung dibaca dari situ." },
};

const PRACTICE_POOL = {
  E1: [{ text: "2⁴ = ?", options: [{ text: "16", correct: true }, { text: "8" }, { text: "6" }] }, { text: "5³ = ?", options: [{ text: "125", correct: true }, { text: "15" }, { text: "8" }] }],
  E2: [{ text: "12⁰ = ?", options: [{ text: "1", correct: true }, { text: "0" }, { text: "12" }] }, { text: "9⁰ = ?", options: [{ text: "1", correct: true }, { text: "0" }, { text: "9" }] }],
  E3: [{ text: "3⁻² = ?", options: [{ text: "1/9", correct: true }, { text: "−9" }, { text: "9" }] }, { text: "5⁻¹ = ?", options: [{ text: "1/5", correct: true }, { text: "−5" }, { text: "5" }] }],
  E4: [{ text: "27^(1/3) = ?", options: [{ text: "3", correct: true }, { text: "9" }, { text: "24" }] }, { text: "16^(1/2) = ?", options: [{ text: "4", correct: true }, { text: "8" }, { text: "256" }] }],
  E5: [{ text: "3² × 3³ = ?", options: [{ text: "3⁵ (=243)", correct: true }, { text: "3⁶" }, { text: "9⁵" }] }, { text: "5 × 5² = ?", options: [{ text: "5³ (=125)", correct: true }, { text: "5²" }, { text: "25²" }] }],
  E6: [{ text: "3ˣ = 9, x = ?", options: [{ text: "2", correct: true }, { text: "3" }, { text: "9" }] }, { text: "5ˣ = 125, x = ?", options: [{ text: "3", correct: true }, { text: "5" }, { text: "25" }] }],
};

const KB_ROWS = CONCEPT_ORDER.map((c) => ({
  id: c, nama: `${CONCEPTS[c].name} (${CONCEPTS[c].short})`,
  deskripsi: MATERI[c].penjelasan, prereq: CONCEPTS[c].prereq.join(", ") || "–", status: "Aktif",
}));

// ---------------- DATA: Chapter komik ----------------
// Taruh file PDF komik kamu di folder public/comics/, lalu daftarkan di sini.
const CHAPTERS = [
  {
    id: "chapter1",
    title: "Chapter 1: Pengenalan Pangkat",
    desc: "Belajar konsep pangkat positif dan pangkat nol lewat cerita.",
    pdf: "/comics/chapter1.pdf", // ganti dengan file PDF kamu
    concept: "E1",
    tokoh: [
      { nama: "Ganti nama tokoh", peran: "Ganti peran/deskripsi tokoh" },
    ],
    kuis: [
      { id: 1, text: "Tuliskan apa yang diketahui dan ditanyakan dari soal cerita di chapter ini, lalu jelaskan langkah penyelesaiannya tanpa menghitung hasil akhirnya.", points: 20, indicator: "Memahami masalah (Polya)", hints: ["Baca ulang soal, catat semua angka yang diketahui.", "Apa yang ditanyakan biasanya ada di kalimat terakhir soal.", "Coba gambarkan situasinya dulu sebelum menghitung."] },
    ],
  },
];

const WEIGHTS = [0.4, 0.3, 0.15, 0.1, 0.05];
function computeMastery(attempts) {
  if (!attempts || attempts.length === 0) return null;
  const used = attempts.slice(-5).reverse();
  const w = WEIGHTS.slice(0, used.length);
  const sumW = w.reduce((a, b) => a + b, 0);
  return used.reduce((acc, s, i) => acc + s * w[i], 0) / sumW;
}
function statusOf(attempts) {
  const m = computeMastery(attempts);
  if (m === null) return { label: "Belum diuji", tone: "neutral" };
  if (m >= 0.75 && attempts.length >= 3) return { label: "Dikuasai", tone: "good" };
  if (attempts.length >= 5 && m < 0.75) return { label: "Butuh remedial", tone: "bad" };
  return { label: "Dalam proses", tone: "warn" };
}
function overallPctOf(attempts) {
  const tested = CONCEPT_ORDER.map((c) => computeMastery(attempts[c])).filter((m) => m !== null);
  if (tested.length === 0) return 0;
  return Math.round((tested.reduce((a, b) => a + b, 0) / CONCEPT_ORDER.length) * 100);
}
const toneColor = { good: "var(--teal)", warn: "var(--amber)", bad: "var(--rose)", neutral: "var(--muted)" };

// ---------------- Gamifikasi: XP, Level, Badge (dihitung otomatis dari data yang ada) ----------------
function computeXp(attempts, comicProgress) {
  let xp = 0;
  CONCEPT_ORDER.forEach((c) => {
    (attempts[c] || []).forEach((score) => { xp += Math.round(score * 10); });
  });
  Object.values(comicProgress || {}).forEach((p) => { if (p?.finished) xp += 50; });
  return xp;
}
function computeLevel(xp) {
  const perLevel = 200;
  const level = Math.floor(xp / perLevel) + 1;
  const xpInLevel = xp % perLevel;
  return { level, xpInLevel, xpTarget: perLevel };
}
const BADGES = [
  { id: "first_chapter", nama: "Pembaca Pertama", desc: "Selesai membaca 1 chapter komik", icon: "📖", check: (s) => s.chaptersFinished >= 1 },
  { id: "all_chapters", nama: "Pembaca Rajin", desc: "Selesai membaca semua chapter komik", icon: "🔥", check: (s) => s.chaptersFinished >= s.totalChapters && s.totalChapters > 0 },
  { id: "first_correct", nama: "Langkah Pertama", desc: "Menjawab 1 soal latihan dengan benar", icon: "✅", check: (s) => s.correctCount >= 1 },
  { id: "ten_correct", nama: "Latihan 10", desc: "Menjawab 10 soal latihan dengan benar", icon: "🎯", check: (s) => s.correctCount >= 10 },
  { id: "one_mastered", nama: "Penakluk Konsep", desc: "Menguasai 1 konsep eksponen", icon: "⭐", check: (s) => s.masteredCount >= 1 },
  { id: "all_mastered", nama: "Master Eksponen", desc: "Menguasai semua konsep eksponen", icon: "🏆", check: (s) => s.masteredCount >= CONCEPT_ORDER.length },
  { id: "streak_3", nama: "Streak 3 Hari", desc: "Belajar 3 hari berturut-turut", icon: "🔥", check: (s) => s.streak >= 3 },
  { id: "streak_7", nama: "Streak 7 Hari", desc: "Belajar 7 hari berturut-turut", icon: "💪", check: (s) => s.streak >= 7 },
];
function computeBadgeStats(attempts, comicProgress, statuses, streak) {
  const chaptersFinished = Object.values(comicProgress || {}).filter((p) => p?.finished).length;
  const correctCount = CONCEPT_ORDER.reduce((sum, c) => sum + (attempts[c] || []).filter((s) => s >= 0.4).length, 0);
  const masteredCount = CONCEPT_ORDER.filter((c) => statuses[c]?.label === "Dikuasai").length;
  return { chaptersFinished, totalChapters: CHAPTERS.length, correctCount, masteredCount, streak: streak || 0 };
}

// ---------------- Komponen: Pembaca komik (PDF) ----------------
function ComicReader({ url, page, numPages, onLoaded, onPageChange, externalCanvasRef }) {
  const canvasRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [zoom, setZoom] = useState(1.1);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    pdfjsLib.getDocument({ url }).promise
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        onLoaded(doc.numPages);
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (!pdfDoc) return;
    pdfDoc.getPage(page).then((p) => {
      const viewport = p.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      p.render({ canvasContext: ctx, viewport });
    });
  }, [pdfDoc, page, zoom]);

  if (loadError) {
    return (
      <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
        Gagal memuat file komik. Pastikan file PDF sudah ditaruh di <code className="mono">public{url}</code>.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 13 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button className="btn-ghost" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))}><ZoomOut size={14} /></button>
          <span className="mono">{Math.round(zoom * 100)}%</span>
          <button className="btn-ghost" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.2).toFixed(2)))}><ZoomIn size={14} /></button>
        </div>
        <div className="mono">Hal {page}/{numPages || "?"}</div>
      </div>
      <div style={{ overflow: "auto", border: "1px solid var(--line)", borderRadius: 10, textAlign: "center", background: "#e9e9e9", maxHeight: 480 }}>
        {!pdfDoc && <div style={{ padding: 40, color: "var(--muted)" }}><Loader2 size={18} className="spin" /></div>}
        <canvas ref={(node) => { canvasRef.current = node; if (externalCanvasRef) externalCanvasRef.current = node; }} style={{ maxWidth: "100%" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <button className="btn-ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ArrowLeft size={14} /> Sebelumnya</button>
        <button className="btn-primary" disabled={!numPages || page >= numPages} onClick={() => onPageChange(page + 1)}>Berikutnya <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

// ---------------- Komponen: AI Tutor (chat) ----------------
function AiTutor({ context, getPageImage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const nextHistory = [...messages, { role: "user", text }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      let image = null;
      if (getPageImage) {
        const dataUrl = getPageImage();
        if (dataUrl && dataUrl.includes(",")) image = dataUrl.split(",")[1];
      }
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context, history: messages, image, imageMime: "image/jpeg" }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "ai", text: data.reply || data.error || "Maaf, terjadi kesalahan." }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Gagal terhubung ke server AI Tutor." }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 480 }}>
      <div ref={boxRef} style={{ flex: 1, overflowY: "auto", padding: 6 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, marginTop: 40 }}>
            <MessageCircle size={26} style={{ marginBottom: 8 }} /><br />
            Tanyakan apa saja tentang materi komik ini!
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: 10, fontSize: 13.5, maxWidth: "85%", lineHeight: 1.5, background: m.role === "user" ? "var(--brand)" : "var(--paper-2)", color: m.role === "user" ? "white" : "var(--ink)" }}>{m.text}</span>
          </div>
        ))}
        {loading && <div style={{ fontSize: 12, color: "var(--muted)", padding: "0 4px" }}>AI Tutor sedang mengetik...</div>}
      </div>
      <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
        <input type="text" placeholder="Tanya tutor AI..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn-primary" onClick={send} disabled={loading}><Send size={15} /></button>
      </div>
    </div>
  );
}

// ---------------- Komponen: Kuis (tahapan Polya) ----------------
function Quiz({ chapter, unlocked, onFinish }) {
  const questions = chapter.kuis || [];
  const [started, setStarted] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);
  const [answers, setAnswers] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!started || done) return;
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [started, timeLeft, done]);

  if (!unlocked) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <LockIcon size={30} style={{ color: "var(--muted)", marginBottom: 10 }} />
        <h3 className="disp" style={{ fontSize: 18 }}>Kuis Terkunci</h3>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 6 }}>Selesaikan membaca semua halaman chapter ini terlebih dahulu untuk membuka kuis.</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return <div style={{ padding: 20, color: "var(--muted)", fontSize: 13.5 }}>Belum ada soal kuis untuk chapter ini.</div>;
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "30px 20px" }}>
        <CheckCircle2 size={30} style={{ color: "var(--teal)", marginBottom: 10 }} />
        <h3 className="disp" style={{ fontSize: 18 }}>Kuis selesai!</h3>
        <p style={{ color: "var(--muted)", fontSize: 13.5 }}>Jawabanmu sudah tersimpan dan akan diperiksa oleh guru.</p>
      </div>
    );
  }

  if (!started) {
    return (
      <div style={{ textAlign: "center", padding: "30px 20px" }}>
        <ClipboardList size={30} style={{ color: "var(--brand)", marginBottom: 10 }} />
        <h3 className="disp" style={{ fontSize: 18 }}>Kuis {chapter.title}</h3>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 16 }}>{questions.length} soal berdasarkan Tahapan Polya</p>
        <button className="btn-primary" onClick={() => setStarted(true)}>Mulai Kuis <ArrowRight size={15} /></button>
      </div>
    );
  }

  const q = questions[qIndex];

  function submitAnswer() {
    const record = { questionId: q.id, answer, hintsUsed, timeUsed: 180 - timeLeft };
    const nextAnswers = [...answers, record];
    setAnswers(nextAnswers);
    setAnswer(""); setHintsUsed(0); setTimeLeft(180);
    if (qIndex + 1 >= questions.length) {
      setDone(true);
      onFinish(nextAnswers);
    } else {
      setQIndex((i) => i + 1);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8, color: "var(--muted)" }}>
        <span>Soal {qIndex + 1}/{questions.length}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> {timeLeft}s</span>
      </div>
      <div className="bar-track"><div className="bar-fill" style={{ width: (qIndex / questions.length) * 100 + "%", background: "var(--brand)" }} /></div>
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: "14px 0 8px" }}>{q.text}</p>
      <div style={{ fontSize: 12, color: "var(--amber)", marginBottom: 10 }}>{q.points} poin · Indikator: {q.indicator}</div>
      <textarea rows={5} placeholder="Tulis jawabanmu di sini dengan lengkap dan sistematis..." value={answer} onChange={(e) => setAnswer(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--line)", fontSize: 13.5, boxSizing: "border-box", fontFamily: "inherit" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn-ghost" disabled={hintsUsed >= (q.hints || []).length} onClick={() => setHintsUsed((h) => h + 1)}>
          <Lightbulb size={14} /> Petunjuk ({(q.hints || []).length - hintsUsed} tersisa)
        </button>
        <button className="btn-primary" disabled={!answer.trim()} onClick={submitAnswer}>Kirim Jawaban <ArrowRight size={15} /></button>
      </div>
      {hintsUsed > 0 && (
        <div style={{ marginTop: 10 }}>
          {(q.hints || []).slice(0, hintsUsed).map((h, i) => <div key={i} className="misc-item">{h}</div>)}
        </div>
      )}
    </div>
  );
}

// ---------------- Komponen: Layar 1 chapter komik (reader + sidebar tab) ----------------
function ChapterView({ chapter, progress, onBack, onSaveProgress }) {
  const [page, setPage] = useState(progress?.lastPage || 1);
  const [numPages, setNumPages] = useState(progress?.numPages || 0);
  const [tab, setTab] = useState("tutor");
  const pageCanvasRef = useRef(null);

  const finished = numPages > 0 && page >= numPages;

  function handlePageChange(p) {
    setPage(p);
    onSaveProgress({ lastPage: p, numPages, finished: numPages > 0 && p >= numPages });
  }
  function handleLoaded(n) {
    setNumPages(n);
    onSaveProgress({ lastPage: page, numPages: n, finished: page >= n });
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
        <button className="btn-ghost" onClick={onBack}><ArrowLeft size={14} /> Kembali</button>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{chapter.title}</div>
        <div style={{ width: 70 }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", padding: 16 }}>
          <ComicReader url={chapter.pdf} page={page} numPages={numPages} onLoaded={handleLoaded} onPageChange={handlePageChange} externalCanvasRef={pageCanvasRef} />
        </div>
        <div style={{ flex: "1 1 300px", borderLeft: "1px solid var(--line)", padding: 16 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button className={"tabbtn" + (tab === "tutor" ? " active" : "")} onClick={() => setTab("tutor")}><MessageCircle size={13} style={{ verticalAlign: -2 }} /> Tutor</button>
            <button className={"tabbtn" + (tab === "tokoh" ? " active" : "")} onClick={() => setTab("tokoh")}><Users size={13} style={{ verticalAlign: -2 }} /> Tokoh</button>
            <button className={"tabbtn" + (tab === "kuis" ? " active" : "")} onClick={() => setTab("kuis")}><ClipboardList size={13} style={{ verticalAlign: -2 }} /> Kuis</button>
          </div>

          {tab === "tutor" && (
            <AiTutor
              context={chapter.title + " — " + chapter.desc + " (sedang di halaman " + page + " dari " + (numPages || "?") + ")"}
              getPageImage={() => (pageCanvasRef.current ? pageCanvasRef.current.toDataURL("image/jpeg", 0.7) : null)}
            />
          )}

          {tab === "tokoh" && (
            <div>
              {(chapter.tokoh || []).map((t, i) => (
                <div key={i} className="card" style={{ marginBottom: 10, padding: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.nama}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.peran}</div>
                </div>
              ))}
              {(chapter.tokoh || []).length === 0 && <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Belum ada data tokoh.</div>}
            </div>
          )}

          {tab === "kuis" && (
            <Quiz chapter={chapter} unlocked={finished} onFinish={(ans) => onSaveProgress({ lastPage: page, numPages, finished: true, quizAnswers: ans })} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // ---------- Auth & profil ----------
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null); // { name, role, kelas, sekolah }
  const [mode, setMode] = useState("landing"); // landing | auth | app
  const [authTab, setAuthTab] = useState("login"); // login | daftar
  const [authRole, setAuthRole] = useState("siswa");
  const [authName, setAuthName] = useState("");
  const [authKelas, setAuthKelas] = useState("");
  const [authSekolah, setAuthSekolah] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // ---------- Progress siswa: latihan konsep (tersimpan di Firestore) ----------
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [attempts, setAttempts] = useState(EMPTY_ATTEMPTS);
  const [misconceptions, setMisconceptions] = useState([]);
  const [poolIndex, setPoolIndex] = useState(EMPTY_POOLIDX);
  const [comicProgress, setComicProgress] = useState({}); // { [chapterId]: { lastPage, numPages, finished } }
  const [streak, setStreak] = useState(0);
  const [lastActiveDate, setLastActiveDate] = useState(null);
  const streakCheckedRef = useRef(false);
  const [leaderboardStudents, setLeaderboardStudents] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ---------- Navigasi ----------
  const [screen, setScreen] = useState("dashboard"); // dashboard | materi | latihan | diagnosis | hint | progress | profil | komikList | komikChapter
  const [activeConcept, setActiveConcept] = useState("E1");
  const [consecWrong, setConsecWrong] = useState(0);
  const [hintTier, setHintTier] = useState(0);
  const [selected, setSelected] = useState(null);
  const [diag, setDiag] = useState(null);
  const [redirectNote, setRedirectNote] = useState(null);
  const [activeChapterId, setActiveChapterId] = useState(null);

  // ---------- Guru ----------
  const [guruTab, setGuruTab] = useState("beranda");
  const [guruStudents, setGuruStudents] = useState([]);
  const [guruLoading, setGuruLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          setProfile(snap.data());
          setMode("app");
          setScreen("dashboard");
        } else {
          await signOut(auth);
        }
      } else {
        setProfile(null);
        setAttempts(EMPTY_ATTEMPTS);
        setMisconceptions([]);
        setPoolIndex(EMPTY_POOLIDX);
        setComicProgress({});
        setProgressLoaded(false);
        setMode("landing");
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    async function loadProgress() {
      if (!authUser || !profile || profile.role !== "siswa") return;
      const snap = await getDoc(doc(db, "progress", authUser.uid));
      let loadedStreak = 0;
      let loadedLastActive = null;
      if (snap.exists()) {
        const d = snap.data();
        setAttempts(d.attempts || EMPTY_ATTEMPTS);
        setMisconceptions(d.misconceptions || []);
        setPoolIndex(d.poolIndex || EMPTY_POOLIDX);
        setComicProgress(d.comicProgress || {});
        loadedStreak = d.streak || 0;
        loadedLastActive = d.lastActiveDate || null;
      }
      // Hitung streak harian: lanjut kalau aktif kemarin, reset kalau lewat 1 hari, tetap kalau sudah aktif hari ini
      if (!streakCheckedRef.current) {
        streakCheckedRef.current = true;
        const today = new Date().toISOString().slice(0, 10);
        if (loadedLastActive === today) {
          loadedStreak = loadedStreak || 1;
        } else {
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          loadedStreak = loadedLastActive === yesterday ? (loadedStreak || 0) + 1 : 1;
          loadedLastActive = today;
        }
        setStreak(loadedStreak);
        setLastActiveDate(loadedLastActive);
      }
      setProgressLoaded(true);
    }
    loadProgress();
  }, [authUser, profile]);

  useEffect(() => {
    if (!authUser || !profile || profile.role !== "siswa" || !progressLoaded) return;
    setDoc(doc(db, "progress", authUser.uid), { attempts, misconceptions, poolIndex, comicProgress, streak, lastActiveDate }, { merge: true }).catch(() => {});
  }, [attempts, misconceptions, poolIndex, comicProgress, streak, lastActiveDate, authUser, profile, progressLoaded]);

  const statuses = useMemo(() => {
    const s = {};
    CONCEPT_ORDER.forEach((c) => (s[c] = statusOf(attempts[c])));
    return s;
  }, [attempts]);

  function pickNextConcept() {
    const remaining = CONCEPT_ORDER.filter((c) => statuses[c].label !== "Dikuasai");
    if (remaining.length === 0) return null;
    remaining.sort((a, b) => (computeMastery(attempts[a]) ?? 0) - (computeMastery(attempts[b]) ?? 0));
    let target = remaining[0];
    const weakPrereq = CONCEPTS[target].prereq.find((p) => (computeMastery(attempts[p]) ?? 0) < 0.5 && statuses[p].label !== "Dikuasai");
    if (weakPrereq) {
      setRedirectNote(`Kamu belum kuat di ${CONCEPTS[weakPrereq].name} (prasyarat ${CONCEPTS[target].name}) — diarahkan ke sana dulu.`);
      target = weakPrereq;
    } else {
      setRedirectNote(null);
    }
    return target;
  }

  function goStudy() {
    const next = pickNextConcept();
    if (!next) { setScreen("progress"); return; }
    setActiveConcept(next);
    setSelected(null);
    setDiag(null);
    setConsecWrong(0);
    setHintTier(0);
    setScreen("materi");
  }

  function currentQ() {
    const idx = poolIndex[activeConcept] % PRACTICE_POOL[activeConcept].length;
    return PRACTICE_POOL[activeConcept][idx];
  }

  function submitAnswer() {
    const q = currentQ();
    const opt = q.options[selected];
    if (opt.correct) {
      const score = hintTier === 0 ? 1.0 : hintTier === 1 ? 0.7 : hintTier === 2 ? 0.4 : 0.1;
      setAttempts((a) => ({ ...a, [activeConcept]: [...a[activeConcept], score] }));
      setDiag({ correct: true, msg: "Jawabanmu tepat.", score });
    } else {
      const nw = consecWrong + 1;
      setConsecWrong(nw);
      setDiag({ correct: false, tag: opt.tag || null, tier: nw >= 3 ? 3 : nw, resolved: nw >= 3 });
      if (nw >= 3) {
        setAttempts((a) => ({ ...a, [activeConcept]: [...a[activeConcept], 0.1] }));
      }
      if (opt.tag) setMisconceptions((m) => [...m, { concept: activeConcept, tag: opt.tag }]);
    }
    setScreen("diagnosis");
  }

  function afterDiagnosisCorrectOrResolved() {
    setPoolIndex((p) => ({ ...p, [activeConcept]: p[activeConcept] + 1 }));
    setSelected(null);
    setDiag(null);
    setConsecWrong(0);
    setHintTier(0);
    goStudy();
  }

  function goToHint() {
    setHintTier(diag.tier);
    setScreen("hint");
  }

  function afterHint() {
    if (diag.resolved) {
      afterDiagnosisCorrectOrResolved();
    } else {
      setSelected(null);
      setDiag(null);
      setScreen("latihan");
    }
  }

  async function logout() {
    await signOut(auth);
    setScreen("dashboard");
    setGuruStudents([]);
  }

  const overallPct = useMemo(() => overallPctOf(attempts), [attempts]);
  const xp = useMemo(() => computeXp(attempts, comicProgress), [attempts, comicProgress]);
  const { level, xpInLevel, xpTarget } = useMemo(() => computeLevel(xp), [xp]);
  const badgeStats = useMemo(() => computeBadgeStats(attempts, comicProgress, statuses, streak), [attempts, comicProgress, statuses, streak]);
  const earnedBadges = useMemo(() => BADGES.filter((b) => b.check(badgeStats)), [badgeStats]);

  async function loadLeaderboard() {
    setLeaderboardLoading(true);
    try {
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "siswa")));
      const list = [];
      for (const uDoc of usersSnap.docs) {
        const u = uDoc.data();
        const progSnap = await getDoc(doc(db, "progress", uDoc.id));
        const prog = progSnap.exists() ? progSnap.data() : {};
        const sXp = computeXp(prog.attempts || EMPTY_ATTEMPTS, prog.comicProgress || {});
        list.push({ uid: uDoc.id, name: u.name || "Siswa", xp: sXp, streak: prog.streak || 0, level: computeLevel(sXp).level });
      }
      list.sort((a, b) => b.xp - a.xp);
      setLeaderboardStudents(list);
    } catch (e) {}
    setLeaderboardLoading(false);
  }

  async function submitAuth() {
    setAuthError("");
    if (!authEmail.trim() || !authPassword.trim() || (authTab === "daftar" && (!authName.trim() || !authKelas.trim() || !authSekolah.trim()))) {
      setAuthError("Lengkapi semua kolom terlebih dahulu.");
      return;
    }
    if (authTab === "daftar" && authPassword !== authPassword2) {
      setAuthError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setAuthSubmitting(true);
    try {
      if (authTab === "daftar") {
        const cred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        const uid = cred.user.uid;
        const profileData = { name: authName.trim(), role: authRole, email: authEmail.trim() };
        if (authRole === "siswa") { profileData.kelas = authKelas.trim(); profileData.sekolah = authSekolah.trim(); }
        await setDoc(doc(db, "users", uid), profileData);
        if (authRole === "siswa") {
          await setDoc(doc(db, "progress", uid), { attempts: EMPTY_ATTEMPTS, misconceptions: [], poolIndex: EMPTY_POOLIDX, comicProgress: {} });
        }
      } else {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      }
    } catch (e) {
      const map = {
        "auth/email-already-in-use": "Email ini sudah terdaftar. Coba login.",
        "auth/invalid-email": "Format email tidak valid.",
        "auth/weak-password": "Kata sandi minimal 6 karakter.",
        "auth/invalid-credential": "Email atau kata sandi salah.",
        "auth/user-not-found": "Akun tidak ditemukan.",
        "auth/wrong-password": "Kata sandi salah.",
      };
      setAuthError(map[e.code] || "Terjadi kesalahan. Coba lagi.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function loadGuruData() {
    setGuruLoading(true);
    try {
      const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "siswa")));
      const list = [];
      for (const uDoc of usersSnap.docs) {
        const u = uDoc.data();
        const progSnap = await getDoc(doc(db, "progress", uDoc.id));
        const prog = progSnap.exists() ? progSnap.data() : { attempts: EMPTY_ATTEMPTS, misconceptions: [] };
        list.push({ uid: uDoc.id, name: u.name || "Siswa", kelas: u.kelas, sekolah: u.sekolah, attempts: prog.attempts || EMPTY_ATTEMPTS, misconceptions: prog.misconceptions || [], comicProgress: prog.comicProgress || {} });
      }
      setGuruStudents(list);
    } catch (e) {}
    setGuruLoading(false);
  }

  useEffect(() => {
    if (mode === "app" && profile?.role === "guru") loadGuruData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile]);

  useEffect(() => {
    if (mode === "app" && profile?.role === "siswa" && screen === "leaderboard") loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile, screen]);

  const guruAvgPct = useMemo(() => {
    if (guruStudents.length === 0) return 0;
    const sum = guruStudents.reduce((a, s) => a + overallPctOf(s.attempts), 0);
    return Math.round(sum / guruStudents.length);
  }, [guruStudents]);

  function guruConceptMastery(c) {
    const ms = guruStudents.map((s) => computeMastery(s.attempts[c] || [])).filter((m) => m !== null);
    if (ms.length === 0) return null;
    return ms.reduce((a, b) => a + b, 0) / ms.length;
  }
  const guruHardestConcept = useMemo(() => {
    const withData = CONCEPT_ORDER.filter((c) => guruConceptMastery(c) !== null);
    if (withData.length === 0) return "Belum ada data";
    const worst = withData.sort((a, b) => guruConceptMastery(a) - guruConceptMastery(b))[0];
    return CONCEPTS[worst].name;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guruStudents]);
  const allMisconceptions = useMemo(
    () => guruStudents.flatMap((s) => (s.misconceptions || []).map((m) => ({ ...m, student: s.name }))),
    [guruStudents]
  );

  function saveChapterProgress(chapterId, data) {
    setComicProgress((cp) => ({ ...cp, [chapterId]: { ...(cp[chapterId] || {}), ...data } }));
  }

  if (authLoading) {
    return (
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <GlobalStyle />
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}><Loader2 size={18} className="spin" /> Memuat...</div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <GlobalStyle />

      {mode === "landing" && (
        <div className="body-area">
          <div className="hero-card" style={{ textAlign: "center" }}>
            <div className="brand" style={{ justifyContent: "center", marginBottom: 10, color: "white" }}><GraduationCap size={22} /> AC-ITS</div>
            <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", opacity: 0.85, fontWeight: 700, marginBottom: 6 }}>Adaptive Concept-Based Intelligent Tutoring System</div>
            <h1 className="disp" style={{ fontSize: 27, margin: "10px 0" }}>Belajar Matematika Lebih Cerdas</h1>
            <p style={{ opacity: 0.92, fontSize: 14, maxWidth: 420, margin: "0 auto 22px" }}>
              Sistem pembelajaran adaptif materi Eksponensial — lewat komik interaktif, AI Tutor, dan latihan yang menyesuaikan dirimu.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn-primary" style={{ background: "white", color: "var(--brand-dark)", boxShadow: "none" }} onClick={() => { setMode("auth"); setAuthTab("login"); setAuthRole("siswa"); setAuthError(""); }}><User size={15} /> Saya Siswa</button>
              <button className="btn-ghost" style={{ background: "rgba(255,255,255,0.15)", color: "white", borderColor: "rgba(255,255,255,0.4)" }} onClick={() => { setMode("auth"); setAuthTab("login"); setAuthRole("guru"); setAuthError(""); }}><Users size={15} /> Saya Guru</button>
            </div>
          </div>
        </div>
      )}

      {mode === "auth" && (
        <div className="body-area">
          <div className="card" style={{ maxWidth: 400, margin: "0 auto" }}>
            <div className="tag-eyebrow">{authTab === "login" ? "Login" : "Daftar Akun"}</div>
            <h2 className="disp" style={{ fontSize: 19, marginBottom: 14 }}>{authTab === "login" ? "Selamat datang kembali" : "Buat akun baru"}</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button className="btn-ghost" style={{ flex: 1, justifyContent: "center", ...(authTab === "login" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }} onClick={() => { setAuthTab("login"); setAuthError(""); }}>Login</button>
              <button className="btn-ghost" style={{ flex: 1, justifyContent: "center", ...(authTab === "daftar" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }} onClick={() => { setAuthTab("daftar"); setAuthError(""); }}>Daftar</button>
            </div>

            {authError && <div className="err-box"><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {authError}</div>}

            {authTab === "daftar" && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>Daftar sebagai</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-ghost" style={{ flex: 1, justifyContent: "center", ...(authRole === "siswa" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }} onClick={() => setAuthRole("siswa")}><User size={14} /> Siswa</button>
                    <button className="btn-ghost" style={{ flex: 1, justifyContent: "center", ...(authRole === "guru" ? { borderColor: "var(--brand)", background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600 } : {}) }} onClick={() => setAuthRole("guru")}><Users size={14} /> Guru</button>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}><input type="text" placeholder="Nama lengkap" value={authName} onChange={(e) => setAuthName(e.target.value)} /></div>
                {authRole === "siswa" && (
                  <>
                    <div style={{ marginBottom: 10 }}><input type="text" placeholder="Kelas (contoh: 9A, IX-A)" value={authKelas} onChange={(e) => setAuthKelas(e.target.value)} /></div>
                    <div style={{ marginBottom: 10 }}><input type="text" placeholder="Asal sekolah" value={authSekolah} onChange={(e) => setAuthSekolah(e.target.value)} /></div>
                  </>
                )}
              </>
            )}

            <div style={{ marginBottom: 10 }} className="inputwrap"><Mail size={15} /><input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} /></div>
            <div style={{ marginBottom: authTab === "daftar" ? 10 : 16 }} className="inputwrap"><Lock size={15} /><input type="password" placeholder="Kata sandi (min. 6 karakter)" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} /></div>
            {authTab === "daftar" && (
              <div style={{ marginBottom: 16 }} className="inputwrap"><Lock size={15} /><input type="password" placeholder="Ulangi kata sandi" value={authPassword2} onChange={(e) => setAuthPassword2(e.target.value)} /></div>
            )}

            <button className="btn-primary" disabled={authSubmitting} onClick={submitAuth} style={{ width: "100%", justifyContent: "center" }}>
              {authSubmitting ? <Loader2 size={15} className="spin" /> : (authTab === "login" ? <>Login <ArrowRight size={15} /></> : <>Daftar &amp; Mulai Belajar <ArrowRight size={15} /></>)}
            </button>
          </div>
        </div>
      )}

      {mode === "app" && profile && (
        <div className="app-shell">
          <aside className="sidebar">
            <div className="sidebar-brand brand"><GraduationCap size={20} /> AC-ITS</div>

            {profile.role === "siswa" && (
              <nav className="sidebar-nav">
                <button className={"sidebar-navbtn" + (screen === "dashboard" ? " active" : "")} onClick={() => setScreen("dashboard")}><LayoutDashboard size={17} />Dashboard</button>
                <button className={"sidebar-navbtn" + (screen === "komikList" || screen === "komikChapter" ? " active" : "")} onClick={() => setScreen("komikList")}><Sparkles size={17} />Komik</button>
                <button className={"sidebar-navbtn" + (screen === "latihan" || screen === "diagnosis" || screen === "hint" || screen === "materi" ? " active" : "")} onClick={() => setScreen("latihan")}><PenLine size={17} />Latihan</button>
                <button className={"sidebar-navbtn" + (screen === "progress" ? " active" : "")} onClick={() => setScreen("progress")}><TrendingUp size={17} />Progress</button>
                <button className={"sidebar-navbtn" + (screen === "leaderboard" ? " active" : "")} onClick={() => setScreen("leaderboard")}><Trophy size={17} />Peringkat</button>
                <button className={"sidebar-navbtn" + (screen === "badges" ? " active" : "")} onClick={() => setScreen("badges")}><Award size={17} />Koleksi Badge</button>
                <button className={"sidebar-navbtn" + (screen === "profil" ? " active" : "")} onClick={() => setScreen("profil")}><User size={17} />Profil</button>
              </nav>
            )}

            {profile.role === "guru" && (
              <nav className="sidebar-nav">
                <button className={"sidebar-navbtn" + (guruTab === "beranda" ? " active" : "")} onClick={() => setGuruTab("beranda")}><LayoutDashboard size={17} />Beranda</button>
                <button className={"sidebar-navbtn" + (guruTab === "analitik" ? " active" : "")} onClick={() => setGuruTab("analitik")}><TrendingUp size={17} />Analitik</button>
                <button className={"sidebar-navbtn" + (guruTab === "materi" ? " active" : "")} onClick={() => setGuruTab("materi")}><Database size={17} />Knowledge Base</button>
              </nav>
            )}

            <div className="sidebar-profile-card">
              <div className="avatar">{(profile.name || "?").trim().charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.name || "Pengguna"}</div>
                <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{profile.role === "siswa" ? "Siswa" : "Guru"}</div>
              </div>
              <button className="btn-ghost" style={{ padding: 7 }} onClick={logout} title="Keluar"><LogOut size={13} /></button>
            </div>
          </aside>

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {profile.role === "siswa" && (
              <div className="body-area">
                {!progressLoaded && (
                  <div className="card" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}><Loader2 size={16} className="spin" /> Memuat progress belajarmu...</div>
                )}

                {progressLoaded && screen !== "komikChapter" && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    <span className="streak-chip">🔥 Streak {streak} hari</span>
                    <span className="xp-chip">⭐ Level {level} · {xpInLevel}/{xpTarget} XP</span>
                    <span className="pill" style={{ background: "var(--teal-light)", color: "#0F7A56" }}>🏅 {earnedBadges.length}/{BADGES.length} Badge</span>
                  </div>
                )}

                {progressLoaded && screen === "dashboard" && (
                  <>
                    <div className="hero-card" style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>Halo, {profile.name || "Siswa"} 👋</div>
                      <h2 className="disp" style={{ fontSize: 22, margin: "6px 0 4px" }}>Semangat belajar hari ini!</h2>
                      <p style={{ opacity: 0.9, fontSize: 13, marginBottom: 16 }}>Progress latihan konsep kamu sejauh ini</p>
                      <div className="bar-track"><div className="bar-fill" style={{ width: overallPct + "%" }} /></div>
                      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6, marginBottom: 18, fontWeight: 700 }}>{overallPct}% selesai</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="btn-primary" style={{ background: "white", color: "var(--brand-dark)", boxShadow: "none" }} onClick={() => setScreen("komikList")}><Sparkles size={15} /> Baca Komik</button>
                        <button className="btn-ghost" style={{ background: "rgba(255,255,255,0.15)", color: "white", borderColor: "rgba(255,255,255,0.4)" }} onClick={goStudy}>Latihan Konsep <ArrowRight size={15} /></button>
                      </div>
                    </div>
                    <div className="card">
                      <div className="tag-eyebrow">Progress per konsep</div>
                      {CONCEPT_ORDER.map((c) => {
                        const st = statuses[c]; const m = computeMastery(attempts[c]);
                        return (
                          <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                            <span style={{ fontWeight: 600 }}>{CONCEPTS[c].name}</span>
                            <span className="pill" style={{ background: toneColor[st.tone] + "22", color: toneColor[st.tone] }}>{st.label}{m !== null && ` · ${Math.round(m * 100)}%`}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {progressLoaded && screen === "komikList" && (
                  <div className="card">
                    <div className="tag-eyebrow">E-Comic Matematika</div>
                    <h2 className="disp" style={{ fontSize: 19, marginBottom: 14 }}>Pilih Chapter</h2>
                    {CHAPTERS.map((c) => {
                      const p = comicProgress[c.id];
                      const pct = p && p.numPages ? Math.round((p.lastPage / p.numPages) * 100) : 0;
                      return (
                        <button key={c.id} onClick={() => { setActiveChapterId(c.id); setScreen("komikChapter"); }}
                          style={{ display: "flex", gap: 14, width: "100%", textAlign: "left", padding: 16, borderRadius: 16, border: "1.5px solid var(--line)", marginBottom: 12, background: "white" }}>
                          <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--brand-light)", color: "var(--brand-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Sparkles size={20} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.title}</div>
                            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>{c.desc}</div>
                            <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%", background: p?.finished ? "var(--teal)" : undefined }} /></div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontWeight: 600 }}>{p?.finished ? "✓ Selesai dibaca" : pct > 0 ? `${pct}% dibaca` : "Belum dibaca"}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {progressLoaded && screen === "komikChapter" && activeChapterId && (
                  <ChapterView
                    chapter={CHAPTERS.find((c) => c.id === activeChapterId)}
                    progress={comicProgress[activeChapterId]}
                    onBack={() => setScreen("komikList")}
                    onSaveProgress={(data) => saveChapterProgress(activeChapterId, data)}
                  />
                )}

                {progressLoaded && screen === "materi" && (
                  <div className="card">
                    {redirectNote && <div className="misc-item" style={{ marginBottom: 12 }}>↳ {redirectNote}</div>}
                    <div className="tag-eyebrow">Materi · {CONCEPTS[activeConcept].name}</div>
                    <div className="qtext">{MATERI[activeConcept].formula}</div>
                    <p style={{ fontSize: 14, lineHeight: 1.6 }}>{MATERI[activeConcept].penjelasan}</p>
                    <div style={{ background: "var(--paper-2)", borderRadius: 10, padding: 14, marginTop: 10, fontFamily: "'IBM Plex Mono'", fontSize: 14 }}>Contoh: {MATERI[activeConcept].contoh}</div>
                    <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                      <button className="btn-ghost" onClick={() => setScreen("dashboard")}><ArrowLeft size={14} /> Kembali</button>
                      <button className="btn-primary" onClick={() => setScreen("latihan")}>Latihan <ArrowRight size={15} /></button>
                    </div>
                  </div>
                )}

                {progressLoaded && screen === "latihan" && (
                  <div className="card">
                    <div className="tag-eyebrow">Latihan · {CONCEPTS[activeConcept].name} · Salah berturut-turut: {consecWrong}</div>
                    <div className="qtext">{currentQ().text}</div>
                    {currentQ().options.map((opt, i) => (
                      <button key={i} className={"opt" + (selected === i ? " picked" : "")} onClick={() => setSelected(i)}>{opt.text}</button>
                    ))}
                    <div style={{ marginTop: 14 }}><button className="btn-primary" disabled={selected === null} onClick={submitAnswer}>Periksa Jawaban <ArrowRight size={15} /></button></div>
                  </div>
                )}

                {progressLoaded && screen === "diagnosis" && diag && (
                  <div className="card">
                    <div className="tag-eyebrow">Diagnosis &amp; Feedback</div>
                    {diag.correct ? (
                      <div className="ok-box"><CheckCircle2 size={18} /> Tepat! Skor percobaan ini: {diag.score.toFixed(1)}</div>
                    ) : (
                      <>
                        <div className="hint-box hint-t3"><AlertTriangle size={18} /> Belum tepat.</div>
                        <div style={{ fontSize: 13.5, marginBottom: 6 }}><b>Diagnosis sistem:</b> {diag.tag ? `Terdeteksi kemungkinan miskonsepsi "${diag.tag}".` : "Jawaban belum tepat, belum ada pola miskonsepsi spesifik yang cocok."}</div>
                        <div style={{ fontSize: 13.5, color: "var(--muted)" }}>Rekomendasi: coba pahami kembali konsep ini dengan bantuan hint.</div>
                      </>
                    )}
                    <div style={{ marginTop: 16 }}>
                      {diag.correct ? <button className="btn-primary" onClick={afterDiagnosisCorrectOrResolved}>Lanjut <ArrowRight size={15} /></button> : <button className="btn-primary" onClick={goToHint}><Lightbulb size={15} /> Lihat Hint</button>}
                    </div>
                  </div>
                )}

                {progressLoaded && screen === "hint" && diag && (
                  <div className="card">
                    <div className="tag-eyebrow">Hint Adaptif · Tingkat {hintTier}</div>
                    <div className={"hint-box " + (hintTier === 1 ? "hint-t1" : hintTier === 2 ? "hint-t2" : "hint-t3")}>
                      <Lightbulb size={18} />
                      <div>
                        {hintTier === 1 && HINTS[activeConcept].t1}
                        {hintTier === 2 && HINTS[activeConcept].t2}
                        {hintTier === 3 && HINTS[activeConcept].full}
                        {hintTier === 3 && <div style={{ marginTop: 8, fontWeight: 600 }}>Konsep ini ditandai butuh remedial.</div>}
                      </div>
                    </div>
                    <button className="btn-primary" onClick={afterHint}>{hintTier === 3 ? "Mengerti, Lanjut" : "Mengerti, Coba Lagi"} <ArrowRight size={15} /></button>
                  </div>
                )}

                {progressLoaded && screen === "progress" && (
                  <div className="card">
                    <div className="tag-eyebrow">Progress Konsep</div>
                    {CONCEPT_ORDER.map((c) => {
                      const m = computeMastery(attempts[c]); const st = statuses[c]; const pct = m ? Math.round(m * 100) : 0;
                      return (
                        <div key={c} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                            <span style={{ fontWeight: 600 }}>{CONCEPTS[c].name}</span>
                            <span className="pill" style={{ background: toneColor[st.tone] + "22", color: toneColor[st.tone] }}>{st.label} {m !== null && `· ${pct}%`}</span>
                          </div>
                          <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%", background: toneColor[st.tone] }} /></div>
                        </div>
                      );
                    })}
                    {misconceptions.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div className="tag-eyebrow">Log miskonsepsi</div>
                        {misconceptions.map((m, i) => <div className="misc-item" key={i}>{CONCEPTS[m.concept].name}: {m.tag}</div>)}
                      </div>
                    )}
                  </div>
                )}

                {progressLoaded && screen === "leaderboard" && (
                  <div className="card">
                    <div className="tag-eyebrow">Peringkat Siswa</div>
                    <h2 className="disp" style={{ fontSize: 19, marginBottom: 14 }}>Papan Peringkat</h2>
                    {leaderboardLoading && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13.5 }}><Loader2 size={15} className="spin" /> Memuat peringkat...</div>}
                    {!leaderboardLoading && leaderboardStudents.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13.5 }}>Belum ada data siswa lain.</p>}
                    {!leaderboardLoading && leaderboardStudents.map((s, i) => (
                      <div key={s.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderBottom: "1px solid var(--line)", background: s.uid === authUser?.uid ? "var(--brand-light)" : "transparent", borderRadius: 10 }}>
                        <div style={{ width: 26, textAlign: "center", fontWeight: 700, color: i < 3 ? "var(--amber)" : "var(--muted)" }}>{i + 1}</div>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{s.name.trim().charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{s.name}{s.uid === authUser?.uid && " (Kamu)"}</div>
                        <span className="streak-chip">🔥 {s.streak}</span>
                        <span className="xp-chip">⭐ {s.xp} XP</span>
                      </div>
                    ))}
                  </div>
                )}

                {progressLoaded && screen === "badges" && (
                  <div className="card">
                    <div className="tag-eyebrow">Koleksi Badge</div>
                    <h2 className="disp" style={{ fontSize: 19, marginBottom: 4 }}>{earnedBadges.length} dari {BADGES.length} badge terkumpul</h2>
                    <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>Kumpulkan badge dengan aktif belajar dan membaca komik.</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
                      {BADGES.map((b) => {
                        const earned = b.check(badgeStats);
                        return (
                          <div key={b.id} className={"badge-card " + (earned ? "earned" : "locked")}>
                            <div style={{ fontSize: 30, marginBottom: 6 }}>{b.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: 12.5 }}>{b.nama}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{b.desc}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {progressLoaded && screen === "profil" && (
                  <div className="card" style={{ textAlign: "center" }}>
                    <div className="avatar avatar-lg" style={{ margin: "0 auto 14px" }}>{(profile.name || "?").trim().charAt(0).toUpperCase()}</div>
                    <h2 className="disp" style={{ fontSize: 19 }}>{profile.name || "Siswa"}</h2>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "8px 0 14px", flexWrap: "wrap" }}>
                      {profile.kelas && <span className="pill" style={{ background: "var(--brand-light)", color: "var(--brand-dark)" }}>Kelas {profile.kelas}</span>}
                      {profile.sekolah && <span className="pill" style={{ background: "var(--paper-2)", color: "var(--muted)" }}>{profile.sekolah}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
                      <span className="streak-chip">🔥 Streak {streak} hari</span>
                      <span className="xp-chip">⭐ Level {level}</span>
                      <span className="pill" style={{ background: "var(--teal-light)", color: "#0F7A56" }}>🏅 {earnedBadges.length} Badge</span>
                    </div>
                    <div className="stat-chip" style={{ justifyContent: "center", margin: "0 auto 16px", maxWidth: 220 }}>
                      <TrendingUp size={15} style={{ color: "var(--brand)" }} /> Progress: {overallPct}%
                    </div>
                    <button className="btn-ghost" onClick={logout}><LogOut size={14} /> Keluar</button>
                  </div>
                )}
              </div>
            )}

            {profile.role === "guru" && (
              <div className="body-area">
                <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={loadGuruData} disabled={guruLoading}>{guruLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Muat ulang data</button>
                </div>

                {guruTab === "beranda" && (
                  <div className="card">
                    <div className="tag-eyebrow">Dashboard Guru — data siswa dari database</div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, marginBottom: 18 }}>
                      <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Total siswa</div><div className="disp" style={{ fontSize: 22 }}>{guruStudents.length}</div></div>
                      <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Rata-rata penguasaan</div><div className="disp" style={{ fontSize: 22 }}>{guruAvgPct}%</div></div>
                      <div className="card" style={{ flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "var(--muted)" }}>Konsep tersulit</div><div className="disp" style={{ fontSize: 16 }}>{guruHardestConcept}</div></div>
                    </div>
                    {guruStudents.length === 0 && !guruLoading && <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Belum ada siswa yang terdaftar, atau belum ada aktivitas belajar.</p>}
                    {CONCEPT_ORDER.map((c) => {
                      const m = guruConceptMastery(c); const pct = m ? Math.round(m * 100) : 0;
                      const st = m === null ? { tone: "neutral" } : (pct >= 75 ? { tone: "good" } : pct >= 40 ? { tone: "warn" } : { tone: "bad" });
                      return (
                        <div key={c} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{CONCEPTS[c].name}</span><span>{m !== null ? pct + "%" : "–"}</span></div>
                          <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%", background: toneColor[st.tone] }} /></div>
                        </div>
                      );
                    })}
                    {guruStudents.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <div className="tag-eyebrow">Daftar siswa</div>
                        <table>
                          <thead><tr><th>Nama</th><th>Kelas</th><th>Sekolah</th><th>Progress</th></tr></thead>
                          <tbody>{guruStudents.map((s) => (<tr key={s.uid}><td>{s.name}</td><td>{s.kelas || "-"}</td><td>{s.sekolah || "-"}</td><td>{overallPctOf(s.attempts)}%</td></tr>))}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {guruTab === "analitik" && (
                  <div className="card">
                    <div className="tag-eyebrow">Heatmap miskonsepsi (seluruh siswa)</div>
                    {allMisconceptions.length === 0 && <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Belum ada miskonsepsi terdeteksi.</p>}
                    {CONCEPT_ORDER.map((c) => {
                      const items = allMisconceptions.filter((m) => m.concept === c);
                      if (items.length === 0) return null;
                      const counts = {};
                      items.forEach((m) => { counts[m.tag] = (counts[m.tag] || 0) + 1; });
                      return (
                        <div key={c} style={{ marginBottom: 12 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>{CONCEPTS[c].name}</div>
                          {Object.entries(counts).map(([tag, n]) => (<div className="misc-item" key={tag} style={{ display: "inline-block", marginRight: 6 }}>{tag} × {n}</div>))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {guruTab === "materi" && (
                  <div className="card">
                    <div className="tag-eyebrow">Knowledge Base — contoh entri</div>
                    <table>
                      <thead><tr><th>ID</th><th>Nama konsep</th><th>Deskripsi</th><th>Prasyarat</th><th>Status</th></tr></thead>
                      <tbody>{KB_ROWS.map((r) => (<tr key={r.id}><td className="mono">{r.id}</td><td>{r.nama}</td><td>{r.deskripsi}</td><td className="mono">{r.prereq}</td><td>{r.status}</td></tr>))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalStyle() {
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      <style>{`
        :root {
          --paper:#F6F5FC; --paper-2:#EFEDFB; --ink:#1E1B33; --muted:#7A768E;
          --teal:#1FAE7F; --teal-light:#DDF6EC; --amber:#F5A524; --amber-light:#FEF1DA;
          --plum:#8B5CF6; --plum-light:#EDE6FE; --rose:#F0466E; --rose-light:#FDE3EA;
          --line:#E6E3F5; --brand:#7C5CFC; --brand-light:#EEE9FF; --brand-dark:#6238E0;
        }
        .wrap { font-family:'Inter',sans-serif; background:var(--paper); color:var(--ink); border-radius:20px; padding:0; min-height:100%; overflow:hidden; }
        .disp { font-family:'Baloo 2',sans-serif; font-weight:700; }
        .mono { font-family:'IBM Plex Mono',monospace; }
        button { font-family:'Inter'; cursor:pointer; }
        .btn-primary { background:linear-gradient(135deg,var(--brand),var(--brand-dark)); color:white; border:none; padding:11px 20px; border-radius:12px; font-weight:600; font-size:14px; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 14px rgba(124,92,252,0.35); }
        .btn-primary:disabled { opacity:0.35; cursor:not-allowed; box-shadow:none; }
        .btn-ghost { background:white; border:1px solid var(--line); color:var(--ink); padding:9px 16px; border-radius:12px; font-size:13.5px; display:inline-flex; align-items:center; gap:6px; }
        input[type=text],input[type=password],input[type=email] { width:100%; padding:11px 13px; border-radius:12px; border:1.5px solid var(--line); font-size:14px; box-sizing:border-box; background:white; }
        textarea { font-family:'Inter'; border-radius:12px; }
        .card { background:white; border:1px solid var(--line); border-radius:18px; padding:22px; box-shadow:0 2px 10px rgba(90,70,190,0.05); }
        .hero-card { background:linear-gradient(135deg,var(--brand) 0%,#A78BFA 55%,#F472B6 130%); color:white; border-radius:20px; padding:24px; box-shadow:0 10px 30px rgba(124,92,252,0.35); }
        .hero-card .bar-track { background:rgba(255,255,255,0.3); }
        .hero-card .bar-fill { background:white; }
        .avatar { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,var(--brand),#F472B6); color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; font-family:'Baloo 2',sans-serif; flex-shrink:0; }
        .avatar-lg { width:76px; height:76px; font-size:26px; }
        .pill { font-size:11.5px; padding:4px 11px; border-radius:999px; font-weight:700; }
        .stat-chip { background:white; border:1px solid var(--line); border-radius:14px; padding:10px 14px; display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; }
        .opt { display:block; width:100%; text-align:left; padding:13px 14px; border-radius:12px; border:1.5px solid var(--line); background:var(--paper-2); margin-bottom:9px; font-size:14.5px; font-family:'IBM Plex Mono'; transition:border-color .15s; }
        .opt.picked { border-color:var(--brand); background:var(--brand-light); }
        .qtext { font-family:'IBM Plex Mono'; font-size:22px; margin:14px 0 20px; }
        .bar-track { background:var(--paper-2); border-radius:999px; height:9px; overflow:hidden; margin-top:6px; }
        .bar-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,var(--brand),#C084FC); }
        .tag-eyebrow { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; font-weight:700; }
        .hint-box { display:flex; gap:10px; padding:14px; border-radius:14px; margin:14px 0; font-size:13.5px; line-height:1.5; }
        .hint-t1 { background:var(--plum-light); color:var(--plum); }
        .hint-t2 { background:var(--amber-light); color:#9A6414; }
        .hint-t3 { background:var(--rose-light); color:var(--rose); }
        .ok-box { background:var(--teal-light); color:#0F7A56; padding:14px; border-radius:14px; margin:14px 0; font-size:13.5px; display:flex; gap:10px; align-items:center; font-weight:600; }
        .err-box { background:var(--rose-light); color:var(--rose); padding:11px 14px; border-radius:12px; margin-bottom:14px; font-size:13px; font-weight:600; }
        .topbar { display:flex; align-items:center; justify-content:space-between; padding:14px 22px; border-bottom:1px solid var(--line); background:white; }
        .brand { display:flex; align-items:center; gap:8px; font-weight:700; color:var(--brand-dark); font-size:17px; font-family:'Baloo 2',sans-serif; }
        .body-area { padding:20px; }
        .bottomnav { display:flex; gap:4px; padding:10px 12px; background:white; border-top:1px solid var(--line); }
        .navbtn { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:8px 0; font-size:10.5px; color:var(--muted); background:none; border:none; border-radius:12px; font-weight:600; }
        .navbtn.active { color:var(--brand-dark); background:var(--brand-light); }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th,td { text-align:left; padding:9px 10px; border-bottom:1px solid var(--line); }
        th { color:var(--muted); font-weight:700; font-size:11.5px; text-transform:uppercase; letter-spacing:.03em; }
        .tabbtn { padding:8px 14px; border-radius:12px; border:1.5px solid var(--line); background:white; font-size:13px; margin-right:8px; margin-bottom:6px; font-weight:600; color:var(--ink); }
        .tabbtn.active { background:var(--brand); color:white; border-color:var(--brand); }
        .misc-item { font-size:12.5px; color:#9A6414; background:var(--amber-light); padding:7px 11px; border-radius:10px; margin-top:6px; font-weight:600; }
        .inputwrap { position:relative; }
        .inputwrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted); }
        .inputwrap input { padding-left:36px; }
        .app-shell { display:flex; min-height:560px; }
        .sidebar { width:216px; flex-shrink:0; background:white; border-right:1px solid var(--line); padding:18px 14px; display:flex; flex-direction:column; }
        .sidebar-nav { display:flex; flex-direction:column; gap:3px; margin-top:18px; flex:1; }
        .sidebar-navbtn { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; border:none; background:none; color:var(--muted); font-size:13.5px; font-weight:600; text-align:left; width:100%; }
        .sidebar-navbtn.active { background:var(--brand-light); color:var(--brand-dark); }
        .sidebar-profile-card { display:flex; align-items:center; gap:10px; padding:10px; border-radius:14px; background:var(--paper-2); margin-top:auto; }
        .badge-card { border:1.5px solid var(--line); border-radius:16px; padding:16px; text-align:center; }
        .badge-card.earned { border-color:var(--amber); background:var(--amber-light); }
        .badge-card.locked { opacity:0.45; }
        .streak-chip { display:inline-flex; align-items:center; gap:5px; background:var(--amber-light); color:#9A6414; padding:5px 12px; border-radius:999px; font-size:12.5px; font-weight:700; }
        .xp-chip { display:inline-flex; align-items:center; gap:5px; background:var(--plum-light); color:var(--plum); padding:5px 12px; border-radius:999px; font-size:12.5px; font-weight:700; }
        @media (max-width:680px) {
          .app-shell { flex-direction:column; }
          .sidebar { width:100%; flex-direction:row; align-items:center; overflow-x:auto; padding:10px 12px; border-right:none; border-bottom:1px solid var(--line); }
          .sidebar-brand, .sidebar-profile-card { display:none; }
          .sidebar-nav { flex-direction:row; margin-top:0; gap:4px; }
          .sidebar-navbtn { flex-direction:column; gap:2px; font-size:10px; padding:8px 10px; white-space:nowrap; }
        }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
