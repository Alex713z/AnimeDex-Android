// Resolvers de Servidores de Streaming para Android MVP

function deobfuscate(argsStr) {
  try {
    const args = new Function("return [" + argsStr + "]")();
    let p = args[0];
    const a = parseInt(args[1]);
    const c = parseInt(args[2]);
    const k = args[3];

    const e = function(c) {
      return (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
    };

    let i = c;
    while (i--) {
      if (k[i]) {
        p = p.replace(new RegExp('\\b' + e(i) + '\\b', 'g'), k[i]);
      }
    }
    return p;
  } catch (err) {
    return null;
  }
}

// Resolver Streamwish / Vidhide (Packed JS)
export async function resolvePackedSource(embedUrl, http) {
  try {
    let resolvedUrl = embedUrl;
    if (resolvedUrl.includes('streamwish.to')) {
      resolvedUrl = resolvedUrl.replace('streamwish.to', 'sfastwish.com');
    }
    const res = await http.get({
      url: resolvedUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://jkanime.net/'
      }
    });

    const html = res.data;
    const regex = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]*?\}\s*\(([\s\S]*?\.split\(['"]\|['"]\))\s*\)\s*\)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const argsStr = match[1];
      const unpacked = deobfuscate(argsStr);
      if (unpacked) {
        const m3u8Match = unpacked.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
        if (m3u8Match) return m3u8Match[0];
        const mp4Match = unpacked.match(/https?:\/\/[^"']+\.mp4[^"']*/i);
        if (mp4Match) return mp4Match[0];
      }
    }
  } catch (err) {
    console.error(`[RESOLVING PACKED ERROR] ${err.message}`);
  }
  return null;
}

// Resolver Streamtape
export async function resolveStreamtape(embedUrl, http) {
  try {
    const res = await http.get({
      url: embedUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = res.data;
    const robotMatch = html.match(/getElementById\('robotlink'\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*\(?['"]([^'"]+)['"]\)?\s*\.substring\((\d+)\)(?:\.substring\((\d+)\))?/);
    if (robotMatch) {
      const prefix = robotMatch[1];
      let suffix = robotMatch[2];
      const sub1 = parseInt(robotMatch[3]);
      const sub2 = robotMatch[4] ? parseInt(robotMatch[4]) : null;
      suffix = suffix.substring(sub1);
      if (sub2 !== null) suffix = suffix.substring(sub2);
      return 'https:' + prefix + suffix;
    }
  } catch (err) {
    console.error(`[RESOLVING STREAMTAPE ERROR] ${err.message}`);
  }
  return null;
}

// Resolver Mixdrop
export async function resolveMixdrop(embedUrl, http) {
  try {
    const res = await http.get({
      url: embedUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = res.data;
    const regex = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]*?\}\s*\(([\s\S]*?\.split\(['"]\|['"]\))\s*\)\s*\)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const unpacked = deobfuscate(match[1]);
      if (unpacked) {
        const wurlMatch = unpacked.match(/MDCore\.wurl\s*=\s*"([^"]+)"/);
        if (wurlMatch) return wurlMatch[1].startsWith('//') ? 'https:' + wurlMatch[1] : wurlMatch[1];
        const vsrcMatch = unpacked.match(/MDCore\.vsrc\s*=\s*"([^"]+)"/);
        if (vsrcMatch) return vsrcMatch[1].startsWith('//') ? 'https:' + vsrcMatch[1] : vsrcMatch[1];
      }
    }
  } catch (err) {
    console.error(`[RESOLVING MIXDROP ERROR] ${err.message}`);
  }
  return null;
}

// Resolver YourUpload
export async function resolveYourUpload(embedUrl, http) {
  try {
    const res = await http.get({
      url: embedUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = res.data;
    const mp4Match = html.match(/file:\s*['"]?(https?:\/\/[^'"]+\.mp4[^'"]*)/i) || html.match(/src:\s*['"]?(https?:\/\/[^'"]+\.mp4[^'"]*)/i);
    if (mp4Match) return mp4Match[1];
  } catch (err) {
    console.error(`[RESOLVING YOURUPLOAD ERROR] ${err.message}`);
  }
  return null;
}

// Resolver Netu/HQQ
export async function resolveNetu(embedUrl, http) {
  try {
    const res = await http.get({
      url: embedUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = res.data;
    const m3u8Match = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
    if (m3u8Match) return m3u8Match[0];
  } catch (err) {
    console.error(`[RESOLVING NETU ERROR] ${err.message}`);
  }
  return null;
}

// Resolver VOE
export async function resolveVoe(embedUrl, http) {
  const vidMatch = embedUrl.match(/https?:\/\/[^/]+\/(?:e\/|v\/|d\/)?([A-Za-z0-9]+)/);
  if (!vidMatch) return null;
  const vid = vidMatch[1];
  
  let currentUrl = `https://voe.sx/${vid}/download`;
  let referer = embedUrl;
  
  for (let step = 1; step <= 5; step++) {
    try {
      const res = await http.get({
        url: currentUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': referer
        }
      });
      
      const html = res.data;
      const mp4Regex = /https?:\/\/(?![^"']+test-videos\.co\.uk)[^"']+\.mp4\?[^"']*/i;
      const mp4Match = html.match(mp4Regex);
      if (mp4Match) {
        return mp4Match[0].replace(/&amp;/g, '&')
                           .replace(/&quot;/g, '"')
                           .replace(/&#39;/g, "'")
                           .replace(/&lt;/g, '<')
                           .replace(/&gt;/g, '>');
      }
      
      const redirectMatch = html.match(/window\.location\.href\s*=\s*['"](https?:\/\/[^'"]+)['"]/);
      if (redirectMatch) {
        referer = currentUrl;
        currentUrl = redirectMatch[1];
        continue;
      }
      break;
    } catch (err) {
      break;
    }
  }
  return null;
}

// Master resolver
export async function resolveServer(serverName, embedUrl, http) {
  const sn = serverName.toLowerCase();
  if (sn.includes('streamwish') || sn.includes('sw') || sn.includes('vidhide') || sn.includes('vh')) {
    return await resolvePackedSource(embedUrl, http);
  }
  if (sn.includes('streamtape') || sn.includes('stape')) {
    return await resolveStreamtape(embedUrl, http);
  }
  if (sn.includes('mixdrop')) {
    return await resolveMixdrop(embedUrl, http);
  }
  if (sn.includes('yourupload') || sn === 'yu') {
    return await resolveYourUpload(embedUrl, http);
  }
  if (sn.includes('netu') || sn.includes('hqq')) {
    return await resolveNetu(embedUrl, http);
  }
  if (sn.includes('voe')) {
    return await resolveVoe(embedUrl, http);
  }
  return null;
}
