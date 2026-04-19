const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3060;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public"), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  },
}));

// ── Knowledge Base Chunking ──

const knowledgeRaw = fs.readFileSync(
  path.join(__dirname, "knowledge.md"),
  "utf-8"
);

// Parse knowledge.md into sections by ## headers
function parseKnowledgeSections(raw) {
  const sections = [];
  const lines = raw.split("\n");
  let current = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { title: line.replace(/^## /, "").trim(), body: line + "\n" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections;
}

const knowledgeSections = parseKnowledgeSections(knowledgeRaw);

const CORE_TITLES = [
  "About Crystal PM",
  "Common Workflows",
  "Keyboard Shortcuts",
  "Support Resources",
];

const coreSections = knowledgeSections.filter((s) =>
  CORE_TITLES.some((t) => s.title.includes(t))
);

const searchableSections = knowledgeSections.filter(
  (s) => !CORE_TITLES.some((t) => s.title.includes(t))
);

const SYNONYMS = {
  schedule: ["appointment", "booking", "book", "calendar", "slot"],
  appointment: ["schedule", "booking", "book", "slot", "appt"],
  billing: ["invoice", "charge", "payment", "bill", "pay", "fee", "price", "cost"],
  claim: ["insurance", "denial", "denied", "reject", "rejection", "eob", "remit", "835"],
  denial: ["denied", "reject", "rejection", "claim"],
  insurance: ["claim", "vsp", "eyemed", "payer", "coverage", "eligibility", "auth"],
  patient: ["record", "chart", "demographics", "account"],
  inventory: ["stock", "frame", "lens", "barcode", "rfid", "reorder"],
  frame: ["glasses", "eyeglass", "spectacle", "optical", "inventory"],
  contact: ["cl", "lens", "fitting", "scleral"],
  ehr: ["chart", "template", "exam", "record", "clinical", "diagnosis", "icd", "cpt"],
  recall: ["reminder", "follow-up", "followup", "recare"],
  refund: ["credit", "void", "return", "takeback", "adjustment"],
  print: ["printer", "printing", "label", "scanner", "scan"],
  hardware: ["scanner", "printer", "signature", "pad", "label", "device"],
  error: ["bug", "crash", "freeze", "slow", "oops", "broken", "fix", "issue", "problem"],
  report: ["reports", "end-of-day", "eod", "balance", "reconcil", "cash"],
  portal: ["kiosk", "online", "form", "check-in", "checkin"],
  prescri: ["rx", "erx", "eprescri", "medication", "drug"],
  text: ["sms", "communicator", "message", "notify", "notification"],
  multi: ["location", "office", "branch", "site"],
  security: ["permission", "access", "hipaa", "password", "employee", "user", "role"],
  update: ["version", "upgrade", "changelog", "new feature"],
  backup: ["database", "maintenance", "cloud", "restore"],
  mips: ["quality", "reporting", "aoa", "qpp", "compliance"],
  vsp: ["integration", "catalog", "eob"],
  payment: ["credit card", "worldpay", "tsys", "clover", "processor"],
};

function expandQuery(query) {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const expanded = new Set(words);
  for (const word of words) {
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (word.includes(key) || key.includes(word)) {
        syns.forEach((s) => expanded.add(s));
        expanded.add(key);
      }
      if (syns.some((s) => word.includes(s) || s.includes(word))) {
        expanded.add(key);
        syns.forEach((s) => expanded.add(s));
      }
    }
  }
  return expanded;
}

function matchSections(query) {
  const keywords = expandQuery(query);
  const scored = searchableSections.map((section) => {
    const haystack = (section.title + " " + section.body).toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (section.title.toLowerCase().includes(kw)) score += 3;
      const bodyMatches = (haystack.match(new RegExp(kw, "g")) || []).length;
      score += Math.min(bodyMatches, 5);
    }
    return { section, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.section);
}

// ── System Prompt ──

const STATIC_INSTRUCTIONS = `You are the Crystal PM Assistant — a focused, professional support agent built for the staff at Chapel Hills Vision Clinic (CHVC) in Colorado Springs, CO.

About CHVC:
- Location: 2438 Research Pkwy, Suite 200, Colorado Springs, CO 80920
- Phone: (719) 599-5083
- Hours: Mon-Fri 7:30am-5:30pm, Sat 8:00am-12:00pm, Sun Closed
- Active doctors: Dr. Cynthia Cid, OD | Dr. Shane Frerichs, OD | Dr. Yubisela Toledo, OD
- 35+ years serving Colorado Springs
- Services: comprehensive eye exams, contact lens fittings (including specialty/scleral), glaucoma/cataract/macular degeneration screening, dry eye treatment, IPL therapy, surgical co-management, 1500+ designer frames
- Retired doctors: Dr. Joanne Hendrick, OD | Dr. David Guhl, OD

You answer questions about Crystal Practice Management software (Crystal PM) — the optometry practice management and POS system CHVC uses daily.

Your role:
- Help CHVC staff with Crystal PM features, workflows, troubleshooting, and best practices
- Provide clear, step-by-step instructions when explaining how to do something
- Be concise and professional — this is a work tool, not a casual chat
- When relevant, contextualize answers to an optometry practice environment

Handling vague questions:
- If a staff member asks a question that IS related to vision/optometry/practice management but is too vague or broad to give a useful answer, ask a brief clarifying question to narrow it down.
- Keep the clarifying question short (one sentence) and offer 2-3 specific options when possible so they can just pick one.
- If the question is specific enough to answer, just answer it — don't over-ask.

Strict boundaries:
- ONLY answer questions related to Crystal PM, optometry practice management workflows, or closely related operational topics
- You may answer basic questions about CHVC itself (hours, doctors, location, services) since staff sometimes need this info
- If someone asks about something unrelated, politely redirect: "I'm here to help with Crystal PM and practice management questions. What can I help you with?"
- Do not engage in small talk, personal advice, general knowledge questions, or any off-topic conversation
- Do not make up features that don't exist — if you're unsure, say so and suggest contacting Crystal PM support at (800) 308-7169, Option 1 or support@crystalpm.com

When answering:
- Reference specific Crystal PM features, menu paths, and keyboard shortcuts when possible
- Use numbered steps for procedural answers
- For claim denial questions, include the denial code meaning AND specific fix steps
- Keep responses focused and actionable
- Use markdown formatting: ## for headers, **bold** for emphasis, numbered lists for steps`;

const coreKnowledge = coreSections.map((s) => s.body).join("\n---\n");

// ── Gemini Client ──

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const conversations = new Map();

setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [key, conv] of conversations) {
    if (conv.lastActive < oneHourAgo) {
      conversations.delete(key);
    }
  }
}, 60 * 60 * 1000);

