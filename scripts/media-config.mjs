/** Hosted media settings. These values are public configuration, never credentials. */
export function configureMedia(source, env, siteMedia) {
  // The site settings form owns the destination. `github` is the legacy same-repo value.
  if (siteMedia) {
    const provider =
      siteMedia.provider === 'media-repo'
        ? 'github'
        : siteMedia.provider === 'github'
          ? 'repo'
          : siteMedia.provider;
    const settings =
      provider === 'github'
        ? {
            provider,
            repo: siteMedia.mediaRepo,
            branch: siteMedia.mediaBranch || 'main',
            repoPath: siteMedia.mediaPath || 'images',
            publicPath: siteMedia.mediaPublicUrl,
          }
        : provider === 'r2'
          ? { provider, endpoint: siteMedia.endpoint || '/api/media' }
          : {
              provider: 'repo',
              repoPath: siteMedia.repoPath || 'public/images/uploads',
              publicPath: siteMedia.publicPath || '/images/uploads',
            };
    source = {
      ...source,
      media: {
        maxEdge: source.media?.maxEdge ?? 2400,
        exif: siteMedia.exifPrefill ?? source.media?.exif ?? true,
        ...settings,
      },
    };
    // Site-owned media settings take precedence over old deployment overrides.
    env = {};
  }
  const media = {
    ...source.media,
    provider: env.MEDIA_PROVIDER ?? source.media?.provider ?? 'repo',
  };
  if (!['repo', 'github', 'r2'].includes(media.provider))
    throw new Error('MEDIA_PROVIDER must be repo, github or r2');
  if (media.provider === 'r2') {
    media.endpoint = env.MEDIA_ENDPOINT ?? media.endpoint ?? '/api/media';
    if (!/^(\/(?!\/)|https:\/\/)/.test(media.endpoint))
      throw new Error('MEDIA_ENDPOINT must be a same-origin path or HTTPS URL');
  } else {
    media.repoPath =
      env.MEDIA_PATH ??
      (env.MEDIA_PROVIDER === 'github' ? 'images' : (media.repoPath ?? 'public/images/uploads'));
    if (
      media.repoPath.startsWith('/') ||
      /\\|\{\{/.test(media.repoPath) ||
      media.repoPath.split('/').some((p) => p === '.' || p === '..')
    )
      throw new Error('MEDIA_PATH must be a fixed repository-relative directory');
    media.publicPath = env.MEDIA_PUBLIC_URL ?? media.publicPath ?? '/images/uploads';
    if (media.provider === 'github') {
      media.repo = env.MEDIA_REPO ?? media.repo;
      media.branch = env.MEDIA_BRANCH ?? media.branch ?? 'main';
      if (!media.repo || !/^[\w.-]+\/[\w.-]+$/.test(media.repo))
        throw new Error('Set MEDIA_REPO to owner/repo');
      if (!media.publicPath.startsWith('https://'))
        throw new Error('Set MEDIA_PUBLIC_URL to the public HTTPS image directory');
    }
  }
  // An explicit deployment-wide choice replaces older collection path overrides.
  const collections = source.collections.map((collection) => {
    if ((!env.MEDIA_PROVIDER && !siteMedia) || !collection.media) return collection;
    const { media: previous, ...rest } = collection;
    void previous;
    return rest;
  });
  return { ...source, media, collections };
}
