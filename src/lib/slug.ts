export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function uniqueSlug(base: string, exists: (candidate: string) => boolean): string {
  const root = slugify(base) || "entry";
  if (!exists(root)) return root;

  let n = 2;
  while (exists(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}
