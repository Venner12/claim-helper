const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || (process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const CLAIM_COOLDOWN_MS = Number(
  process.env.CLAIM_COOLDOWN_MS || process.env.COMMENT_COOLDOWN_MS || 60 * 60 * 1000
);
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, "data");
const DATA_FILE = process.env.DATA_FILE || path.join(DATA_DIR, "store.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const TYPES = new Set(["comments", "youtubeLinks", "tiktokLinks"]);
const CLAIM_TYPES = {
  comment: {
    storeKey: "comments",
    emptyMessage: "No comments are available right now.",
    limitedMessage: "You already got a comment recently."
  },
  youtube: {
    storeKey: "youtubeLinks",
    emptyMessage: "No YouTube links are available right now.",
    limitedMessage: "You already got a YouTube link recently."
  },
  tiktok: {
    storeKey: "tiktokLinks",
    emptyMessage: "No TikTok links are available right now.",
    limitedMessage: "You already got a TikTok link recently."
  }
};

let writeQueue = Promise.resolve();

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await writeStore({
      comments: [
        createItem("Love this, thanks for sharing!"),
        createItem("This was super helpful."),
        createItem("Great video. Keep going!")
      ],
      youtubeLinks: [],
      tiktokLinks: [],
      logs: []
    });
  }
}

function createItem(value) {
  return {
    id: crypto.randomUUID(),
    value: String(value).trim(),
    claimedAt: null
  };
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeStore(store) {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
  });
  return writeQueue;
}

