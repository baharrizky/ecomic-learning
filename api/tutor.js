// Vercel Serverless Function — proxy ke Anthropic API supaya API key tidak
// pernah terekspos ke browser. Wajib set ANTHROPIC_API_KEY di Vercel
// (Project Settings -> Environment Variables) dan juga di file .env.local
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY belum di-set di server." });
    return;
  }

  const messages = [
    ...((history || []).slice(-8).map((h) => ({ role: h.role === "ai" ? "assistant" : "user", content: h.text }))),
    { role: "user", content: message },
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system:
          "Kamu adalah tutor matematika yang ramah dan sabar untuk siswa SMP/SMA di Indonesia. " +
          "Konteks materi yang sedang dipelajari siswa: " + (context || "materi yang sedang dibaca") + ". " +
          "Jawab dalam Bahasa Indonesia, singkat dan jelas. Jangan langsung memberi jawaban akhir dari soal — " +
          "bimbing siswa berpikir langkah demi langkah, ajukan pertanyaan balik bila perlu.",
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: "Gagal menghubungi AI: " + errText.slice(0, 200) });
      return;
    }

    const data = await response.json();
    const text = (data.content || []).map((b) => b.text || "").join("\n").trim();
    res.status(200).json({ reply: text || "Maaf, aku belum bisa menjawab itu. Coba tanya dengan cara lain ya." });
  } catch (e) {
    res.status(500).json({ error: "Terjadi kesalahan menghubungi server AI." });
  }
}