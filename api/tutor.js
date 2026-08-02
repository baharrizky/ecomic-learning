// Vercel Serverless Function — proxy ke Google Gemini API supaya API key
// tidak pernah terekspos ke browser. Wajib set GEMINI_API_KEY di Vercel
// (Project Settings -> Environment Variables) dan juga di .env.local
// untuk pengetesan lokal.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { message, context, history } = req.body || {};
  if (!message || !message.trim()) {
    res.status(400).json({ error: "Pesan tidak boleh kosong." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY belum di-set di server." });
    return;
  }

  // Gemini pakai format contents dengan role "user"/"model" (bukan "assistant")
  const contents = [
    ...((history || []).slice(-8).map((h) => ({
      role: h.role === "ai" ? "model" : "user",
      parts: [{ text: h.text }],
    }))),
    { role: "user", parts: [{ text: message }] },
  ];

  const systemInstruction = {
    parts: [{
      text:
        "Kamu adalah tutor matematika yang ramah dan sabar untuk siswa SMP/SMA di Indonesia. " +
        "Konteks materi yang sedang dipelajari siswa: " + (context || "materi yang sedang dibaca") + ". " +
        "Jawab dalam Bahasa Indonesia, singkat dan jelas. Jangan langsung memberi jawaban akhir dari soal — " +
        "bimbing siswa berpikir langkah demi langkah, ajukan pertanyaan balik bila perlu. " +
        "PENTING: jangan gunakan format markdown seperti tanda bintang ganda (**) untuk cetak tebal, garis bawah, atau simbol markdown lainnya — tulis dengan teks biasa saja karena akan ditampilkan apa adanya.",
    }],
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction,
          // Tanpa batas maxOutputTokens - Gemini akan pakai batas maksimal modelnya sendiri
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: "Gagal menghubungi AI: " + errText.slice(0, 200) });
      return;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim();
    res.status(200).json({ reply: text || "Maaf, aku belum bisa menjawab itu. Coba tanya dengan cara lain ya." });
  } catch (e) {
    res.status(500).json({ error: "Terjadi kesalahan menghubungi server AI." });
  }
}