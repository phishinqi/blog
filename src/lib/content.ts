import { getCollection } from 'astro:content';
import { publishedPosts } from './posts';
const buildTime = new Date();
// Shared by every public output. Drafts and future posts never receive a route.
export async function getPublishedPosts() {
  return publishedPosts(await getCollection('posts'), buildTime);
}
