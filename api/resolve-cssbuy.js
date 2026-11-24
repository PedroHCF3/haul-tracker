export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const raw = typeof req.query?.url === 'string' ? req.query.url : '';
  let input;
  try { input = new URL(raw); } catch { return res.status(400).json({ error: 'URL inválida.' }); }
  const allowed = host => host === 'cssb.uy' || host.endsWith('.cssb.uy') || host === 'cssbuy.com' || host.endsWith('.cssbuy.com');
  if (!allowed(input.hostname.toLowerCase())) return res.status(400).json({ error: 'Domínio não suportado.' });

  try {
    const response = await fetch(input.toString(), {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; HaulTrackerLinkResolver/1.0)' }
    });
    const finalUrl = new URL(response.url);
    if (!allowed(finalUrl.hostname.toLowerCase())) return res.status(400).json({ error: 'O link redirecionou para um domínio não suportado.' });

    const fromUrl = parseOriginal(finalUrl);
    if (fromUrl) return res.status(200).json(fromUrl);

    const html = await response.text();
    const mobile = html.match(/item-micro-(\d+)\.html/i);
    if (mobile) return res.status(200).json({ url: 'https://weidian.com/item.html?itemID=' + mobile[1], platform: 'Weidian' });
    const offer = html.match(/item-1688-(\d+)\.html/i)
      || html.match(/(?:offerId|offer_id|offerid|offer_id%22)\s*[:=]\s*[\\"']?(\d{8,})/i)
      || html.match(/detail\.1688\.com\/offer\/(\d{8,})/i);
    if (offer) return res.status(200).json({ url: 'https://detail.1688.com/offer/' + offer[1] + '.html', platform: '1688' });

    return res.status(422).json({ error: 'O CSSBuy não expôs o ID original do anúncio nesse link. O ID interno não é suficiente para reconstruir o endereço com segurança.' });
  } catch {
    return res.status(502).json({ error: 'Não consegui resolver esse link agora. Tente novamente ou abra o link curto no navegador.' });
  }
}

function parseOriginal(url) {
  const host = url.hostname.toLowerCase();
  const mobile = url.pathname.match(/item-micro-(\d+)\.html/i);
  if (mobile) return { url: 'https://weidian.com/item.html?itemID=' + mobile[1], platform: 'Weidian' };
  const embedded = url.href.match(/item-1688-(\d+)\.html/i);
  if (embedded) return { url: 'https://detail.1688.com/offer/' + embedded[1] + '.html', platform: '1688' };
  const type = (url.searchParams.get('type') || '').toLowerCase();
  const id = url.searchParams.get('id') || url.searchParams.get('itemID') || '';
  if (type.includes('1688') && /^\d{8,}$/.test(id)) return { url: 'https://detail.1688.com/offer/' + id + '.html', platform: '1688' };
  if ((type.includes('micro') || type.includes('weidian')) && /^\d{5,}$/.test(id)) return { url: 'https://weidian.com/item.html?itemID=' + id, platform: 'Weidian' };
  return null;
}
