import { it, expect } from 'vitest';
import { configureMedia } from '../../scripts/media-config.mjs';

const source = {
  media: { provider: 'repo', repoPath: 'public/images/uploads', publicPath: '/images/uploads' },
  collections: [{ name: 'albums', media: { publicPath: '/old/{{slug}}' } }],
};
it('keeps repository mode and supports a fixed deployment folder', () => {
  expect(configureMedia(source, {}).media).toEqual(source.media);
  const result = configureMedia(source, {
    MEDIA_PROVIDER: 'repo',
    MEDIA_PATH: 'public/photos',
    MEDIA_PUBLIC_URL: '/photos',
  });
  expect(result.media.repoPath).toBe('public/photos');
  expect(result.collections[0].media).toBeUndefined();
});
it('configures the R2 API and rejects an invalid endpoint', () => {
  expect(configureMedia(source, { MEDIA_PROVIDER: 'r2' }).media.endpoint).toBe('/api/media');
  expect(() =>
    configureMedia(source, { MEDIA_PROVIDER: 'r2', MEDIA_ENDPOINT: 'javascript:bad' }),
  ).toThrow();
});
it('requires a distinct media repository and public URL', () => {
  expect(() => configureMedia(source, { MEDIA_PROVIDER: 'github' })).toThrow('MEDIA_REPO');
  expect(() =>
    configureMedia(source, { MEDIA_PROVIDER: 'github', MEDIA_REPO: 'owner/media' }),
  ).toThrow('MEDIA_PUBLIC_URL');
  const result = configureMedia(source, {
    MEDIA_PROVIDER: 'github',
    MEDIA_REPO: 'owner/media',
    MEDIA_BRANCH: 'assets',
    MEDIA_PUBLIC_URL: 'https://img.example/images',
  });
  expect(result.media).toMatchObject({
    repo: 'owner/media',
    branch: 'assets',
    repoPath: 'images',
    publicPath: 'https://img.example/images',
  });
  expect(result.collections[0].media).toBeUndefined();
});

it('uses saved site settings ahead of stale environment overrides', () => {
  const result = configureMedia(
    source,
    { MEDIA_PROVIDER: 'r2' },
    { provider: 'repo', repoPath: 'public/photos', publicPath: '/photos' },
  );
  expect(result.media).toMatchObject({
    provider: 'repo',
    repoPath: 'public/photos',
    publicPath: '/photos',
  });
  expect(result.collections[0].media).toBeUndefined();
});
it('maps all settings choices and preserves the legacy github meaning', () => {
  expect(configureMedia(source, {}, { provider: 'github' }).media.provider).toBe('repo');
  expect(configureMedia(source, {}, { provider: 'r2' }).media.endpoint).toBe('/api/media');
  expect(
    configureMedia(
      source,
      {},
      {
        provider: 'media-repo',
        mediaRepo: 'owner/assets',
        mediaBranch: 'pictures',
        mediaPath: 'photos',
        mediaPublicUrl: 'https://img.example/photos',
      },
    ).media,
  ).toMatchObject({
    provider: 'github',
    repo: 'owner/assets',
    branch: 'pictures',
    repoPath: 'photos',
    publicPath: 'https://img.example/photos',
  });
  expect(() => configureMedia(source, {}, { provider: 'media-repo' })).toThrow();
});
