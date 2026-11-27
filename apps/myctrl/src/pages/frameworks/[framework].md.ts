import type { APIRoute, GetStaticPaths } from 'astro';
import { getFrameworks } from '@/data/frameworks';
import { renderFrameworkMarkdown } from '@/lib/markdown-renderer';

export const getStaticPaths: GetStaticPaths = () => {
  return getFrameworks()
    .filter(c => !c.tags?.includes('TBD'))
    .map(c => ({ params: { framework: c.id } }));
};

export const GET: APIRoute = ({ params }) => {
  const body = renderFrameworkMarkdown(params.framework!);
  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
