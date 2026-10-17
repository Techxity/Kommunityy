function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function safeFilename(name) {
  const normalized = String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || "celebrant";
}

export function birthdayCardSvg(memberName, communityName) {
  const name = escapeXml(String(memberName).trim());
  const community = escapeXml(String(communityName).trim());

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" role="img" aria-labelledby="title description">
  <title id="title">Happy Birthday, ${name}!</title>
  <desc id="description">A birthday greeting from ${community}, powered by akenrose.com.</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff7ed"/>
      <stop offset="52%" stop-color="#fff1f2"/>
      <stop offset="100%" stop-color="#fce7f3"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#fffaf7"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#background)"/>
  <circle cx="78" cy="215" r="145" fill="#fda4af" opacity=".20"/>
  <circle cx="1002" cy="1650" r="190" fill="#fdba74" opacity=".20"/>
  <circle cx="1000" cy="330" r="72" fill="#f9a8d4" opacity=".26"/>
  <circle cx="94" cy="1550" r="86" fill="#fb7185" opacity=".16"/>
  <path d="M115 455c95-128 159-164 243-198M955 1350c-81 105-147 146-226 181" fill="none" stroke="#e11d48" stroke-linecap="round" stroke-width="5" opacity=".24"/>
  <g fill="#e11d48" opacity=".55">
    <circle cx="180" cy="604" r="9"/><circle cx="225" cy="566" r="6"/><circle cx="862" cy="564" r="8"/>
    <circle cx="909" cy="619" r="5"/><circle cx="205" cy="1320" r="7"/><circle cx="878" cy="1292" r="10"/>
    <path d="M878 386l12 25 27 4-20 19 5 27-24-13-24 13 5-27-20-19 27-4z"/>
    <path d="M187 1262l9 18 20 3-15 14 4 20-18-10-18 10 4-20-15-14 20-3z"/>
    <path d="M913 1445l8 16 18 3-13 13 3 18-16-9-16 9 3-18-13-13 18-3z"/>
  </g>
  <rect x="78" y="150" width="924" height="1620" rx="46" fill="url(#panel)" stroke="#ffffff" stroke-width="4"/>
  <rect x="100" y="172" width="880" height="1576" rx="34" fill="none" stroke="#fda4af" stroke-width="2" opacity=".7"/>
  <text x="540" y="324" text-anchor="middle" fill="#9f1239" font-family="Georgia, 'Times New Roman', serif" font-size="25" font-weight="700" letter-spacing="5" textLength="820" lengthAdjust="spacingAndGlyphs">${community}</text>
  <path d="M380 379h320" stroke="#fda4af" stroke-width="2"/>
  <circle cx="540" cy="379" r="7" fill="#e11d48"/>
  <g transform="translate(540 670)">
    <circle r="137" fill="#fff1f2"/>
    <circle r="115" fill="none" stroke="#fda4af" stroke-width="2" stroke-dasharray="3 12"/>
    <path d="M-72 19h144l-13 91h-118z" fill="#be123c"/>
    <path d="M-88 13h176l-12 32h-152z" fill="#e11d48"/>
    <path d="M-25 13c-49-32-24-70 4-48 9 7 15 20 21 36 7-16 13-29 22-36 28-22 53 16 4 48" fill="none" stroke="#f59e0b" stroke-linecap="round" stroke-width="12"/>
    <path d="M0 42v66M-40 72h80" stroke="#fda4af" stroke-width="7" opacity=".7"/>
    <circle cx="-48" cy="56" r="5" fill="#fff1f2"/><circle cx="48" cy="87" r="5" fill="#fff1f2"/>
  </g>
  <text x="540" y="1002" text-anchor="middle" fill="#9f1239" font-family="Georgia, 'Times New Roman', serif" font-size="62" font-weight="700" letter-spacing="1">Happy Birthday</text>
  <text x="540" y="1110" text-anchor="middle" fill="#be123c" font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="700" textLength="820" lengthAdjust="spacingAndGlyphs">${name}</text>
  <path d="M420 1170h240" stroke="#fda4af" stroke-width="3" stroke-linecap="round"/>
  <text x="540" y="1260" text-anchor="middle" fill="#57534e" font-family="Arial, Helvetica, sans-serif" font-size="30" letter-spacing="2">WISHING YOU A DAY FULL OF JOY</text>
  <text x="540" y="1320" text-anchor="middle" fill="#78716c" font-family="Arial, Helvetica, sans-serif" font-size="26" letter-spacing="1">and a beautiful year ahead</text>
  <g fill="#fb7185" opacity=".7">
    <circle cx="337" cy="1447" r="7"/><circle cx="386" cy="1474" r="5"/><circle cx="694" cy="1458" r="6"/>
    <circle cx="751" cy="1425" r="8"/><path d="M540 1428l8 16 18 3-13 13 3 18-16-9-16 9 3-18-13-13 18-3z"/>
  </g>
  <text x="540" y="1637" text-anchor="middle" fill="#a8a29e" font-family="Arial, Helvetica, sans-serif" font-size="18" letter-spacing="1">POWERED BY</text>
  <text x="540" y="1674" text-anchor="middle" fill="#78716c" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="1">akenrose.com</text>
</svg>`;
}

export function birthdayCardAttachment(memberName, communityName) {
  const content = encodeBase64(birthdayCardSvg(memberName, communityName));
  return {
    filename: `birthday-${safeFilename(memberName)}.svg`,
    content,
    content_type: "image/svg+xml",
  };
}
