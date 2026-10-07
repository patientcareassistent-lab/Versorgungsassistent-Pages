/* Defense-in-depth for GitHub Pages, which cannot set frame-ancestors/X-Frame-Options headers here. */
(() => {
  if (window.top === window.self) return

  try { window.stop() } catch (_) {}
  try { document.documentElement.replaceChildren() } catch (_) {}

  try {
    window.location.replace('about:blank')
  } catch (_) {
    try { document.body?.replaceChildren() } catch (_) {}
  }
})()
