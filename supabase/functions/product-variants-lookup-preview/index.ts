import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS, "Content-Type": "application/json" }
});
const ALLOWED = [
  "cssb.uy", "www.cssb.uy", "cssbuy.com", "www.cssbuy.com", "m.cssbuy.com",
  "1688.com", "www.1688.com", "detail.1688.com", "m.1688.com",
  "weidian.com", "www.weidian.com", "k.weidian.com", "v.weidian.com"
];
function validHost(host: string) {
  const h = host.toLowerCase();
  return ALLOWED.includes(h) || h.endsWith(".1688.com") || h.endsWith(".weidian.com");
}
function price(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.replace(/[^0-9.]/g, "")) : Number(value);
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}
function cleanUrl(value: string) {
  const u = new URL(value);
  if (u.protocol !== "https:" || !validHost(u.hostname)) throw new Error("Use um link HTTPS do CSSBuy, 1688 ou Weidian.");
  return u.toString();
}
function parseSkuAttrs(sku: any): Record<string, string> {
  const raw = sku?.attrs ?? sku?.attributes ?? sku?.specs ?? sku?.properties ?? sku?.properties_name ?? sku?.sku_name ?? sku?.skuName ?? sku?.name ?? sku?.label ?? sku?.spec;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [String(k), String(v)]));
  }
  if (typeof raw === "string") {
    const parsed: Record<string, string> = {};
    for (const part of raw.split(/[;；|,，]/)) {
      const match = part.match(/^\s*([^:：=]+)\s*[:：=]\s*(.+?)\s*$/);
      if (match) parsed[match[1].trim()] = match[2].trim();
    }
    if (Object.keys(parsed).length) return parsed;
    if (raw.trim()) return { "Variação": raw.trim() };
  }
  return {};
}

function normalizeImage(value: unknown, depth = 0): string | null {
  if (depth > 3 || value == null) return null;
  if (typeof value === "string") {
    let image = value.trim().replaceAll("\\/", "/").replace(/&amp;/gi, "&");
    if (image.startsWith("//")) image = "https:" + image;
    if (image.startsWith("http://")) image = "https://" + image.slice(7);
    if (/^https:\/\//i.test(image) && /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(image)) return image;
    if (/^https:\/\//i.test(image) && /(alicdn|1688|taobaocdn|weidian|img|image|photo)/i.test(image)) return image;
    return null;
  }
  if (Array.isArray(value)) { for (const item of value) { const found=normalizeImage(item,depth+1); if(found)return found; } return null; }
  if (typeof value === "object") {
    const obj=value as Record<string,unknown>;
    for (const key of ["url","image_url","imageUrl","img_url","imgUrl","fullPathImageURI","imageURI","image","img","src","pic","picUrl","preview","origin"]) {
      const found=normalizeImage(obj[key],depth+1); if(found)return found;
    }
  }
  return null;
}
function normalizeImageList(value: unknown): string[] {
  const list=Array.isArray(value)?value:value==null?[]:[value];
  return [...new Set(list.map(item=>normalizeImage(item)).filter((v):v is string=>!!v))];
}
function normalizeOptionImages(value: unknown): Record<string,string> {
  if(!value||typeof value!=="object"||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,val])=>[key,normalizeImage(val)]).filter((entry):entry is [string,string]=>!!entry[1]));
}

