import type { APIRoute, GetStaticPaths } from 'astro';
import { getRiskLists } from '@/data/frameworks';
import { renderFrameworkMarkdown } from '@/lib/markdown-renderer';

export const getStaticPaths: GetStaticPaths = () => {
  return getRiskLists()
    .filter(c => !c.tags?.includes('TBD'))
    .map(c => ({ params: { risklist: c.id } }));
};

export const GET: APIRoute = ({ params }) => {
  const body = renderFrameworkMarkdown(params.risklist!);
  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
