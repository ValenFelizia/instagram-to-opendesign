export function cleanUsername(value) {
  const username = String(value ?? '').replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) throw new Error('Expected an Instagram username (without a URL).');
  return username.toLowerCase();
}

const string = (value) => typeof value === 'string' ? value : null;
const count = (value) => Number.isInteger(value) && value >= 0 ? value : null;
const validUrl = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null; }
  catch { return null; }
};

function mediaFor(post) {
  const candidates = [];
  const add = (kind, url) => { if (validUrl(url)) candidates.push({ kind, remoteUrl: url }); };
  for (const child of post.childPosts ?? []) {
    add('image', child.displayUrl);
    add('video', child.videoUrl);
  }
  if (!candidates.length) {
    for (const url of post.carouselImages ?? post.images ?? []) add('image', url);
    add('image', post.displayUrl);
    add('video', post.videoUrl);
  }
  const seen = new Set();
  return candidates.filter((item) => {
    if (seen.has(item.remoteUrl)) return false;
    seen.add(item.remoteUrl);
    return true;
  }).map((item, index) => ({ id: `media-${index + 1}`, ...item, assetPath: null }));
}

export function normalizeSource(usernameInput, collected, extractedAt = new Date().toISOString()) {
  const username = cleanUsername(usernameInput);
  const profile = collected.profile;
  if (!profile || cleanUsername(profile.username) !== username) throw new Error('Provider returned a different profile.');
  const links = [profile.externalUrl, ...(profile.externalUrls ?? []).map((item) => item?.url)]
    .map(validUrl).filter(Boolean);
  const source = {
    schemaVersion: 'instagram-source/v1',
    source: { provider: 'apify/instagram-scraper', profileUrl: `https://www.instagram.com/${username}/`, extractedAt, runIds: collected.runs ?? [] },
    profile: {
      username, fullName: string(profile.fullName), biography: string(profile.biography),
      externalUrls: [...new Set(links)], category: string(profile.businessCategoryName),
      followersCount: count(profile.followersCount), postsCount: count(profile.postsCount),
      avatar: validUrl(profile.profilePicUrlHD ?? profile.profilePicUrl)
        ? { kind: 'image', remoteUrl: profile.profilePicUrlHD ?? profile.profilePicUrl, assetPath: null } : null,
    },
    posts: [],
  };
  const seen = new Set();
  for (const raw of collected.posts ?? []) {
    if (raw.ownerUsername && cleanUsername(raw.ownerUsername) !== username) continue;
    const shortCode = string(raw.shortCode);
    if (!shortCode || !/^[A-Za-z0-9_-]+$/.test(shortCode) || seen.has(shortCode)) continue;
    seen.add(shortCode);
    source.posts.push({
      id: shortCode, url: `https://www.instagram.com/p/${shortCode}/`,
      type: string(raw.type), timestamp: string(raw.timestamp), caption: string(raw.caption) ?? '',
      likesCount: count(raw.likesCount), commentsCount: count(raw.commentsCount),
      media: mediaFor(raw),
    });
  }
  return source;
}