async function updateStore(updater) {
  await ensureStore();
  writeQueue = writeQueue.then(async () => {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const store = JSON.parse(raw);
    const result = await updater(store);
    await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
    return result;
  });
  return writeQueue;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendCsv(res, filename, text) {
  res.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`,
    "content-length": Buffer.byteLength(text)
  });
  res.end(text);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function isAdmin(req) {
  if (!ADMIN_PASSWORD) return true;
  return req.headers["x-admin-password"] === ADMIN_PASSWORD;
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  sendJson(res, 401, { error: "Admin password required." });
  return false;
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket.remoteAddress || "unknown";
}

function findRecentClaim(store, type, ip, now) {
  return store.logs.find((log) => {
    if (log.type !== type || log.ip !== ip || !log.claimedAt) return false;
    return now - new Date(log.claimedAt).getTime() < CLAIM_COOLDOWN_MS;
  });
}

function formatWaitTime(milliseconds) {
  const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60000));
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours} hour${hours === 1 ? "" : "s"}`;

  return `${hours} hour${hours === 1 ? "" : "s"} and ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function cleanValues(values) {
  return values
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function normalizedValue(value) {
  return value.trim().toLowerCase();
}

function csvCell(value) {
  const text = String(value || "");
  return `"${text.replaceAll('"', '""')}"`;
}

function logsToCsv(logs) {
  const header = ["claimedAt", "type", "value", "ip", "userAgent", "itemId", "id"];
  const rows = logs.map((log) => {
    return header.map((key) => csvCell(log[key])).join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

function countsFor(store, key) {
  const items = store[key] || [];
  const used = items.filter((item) => item.claimedAt).length;
  return {
    total: items.length,
    used,
    available: items.length - used
  };
}

function claimNext(store, req, type) {
  const claimType = CLAIM_TYPES[type];
  const ip = getClientIp(req);
  const now = Date.now();
  const recentClaim = findRecentClaim(store, type, ip, now);

  if (recentClaim) {
    const waitMs = CLAIM_COOLDOWN_MS - (now - new Date(recentClaim.claimedAt).getTime());
    return {
      limited: true,
      waitMs,
      message: `${claimType.limitedMessage} Please try again in ${formatWaitTime(waitMs)}.`
    };
  }

  const item = store[claimType.storeKey].find((entry) => !entry.claimedAt);
  if (!item) return null;

  const claimedAt = new Date().toISOString();
  item.claimedAt = claimedAt;

  const log = {
    id: crypto.randomUUID(),
    type,
    itemId: item.id,
    value: item.value,
    claimedAt,
    ip,
    userAgent: req.headers["user-agent"] || "unknown"
  };
  store.logs.unshift(log);

  return { id: item.id, value: item.value, claimedAt };
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/status") {
    const store = await readStore();
    sendJson(res, 200, {
      comments: countsFor(store, "comments"),
      youtubeLinks: countsFor(store, "youtubeLinks"),
      tiktokLinks: countsFor(store, "tiktokLinks")
    });
    return;
  }

  if (req.method === "POST" && pathname.startsWith("/api/claim/")) {
    const type = pathname.replace("/api/claim/", "");
    const claimType = CLAIM_TYPES[type];

    if (!claimType) {
      sendJson(res, 404, { error: "Not found." });
      return;
    }

    const claim = await updateStore((store) => {
      return claimNext(store, req, type);
    });

    if (!claim) {
      sendJson(res, 404, { error: claimType.emptyMessage });
      return;
    }

    if (claim.limited) {
      sendJson(res, 429, {
        error: claim.message,
        waitMs: claim.waitMs
      });
      return;
    }

    sendJson(res, 200, claim);
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/store") {
    if (!requireAdmin(req, res)) return;
    const store = await readStore();
    sendJson(res, 200, store);
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/export/logs.csv") {
    if (!requireAdmin(req, res)) return;
    const store = await readStore();
    sendCsv(res, "claim-log.csv", logsToCsv(store.logs));
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/replace") {
    if (!requireAdmin(req, res)) return;
    const body = await readJsonBody(req);
    const type = body.type;
    const values = Array.isArray(body.values) ? body.values : [];

    if (!TYPES.has(type)) {
      sendJson(res, 400, { error: "Invalid list type." });
      return;
    }

    const cleanItems = cleanValues(values);

    const store = await updateStore((current) => {
      current[type] = cleanItems.map(createItem);
      return current;
    });

    sendJson(res, 200, {
      ok: true,
      type,
      count: store[type].length
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/add") {
    if (!requireAdmin(req, res)) return;
    const body = await readJsonBody(req);
    const type = body.type;
    const values = Array.isArray(body.values) ? body.values : [];

    if (!TYPES.has(type)) {
      sendJson(res, 400, { error: "Invalid list type." });
      return;
    }

    const cleanItems = cleanValues(values);

    const addResult = await updateStore((current) => {
      const existing = new Set(current[type].map((item) => normalizedValue(item.value)));
      const toAdd = [];
      let skippedDuplicates = 0;

      cleanItems.forEach((value) => {
        const normalized = normalizedValue(value);
        if (existing.has(normalized)) {
          skippedDuplicates += 1;
          return;
        }

        existing.add(normalized);
        toAdd.push(value);
      });

      current[type].push(...toAdd.map(createItem));
      return {
        added: toAdd.length,
        skippedDuplicates,
        count: current[type].length
      };
    });

    sendJson(res, 200, {
      ok: true,
      type,
      ...addResult
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/clear-used") {
    if (!requireAdmin(req, res)) return;
    const body = await readJsonBody(req);
    const type = body.type;

    if (!TYPES.has(type)) {
      sendJson(res, 400, { error: "Invalid list type." });
      return;
    }

    const result = await updateStore((current) => {
      const before = current[type].length;
      current[type] = current[type].filter((item) => !item.claimedAt);
      return {
        removed: before - current[type].length,
        count: current[type].length
      };
    });

    sendJson(res, 200, {
      ok: true,
      type,
      ...result
    });
    return;
  }

  sendJson(res, 404, { error: "Not found." });
}

async function serveStatic(res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, { "content-type": contentTypes[ext] || "application/octet-stream" });
    res.end(file);
  } catch {
    sendText(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }

    await serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Something went wrong." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Claim app running at http://${HOST}:${PORT}`);
});
