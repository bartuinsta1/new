# masalcik.app (statik web)

- `s/index.html` — paylaşılan masalın web önizlemesi (`/s/<jeton>` → bu dosya; sunucuda yeniden yazma kuralı:
  `/s/*` → `/s/index.html`). Veriyi `GET /functions/v1/share/:token`'dan çeker; masalın ilk iki paragrafını,
  dinleme düğmesini, paylaşanın davet kodunu ve App Store bağlantısını gösterir. `noindex`.
  Tasarım önizlemesi: `s/index.html?demo=1` (`&lang=en`).
- `.well-known/apple-app-site-association` — Universal Links: uygulama yüklüyse bağlantı uygulamada açılır.
  `TEAMID` Apple Developer ekip kimliğiyle değiştirilir; Xcode'da "Associated Domains" yeteneğine
  `applinks:masalcik.app` eklenir (ekip kimliği gerektirdiği için projeye henüz eklenmedi).
- Dağıtım: herhangi bir statik barındırma (Cloudflare Pages, Netlify, Supabase Storage + CDN).
  `meta[name=masalcik-api]` değerini Supabase proje adresiyle değiştirin.
