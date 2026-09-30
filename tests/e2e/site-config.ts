import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync(resolve('site.config.json'), 'utf8')) as {
  siteURL: string;
};

export const siteOrigin = new URL(config.siteURL).origin;
export const siteUrl = (pathname: string) => new URL(pathname, `${siteOrigin}/`).href;
