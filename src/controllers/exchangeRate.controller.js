import prisma from "../db.js";

const OFFICIAL_RATE_TTL_MS = 5 * 60 * 1000;
let officialRateCache = null;

export async function createExchangeRate(req, res) {
  const { rateVESPerUSD, commissionPercent = 0, notes, date } = req.body;

  const exchangeRate = await prisma.exchangeRate.create({
    data: {
      rateVESPerUSD: Number(rateVESPerUSD),
      commissionPercent: Number(commissionPercent),
      notes: notes ?? null,
      date: date ? new Date(date) : new Date(),
    },
  });

  res.status(201).json({ exchangeRate });
}

export async function listExchangeRates(req, res) {
  const exchangeRates = await prisma.exchangeRate.findMany({
    orderBy: { date: "desc" },
  });
  res.json({ exchangeRates });
}

export async function getOfficialRate(req, res) {
  const apiUrl = process.env.OFFICIAL_RATE_API_URL;
  if (!apiUrl) {
    return res.json({ ok: false, error: "OFFICIAL_RATE_API_URL no configurada" });
  }

  const now = Date.now();
  if (officialRateCache && now - officialRateCache.fetchedAt < OFFICIAL_RATE_TTL_MS) {
    return res.json({ ok: true, ...officialRateCache.data });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(apiUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const officialRateVESPerUSD = Number(data?.promedios?.USD?.promedio);

    if (!Number.isFinite(officialRateVESPerUSD) || officialRateVESPerUSD <= 0) {
      throw new Error("Respuesta inválida de la API");
    }

    const payload = {
      officialRateVESPerUSD,
      updatedAt: data?.actualizado ?? null,
    };
    officialRateCache = { fetchedAt: now, data: payload };
    return res.json({ ok: true, ...payload });
  } catch {
    return res.json({ ok: false, error: "No se pudo consultar la tasa oficial" });
  } finally {
    clearTimeout(timeout);
  }
}