app.post("/api/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, { messages: [], lastActive: Date.now() });
  }
  const conv = conversations.get(sessionId);
  conv.lastActive = Date.now();
  conv.messages.push({ role: "user", content: message.trim() });

  if (conv.messages.length > 20) {
    conv.messages = conv.messages.slice(-20);
  }

  const matched = matchSections(message);
  let dynamicKnowledge = "";
  if (matched.length > 0) {
    dynamicKnowledge = matched.map((s) => s.body).join("\n---\n");
  } else {
    dynamicKnowledge = knowledgeRaw;
  }

  try {
    const systemInstruction =
      STATIC_INSTRUCTIONS +
      "\n\n## Core Reference\n" +
      coreKnowledge +
      "\n\n## Relevant Knowledge Sections\n\n" +
      dynamicKnowledge;

    const history = conv.messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      history,
      config: {
        systemInstruction,
        maxOutputTokens: 1024,
      },
    });

    const result = await chat.sendMessage({ message: message.trim() });
    const assistantMessage = result.text;

    conv.messages.push({ role: "assistant", content: assistantMessage });

    const usage = result.usageMetadata;
    console.log(
      `[chat] session=${sessionId.slice(0, 8)} input=${usage?.promptTokenCount || "?"} output=${usage?.candidatesTokenCount || "?"} sections=${matched.length || "full"}`
    );

    res.json({ response: assistantMessage });
  } catch (err) {
    console.error("Gemini API error:", err.message, err.status || "");
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CHVC Crystal Assistant running on port ${PORT}`);
  console.log(`Knowledge base: ${knowledgeSections.length} sections parsed, ${coreSections.length} core, ${searchableSections.length} searchable`);
});
