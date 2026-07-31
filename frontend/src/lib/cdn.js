// Insert Cloudinary delivery transformations (auto format/quality + width)
// into an already-stored secure_url. No-ops for non-Cloudinary URLs.
export const cdn = (url, width) => {
  if (!url || !url.includes("/upload/")) return url;
  const t = `f_auto,q_auto${width ? `,w_${width}` : ""}`;
  return url.replace("/upload/", `/upload/${t}/`);
};