function collectImageUrls(value: unknown, depth = 0, keyHint = ""): string[] {
  if (depth > 9 || value == null) return [];
  if (typeof value === "string") {
    const normalized = normalizeImage(value);
    if (!normalized) return [];
    const imageLikeKey = /(image|img|pic|photo|gallery|sku|picture|thumb|mainpic)/i.test(keyHint);
    const imageLikeUrl = /(alicdn|taobaocdn|weidian)/i.test(normalized) ||
      ["/img/", "/image/", "/images/", "/photo/", "/photos/"].some(part => normalized.toLowerCase().includes(part)) ||
      /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(normalized);
    return imageLikeKey || imageLikeUrl ? [normalized] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item) => collectImageUrls(item, depth + 1, keyHint));
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => collectImageUrls(item, depth + 1, key));
  }
  return [];
}
function optionValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && !Array.isArray(value)) {
    const item = value as Record<string, unknown>;
    return String(item.value ?? item.name ?? item.label ?? item.title ?? item.text ?? "").trim();
  }
  return String(value).trim();
}
function optionValues(option: any): string[] {
  const raw = option?.values ?? option?.value_list ?? option?.valueList ?? option?.items ?? option?.choices ?? option?.options ?? option?.values_cn ?? [];
  const list = Array.isArray(raw) ? raw : raw == null || raw === "" ? [] : [raw];
  return [...new Set(list.map(optionValue).filter(Boolean))];
}
function imagesFromHtml(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const found: string[] = [];
  const decoded = value.replaceAll("\\/", "/").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"');
  for (const match of decoded.matchAll(/(?:src|data-src)\s*=\s*['"]([^'"]+)['"]/gi)) {
    let image = match[1].trim();
    if (image.startsWith("//")) image = "https:" + image;
    if (image.startsWith("http://")) image = "https://" + image.slice(7);
    if (/^https:\/\//i.test(image)) found.push(image);
  }
  return found;
}
async function resolveCssbuyShortUrl(inputUrl: string): Promise<string> {
  const input = new URL(inputUrl);
  if (!["cssb.uy", "www.cssb.uy"].includes(input.hostname.toLowerCase())) return inputUrl;
  try {
    const response = await fetch(inputUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000)
    });
    const finalUrl = response.url;
    const cssbuyHosts = ["cssbuy.com", "www.cssbuy.com", "m.cssbuy.com"];
    if (finalUrl) {
      const final = new URL(finalUrl);
      if (cssbuyHosts.includes(final.hostname.toLowerCase()) && final.searchParams.get("type") && (final.searchParams.get("id") || final.searchParams.get("itemId"))) return final.toString();
    }
    const html = await response.text();
    const decoded = html.replaceAll("&amp;", "&").replaceAll("\\u0026", "&").replaceAll("\\/", "/");
    const candidates = decoded.split(/["']/).filter(part => part.includes("goodsDetail"));
    for (const candidate of candidates) {
      try {
        const resolved = new URL(candidate.startsWith("//") ? "https:" + candidate : candidate, finalUrl || inputUrl);
        if (cssbuyHosts.includes(resolved.hostname.toLowerCase()) && resolved.searchParams.get("type") && (resolved.searchParams.get("id") || resolved.searchParams.get("itemId"))) return resolved.toString();
      } catch { /* Ignore invalid redirect targets. */ }
    }
    if (finalUrl && cssbuyHosts.includes(new URL(finalUrl).hostname.toLowerCase())) return finalUrl;
  } catch (error) {
    console.warn("CSSBuy short-link resolution failed", String(error).slice(0, 180));
  }
  return inputUrl;
}


async function resolveCssbuy1688Url(inputUrl: string): Promise<string> {
  const u = new URL(inputUrl);
  if (!["cssbuy.com", "www.cssbuy.com", "m.cssbuy.com"].includes(u.hostname.toLowerCase())) return inputUrl;
  if ((u.searchParams.get("type") || "").toLowerCase() !== "1688") return inputUrl;
  const id = u.searchParams.get("id") || u.searchParams.get("itemId") || "";
  if (/^[0-9]{10,20}$/.test(id)) return `https://detail.1688.com/offer/${id}.html`;

  // CSSBuy's expanded product URL can carry the original 1688 ID as a
  // bare query parameter, e.g. &item-1688-1036868838780.html&id=<opaque>.
  // Read this before making any upstream request; the opaque CSSBuy ID alone
  // is not enough for RepsAPI to identify the 1688 listing.
  const embeddedOffer = (u.href.replaceAll("&amp;", "&").match(/(?:[?&])item-1688-([0-9]{10,20})[.]html(?:[&=#]|$)/i) || [])[1];
  if (embeddedOffer) {
    console.log("Recovered 1688 offer ID from CSSBuy URL", { recovered: true });
    return `https://detail.1688.com/offer/${embeddedOffer}.html`;
  }

  const extractOffer = (value: string) => {
    const candidates: string[] = [value];
    const visit = (node: any, depth = 0) => {
      if (depth > 12 || node == null) return;
      if (typeof node === "string") {
        candidates.push(node);
        const trimmed = node.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try { visit(JSON.parse(trimmed), depth + 1); } catch { /* not nested JSON */ }
        }
        return;
      }
      if (Array.isArray(node)) { for (const item of node) visit(item, depth + 1); return; }
      if (typeof node === "object") for (const item of Object.values(node)) visit(item, depth + 1);
    };
    try { visit(JSON.parse(value)); } catch { /* scan raw response */ }
    for (const candidate of candidates) {
      const normalized = candidate
        .replaceAll("\\\\/", "/")
        .replaceAll("\\\\\\\\/", "/")
        .replaceAll("\\\\u002F", "/")
        .replaceAll("&amp;", "&");
      const match = normalized.match(/detail[.]1688[.]com[/\\\\]+offer[/\\\\]+([0-9]{10,20})/i);
      if (match?.[1]) return match[1];
      const fieldMatch = normalized.match(/(?:offerId|offer_id|sourceItemId|source_item_id|originItemId|origin_item_id|goodsId|goods_id)["' :=]+([0-9]{10,20})/i);
      if (fieldMatch?.[1]) return fieldMatch[1];
    }
    return null;
  };
  try {
    const page = await fetch(inputUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Accept": "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
    const html = await page.text();
    const scriptUrls = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(match => {
      try { return new URL(match[1], page.url || inputUrl).toString(); } catch { return null; }
    }).filter((value): value is string => !!value).slice(0, 12);
    const assetDiagnostics: Array<{ host: string; urlPath: string; matches: string[] }> = [];
    for (const scriptUrl of scriptUrls.slice(0, 8)) {
      try {
        const asset = await fetch(scriptUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" },
          signal: AbortSignal.timeout(10000)
        });
        if (!asset.ok) continue;
        const js = await asset.text();
        const terms = ["goodsDetail", "api/v2/item", "itemDetail", "productDetail", "goods/detail", "offerId", "sourceItemId", "getProductDetail", "/v2/user/item", "baseURL", "baseUrl", "api.cssbuy", "VITE_APP", "axios.create"];
        const matches: string[] = [];
        for (const term of terms) {
          let from = 0;
          let count = 0;
          while (count < (term === "getProductDetail" || term === "/v2/user/item" ? 12 : 1)) {
            const at = js.toLowerCase().indexOf(term.toLowerCase(), from);
            if (at < 0) break;
            matches.push(term + " @" + at + ": " + js.slice(Math.max(0, at - 320), Math.min(js.length, at + term.length + 520)).slice(0, 900));
            from = at + term.length;
            count++;
          }
        }
        assetDiagnostics.push({ host: new URL(scriptUrl).hostname, urlPath: new URL(scriptUrl).pathname, matches: matches.slice(0, 24) });
      } catch { /* Asset diagnostics are best-effort only. */ }
    }
    console.log("CSSBuy opaque-ID asset diagnostics", { scriptCount: scriptUrls.length, assets: assetDiagnostics });
    console.log("CSSBuy opaque-ID page diagnostics", {
      pageStatus: page.status,
      finalHost: page.url ? new URL(page.url).hostname : null,
      htmlLength: html.length,
      hasOfferIdField: /offerId|offer_id|sourceItemId|originItemId/i.test(html),
      has1688Url: /detail[.]1688[.]com/i.test(html),
      sample: html.slice(0, 700)
    });
    const offerId = extractOffer(html);
    if (offerId) {
      console.log("Recovered 1688 offer ID from CSSBuy page", { recovered: true });
      return `https://detail.1688.com/offer/${offerId}.html`;
    }
  } catch (error) {
    console.warn("CSSBuy page source-ID lookup failed", String(error).slice(0, 160));
  }
  try {
    const response = await fetch("https://www.cssbuy.com/api/v2/user/item", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.cssbuy.com",
        "Referer": inputUrl,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "toJson": "true",
        "Lang": "en",
        "Device-Id": "",
        "Kb-referer": inputUrl
      },
      body: new URLSearchParams({ type: "1688", itemId: id, lang: "en" }).toString(),
      signal: AbortSignal.timeout(15000)
    });
    const raw = await response.text();
    console.log("CSSBuy v2 user item diagnostics", {
      apiStatus: response.status,
      responseLength: raw.length,
      contentType: response.headers.get("content-type"),
      responseSample: raw.slice(0, 1200)
    });
    const offerId = extractOffer(raw);
    if (response.ok && offerId) {
      console.log("Recovered 1688 offer ID from CSSBuy v2 user item", { apiStatus: response.status, recovered: true });
      return `https://detail.1688.com/offer/${offerId}.html`;
    }
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch { /* non-JSON response */ }
    if (response.ok && parsed?.data) {
      const item = Array.isArray(parsed.data) ? parsed.data[0] : parsed.data;
      const possibleId = String(item?.offerId ?? item?.offer_id ?? item?.sourceItemId ?? item?.source_item_id ?? item?.goodsId ?? item?.goods_id ?? "");
      if (/^[0-9]{10,20}$/.test(possibleId)) {
        console.log("Recovered 1688 offer ID from CSSBuy v2 item fields", { recovered: true });
        return `https://detail.1688.com/offer/${possibleId}.html`;
      }
    }
    console.warn("CSSBuy v2 user item did not return a recoverable 1688 ID", { apiStatus: response.status });
  } catch (error) {
    console.warn("CSSBuy v2 user item lookup failed", String(error).slice(0, 180));
  }
  return inputUrl;
}


async function resolveCssbuyWeidianUrl(inputUrl: string, lookupCache: { attempted?: boolean; payload?: any } = {}): Promise<string> {
  const u = new URL(inputUrl);
  if (!["cssbuy.com", "www.cssbuy.com", "m.cssbuy.com"].includes(u.hostname.toLowerCase())) return inputUrl;
  if (!["weidian", "micro"].includes((u.searchParams.get("type") || "").toLowerCase())) return inputUrl;
  const opaqueId = u.searchParams.get("id") || u.searchParams.get("itemId") || "";
  if (/^\d{5,20}$/.test(opaqueId)) return "https://weidian.com/item.html?itemID=" + opaqueId;

  // Expanded CSSBuy Weidian links can include the real marketplace ID as a
  // bare query parameter: &item-micro-7826217594.html&id=<opaque CSSBuy ID>.
  // Prefer this public numeric source ID and avoid CSSBuy's login-only resolver.
  const embeddedMicro = (u.href.replaceAll("&amp;", "&").match(/(?:[?&])item-micro-([0-9]{5,20})[.]html(?:[&=#]|$)/i) || [])[1];
  if (embeddedMicro) {
    console.log("Recovered Weidian ID from CSSBuy URL", { recovered: true });
    return "https://weidian.com/item.html?itemID=" + embeddedMicro;
  }

  const extractOriginalId = (value: string) => {
    const normalized = value.replace(/\\+/g, "").replaceAll("\\u002F", "/").replaceAll("&amp;", "&").replaceAll("\\/", "/");
    const patterns = [
      /(?:m\.)?cssbuy\.com[/]item-micro-([0-9]{5,20})[.]html/i,
      /weidian\.com[/][^"'\s<>]*[?&]itemID=([0-9]{5,20})/i,
      /(?:sourceItemId|source_item_id|originItemId|origin_item_id|microItemId|micro_item_id|itemId|item_id|productId|product_id|goodsId|goods_id)["' :=]+([0-9]{5,20})/i
    ];
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  };

  try {
    const page = await fetch(inputUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Accept": "text/html,application/xhtml+xml,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
    const html = await page.text();
    const originalId = extractOriginalId(html);
    if (originalId) {
      console.log("Recovered Weidian ID from CSSBuy detail page", { recovered: true });
      return "https://weidian.com/item.html?itemID=" + originalId;
    }
  } catch (error) {
    console.warn("CSSBuy Weidian page ID lookup failed", String(error).slice(0, 160));
  }

  try {
    lookupCache.attempted = true;
    const response = await fetch("https://www.cssbuy.com/api/v2/item", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.cssbuy.com",
        "Referer": inputUrl,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "toJson": "true",
        "Lang": "en",
        "Device-Id": "",
        "Kb-referer": inputUrl
      },
      body: new URLSearchParams({ type: "micro", itemId: opaqueId, lang: "en" }).toString(),
      signal: AbortSignal.timeout(15000)
    });
    const raw = await response.text();
    try { lookupCache.payload = JSON.parse(raw); } catch { lookupCache.payload = null; }
    const originalId = extractOriginalId(raw);
    if (response.ok && originalId) {
      console.log("Recovered Weidian ID from CSSBuy item API", { apiStatus: response.status, recovered: true });
      return "https://weidian.com/item.html?itemID=" + originalId;
    }
    console.warn("CSSBuy Weidian opaque ID unresolved", {
      apiStatus: response.status, responseLength: raw.length,
      contentType: response.headers.get("content-type"),
      responseSample: raw.slice(0, 700),
      hasItemMicroPath: /item-micro-\d+[.]html/i.test(raw),
      hasWeidianItemUrl: /weidian\.com.{0,100}itemID/i.test(raw)
    });
  } catch (error) {
    console.warn("CSSBuy Weidian item API lookup failed", String(error).slice(0, 160));
  }
  return inputUrl;
}
async function lookupCssbuy(url: URL, lookupCache?: { attempted?: boolean; payload?: any }) {
  const type = (url.searchParams.get("type") || "").toLowerCase();
  const itemId = url.searchParams.get("itemId") || url.searchParams.get("item_id") || url.searchParams.get("id") || "";
  if (!itemId || !/^[a-z0-9_-]{6,100}$/i.test(itemId) || !["1688", "micro", "weidian", "taobao"].includes(type)) return null;
  let payload: any = lookupCache?.payload ?? null;
  if (!lookupCache?.attempted) {
    const response = await fetch("https://www.cssbuy.com/api/v2/item", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.cssbuy.com",
        "Referer": "https://www.cssbuy.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "toJson": "true",
        "Lang": "en",
        "Device-Id": "",
        "Kb-referer": "https://www.cssbuy.com/"
      },
      body: new URLSearchParams({ type: type === "weidian" ? "micro" : type, itemId, lang: "en" }).toString(),
      signal: AbortSignal.timeout(20000)
    });
    const raw = await response.text();
    try { payload = JSON.parse(raw); } catch { return null; }
  }
  if (!response.ok || !payload || (payload.code !== undefined && Number(payload.code) !== 0)) return null;
  const item = Array.isArray(payload.data) ? payload.data[0] : payload.data;
  if (!item || (item.status && String(item.status) !== "200")) return null;
  const rawSkus = Array.isArray(item?.skus?.sku) ? item.skus.sku : Array.isArray(item?.skus) ? item.skus : [];
  const skus = rawSkus.map((sku: any) => ({
    attrs: parseSkuAttrs(sku),
    price_cny: price(sku?.price ?? sku?.discount_price),
    stock: sku?.stock ?? sku?.quantity ?? sku?.num ?? null,
    image: normalizeImage(sku?.image ?? sku?.img ?? sku?.pic ?? sku?.image_url ?? sku?.imgUrl ?? sku?.skuImage),
    sku_id: sku?.sku_id == null ? null : String(sku.sku_id)
  }));
  const optionValues: Record<string, Set<string>> = {};
  for (const sku of skus) for (const [name, value] of Object.entries(sku.attrs)) (optionValues[name] ??= new Set()).add(value);
  const options = Object.entries(optionValues).map(([name, values]) => ({ name, label: name, values: [...values], images: {} }));
  const gallery = [
    ...normalizeImageList(item.image),
    ...normalizeImageList(item.img),
    ...normalizeImageList(item.images),
    ...normalizeImageList(item.main_image),
    ...imagesFromHtml(item.desc)
  ].filter((v: string) => /^https:\/\//i.test(v));
  const images = [...new Set(gallery)];
  const prices = [price(item.price), ...skus.map((sku: any) => sku.price_cny)].filter((v: number | null): v is number => v !== null);
  if (!prices.length) return null;
  return {
    ok: true, platform: type === "micro" ? "weidian" : type, title: item.title || "Produto CSSBuy",
    images, options, skus, price_cny: prices.length ? Math.min(...prices) : null,
    currency: "CNY", source: "CSSBuy item API", stock: null, canonical_url: url.toString()
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey || !authorization.startsWith("Bearer ")) {
    return json({ error: "Sessão inválida. Entre novamente no Haul Tracker." }, 401);
  }
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return json({ error: "Sessão expirada. Entre novamente." }, 401);
  let body: { url?: string; image_url?: string };
  try { body = await req.json(); } catch { return json({ error: "Envie um link válido." }, 400); }
  if (body.image_url) {
    let imageUrl: URL;
    try { imageUrl = new URL(String(body.image_url)); } catch { return json({ error: "URL de imagem inválida." }, 400); }
    const allowedImageHost = (host: string) => {
      const h = host.toLowerCase();
      return h === "alicdn.com" || h.endsWith(".alicdn.com") ||
        h === "1688.com" || h.endsWith(".1688.com") ||
        h === "taobaocdn.com" || h.endsWith(".taobaocdn.com") ||
        h === "weidian.com" || h.endsWith(".weidian.com") ||
        h === "geilicdn.com" || h.endsWith(".geilicdn.com") ||
        h === "doppel.fit" || h.endsWith(".doppel.fit") || h === "imgs.search.brave.com";
    };
    if (imageUrl.protocol !== "https:" || !allowedImageHost(imageUrl.hostname)) {
      return json({ error: "Servidor de imagem não permitido." }, 400);
    }
    try {
      const host = imageUrl.hostname.toLowerCase();
      const isDoppel = host === "doppel.fit" || host.endsWith(".doppel.fit");
      const referers = isDoppel
        ? ["https://doppel.fit/", "https://www.doppel.fit/", ""]
        : [host.includes("geilicdn.com") || host.endsWith(".weidian.com") ? "https://weidian.com/" : host === "imgs.search.brave.com" ? "https://search.brave.com/" : "https://detail.1688.com/"];
      let imageResponse: Response | null = null;
      let lastStatus = 0;
      for (const referer of referers) {
        const headers: Record<string,string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        };
        if (referer) headers["Referer"] = referer;
        if (!isDoppel) headers["Origin"] = host.includes("geilicdn.com") || host.endsWith(".weidian.com") ? "https://weidian.com" : host === "imgs.search.brave.com" ? "https://search.brave.com" : "https://detail.1688.com";
        const attempt = await fetch(imageUrl, {
          headers,
          redirect: "follow",
          signal: AbortSignal.timeout(15000)
        });
        const final = new URL(attempt.url);
        lastStatus = attempt.status;
        if (attempt.ok && allowedImageHost(final.hostname) && (attempt.headers.get("content-type") || "").toLowerCase().startsWith("image/")) {
          imageResponse = attempt;
          break;
        }
        console.warn("Preview image proxy upstream attempt failed", { status: attempt.status, host: final.hostname, referer: referer || "none" });
        try { await attempt.body?.cancel(); } catch { /* ignore */ }
      }
      if (!imageResponse) {
        return json({ error: "O servidor do Doppel.fit bloqueou o acesso externo à imagem.", upstream_status: lastStatus, source_host: host }, 502);
      }
      const finalUrl = new URL(imageResponse.url);
      const contentType = imageResponse.headers.get("content-type") || "application/octet-stream";
      const bytes = await imageResponse.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > 8 * 1024 * 1024) {
        return json({ error: "A imagem está vazia ou excede o limite de 8 MB." }, 413);
      }
      return new Response(bytes, {
        status: 200,
        headers: {
          ...CORS,
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=1800",
          "X-Image-Source": finalUrl.hostname
        }
      });
    } catch (error) {
      console.error("Preview image proxy failed", String(error));
      return json({ error: "Não foi possível carregar a imagem do anúncio." }, 502);
    }
  }
  let input: { url?: string };

  input = body;
  let inputUrl = "";
  try { inputUrl = cleanUrl(String(input.url || "").trim()); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Link inválido." }, 400); }
  let resolvedCssbuyUrl = inputUrl;
  const weidianLookupCache: { attempted?: boolean; payload?: any } = {};
  try {
    resolvedCssbuyUrl = await resolveCssbuyShortUrl(inputUrl);
    console.log("Preview lookup URL routing", {
      inputHost: new URL(inputUrl).hostname,
      resolvedHost: new URL(resolvedCssbuyUrl).hostname,
      resolvedHasType: new URL(resolvedCssbuyUrl).searchParams.has("type"),
      resolvedHasId: new URL(resolvedCssbuyUrl).searchParams.has("id")
    });
  } catch (error) {
    console.error("CSSBuy URL resolution failed", String(error));
  }
  try {
    const before = resolvedCssbuyUrl;
    resolvedCssbuyUrl = await resolveCssbuy1688Url(resolvedCssbuyUrl);
    if (before !== resolvedCssbuyUrl) console.log("CSSBuy 1688 source URL normalized", { sourceHost: new URL(resolvedCssbuyUrl).hostname });
  } catch (error) {
    console.warn("CSSBuy 1688 normalization skipped", String(error).slice(0, 160));
  }
  try {
    const before = resolvedCssbuyUrl;
    resolvedCssbuyUrl = await resolveCssbuyWeidianUrl(resolvedCssbuyUrl, weidianLookupCache);
    if (before !== resolvedCssbuyUrl) console.log("CSSBuy Weidian source URL normalized", { sourceHost: new URL(resolvedCssbuyUrl).hostname });
  } catch (error) {
    console.warn("CSSBuy Weidian normalization skipped", String(error).slice(0, 160));
  }

  const key = Deno.env.get("REPSAPI_KEY") || "";
  if (!key) return json({ error: "REPSAPI_KEY não está configurada no Supabase." }, 503);
  try {
    const endpoint = new URL("https://repsapi.pl/v1/lookup");
    endpoint.searchParams.set("url", resolvedCssbuyUrl);
    const response = await fetch(endpoint, {
      headers: { Authorization: "Bearer " + key, Accept: "application/json" },
      signal: AbortSignal.timeout(45000)
    });
    const raw = await response.text();
    let result: any = null;
    try { result = JSON.parse(raw); } catch { /* handled below */ }
    if (!response.ok || !result || result.error) {
      console.error("Product variants lookup failed", response.status, raw.slice(0, 1000));
      const cssbuyUrl = new URL(resolvedCssbuyUrl);
      if (["cssbuy.com", "www.cssbuy.com", "m.cssbuy.com"].includes(cssbuyUrl.hostname.toLowerCase()) && cssbuyUrl.searchParams.has("type")) {
        try {
          const fallback = await lookupCssbuy(cssbuyUrl, weidianLookupCache);
          if (fallback) {
            console.warn("RepsAPI failed; CSSBuy structured SKU fallback succeeded", { type: cssbuyUrl.searchParams.get("type"), optionCount: fallback.options?.length || 0, skuCount: fallback.skus?.length || 0 });
            return json(fallback);
          }
          console.warn("CSSBuy structured SKU fallback returned no usable data", { type: cssbuyUrl.searchParams.get("type"), apiStatus: response.status, responseSample: raw.slice(0, 500) });
        } catch (fallbackError) {
          console.error("CSSBuy structured SKU fallback failed", String(fallbackError).slice(0, 300));
        }
      }
      const status = response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 502 : 422;
      return json({ error: response.status === 429 ? "Limite de consultas atingido. Tente novamente mais tarde." : String(result?.error || result?.message || "Não foi possível extrair as variações deste anúncio."), provider_status: response.status }, status);
    }
    const variantBlock = result.variants && typeof result.variants === "object" && !Array.isArray(result.variants) ? result.variants : result;
    const optionSource = Array.isArray(variantBlock.options) ? variantBlock.options
      : Array.isArray(result.options) ? result.options
      : Array.isArray(result.attributes) ? result.attributes
      : Array.isArray(result.specs) ? result.specs
      : [];
    const rawOptions = optionSource.map((option: any) => ({
      name: String(option?.name || option?.name_cn || "Opção"),
      label: String(option?.name_en || option?.name || option?.name_cn || "Opção"),
      values: optionValues(option),
      images: normalizeOptionImages(option?.images ?? option?.image_map ?? option?.imageMap)
    })).filter((option: any) => option.values.length);
    const skuSource = Array.isArray(variantBlock.skus) ? variantBlock.skus
      : Array.isArray(result.skus) ? result.skus
      : Array.isArray(result.sku) ? result.sku
      : Array.isArray(result.variants) ? result.variants
      : [];
    const skus = skuSource.map((sku: any) => ({
      attrs: sku?.attrs && typeof sku.attrs === "object" ? sku.attrs
        : sku?.attributes && typeof sku.attributes === "object" ? sku.attributes
        : sku?.specs && typeof sku.specs === "object" ? sku.specs
        : parseSkuAttrs(sku),
      price_cny: price(sku?.price ?? sku?.price_cny ?? sku?.discount_price ?? sku?.sale_price),
      stock: sku?.stock == null ? sku?.quantity == null ? sku?.num == null ? null : Number(sku.num) : Number(sku.quantity) : Number(sku.stock),
      image: normalizeImage(sku?.image ?? sku?.img ?? sku?.image_url ?? sku?.imgUrl ?? sku?.skuImage) ?? collectImageUrls(sku)[0] ?? null,
      sku_id: sku?.sku_id == null ? null : String(sku.sku_id)
    }));
    const derivedValues: Record<string, Set<string>> = {};
    for (const sku of skus) for (const [name, value] of Object.entries(sku.attrs || {})) {
      const normalized = optionValue(value);
      if (normalized) (derivedValues[name] ??= new Set()).add(normalized);
    }
    const derivedOptions = Object.entries(derivedValues).map(([name, values]) => ({ name, label: name, values: [...values], images: {} }));
    // Weidian often supplies the option labels separately from the SKU images.
    // Build the per-value image map from matching SKU attributes.
    const options = (rawOptions.length ? rawOptions : derivedOptions).map((option: any) => {
      const images = { ...option.images };
      for (const sku of skus) {
        const matchedValue = Object.entries(sku.attrs || {}).find(([key]) =>
          key === option.name || key === option.label
        )?.[1];
        if (matchedValue != null && sku.image && !images[String(matchedValue)]) {
          images[String(matchedValue)] = sku.image;
        }
      }
      return { ...option, images };
    });
    const galleryRaw = [
      ...normalizeImageList(result.images),
      ...normalizeImageList(result.listing_photos),
      ...normalizeImageList(result.main_image),
      ...normalizeImageList(result.mainImage),
      ...normalizeImageList(result.gallery),
      ...normalizeImageList(result.sku_images),
      ...normalizeImageList(result.skuImages),
      ...skus.map((sku: any) => sku.image).filter((v: unknown) => typeof v === "string")
    ];
    const images = [...new Set(galleryRaw.filter((v: unknown) => typeof v === "string" && /^https:\/\//i.test(v)))];
    console.log("Preview product image diagnostics", {
      platform: result.platform || "unknown",
      rootKeys: Object.keys(result || {}),
      imageCount: images.length,
      skuCount: skus.length,
      variantKeys: variantBlock && typeof variantBlock === "object" ? Object.keys(variantBlock) : [],
      versionShape: Array.isArray(result.versions) ? result.versions.slice(0, 2) : typeof result.versions,
      sizeShape: Array.isArray(result.sizes) ? result.sizes.slice(0, 2) : typeof result.sizes,
      firstOption: Array.isArray(variantBlock.options) ? variantBlock.options[0] : null,
      firstSku: skus[0] || null,
      sampleImages: images.slice(0, 3)
    });
    const fallbackPrice = price(result.price?.low ?? result.price?.discount_low ?? result.price_cny ?? result.price);
    const prices = skus.map((sku: any) => sku.price_cny).filter((v: number | null): v is number => v !== null);
    const lowPrice = fallbackPrice ?? (prices.length ? Math.min(...prices) : null);
    return json({
      ok: true,
      platform: result.platform || null,
      product_id: result.product_id || null,
      title: result.title_en || result.title || result.title_pl || result.product_name || result.goods_name || result.item_name || result.subject || result.name || "Produto do anúncio",
      images,
      options,
      skus,
      price_cny: lowPrice,
      currency: "CNY",
      source: result.source || "RepsAPI",
      stock: result.availability?.total_stock ?? null,
      canonical_url: result.canonical || inputUrl
    });
  } catch (error) {
    console.error("Product variants lookup exception", String(error));
    return json({ error: "Falha ao consultar as opções do anúncio. Tente novamente." }, 500);
  }
});
