// Seeds the starter blog posts (idempotent: upsert by slug). Run: npm run seed:blogs
// Existing posts are refreshed but keep their views, cover image and first publish date.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { upsertSeedPost } from '../src/domain/blog/blogs.service.js';
import { categorySlug, textOf } from '../src/domain/blog/content.js';
import { revalidateBlog } from '../src/domain/blog/revalidate.js';
import { Blog } from '../src/models/index.js';
import { blogSchema } from '../src/modules/admin/blogs/blogs.schema.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/seeders/blogs');
const files = (await readdir(dir)).filter((file) => file.endsWith('.js')).sort();

const posts = [];
for (const file of files) {
  const { default: post } = await import(pathToFileURL(path.join(dir, file)).href);
  const checked = blogSchema.safeParse(post);
  if (!checked.success) {
    console.error(`${file}: ${checked.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    process.exit(1);
  }
  posts.push({ ...checked.data, publishedAt: post.publishedAt });
}

await connectDatabase();
await Blog.syncIndexes();
for (const post of posts) {
  const { slug, created } = await upsertSeedPost(post);
  const words = textOf(post.content).split(' ').length;
  console.log(`${created ? 'created' : 'updated'}  ${slug}  (${words} words)`);
  await revalidateBlog({ slug, category: categorySlug(post.category) });
}
await disconnectDatabase();
console.log(`Done: ${posts.length} posts.`);
