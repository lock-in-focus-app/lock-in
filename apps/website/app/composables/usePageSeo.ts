// A page's title and description, for search results and for the preview when someone shares a
// link to it. The rest of the preview (image, site name, address) is set in app.vue.
export function usePageSeo(meta: { title: string; description: string }) {
  useSeoMeta({ ...meta, ogTitle: meta.title, ogDescription: meta.description });
}
