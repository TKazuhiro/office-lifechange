/**
 * お問い合わせフォームの受け口（Cloudflare Pages Functions）
 *
 * 必要な環境変数（Cloudflare Pages → Settings → Variables and Secrets）:
 *   TURNSTILE_SECRET_KEY  … Turnstile のシークレットキー（未設定なら検証をスキップ）
 *   RESEND_API_KEY        … メール送信に使う Resend の API キー
 *   MAIL_TO               … 受信先メールアドレス（例: bluesky.hope.happy@gmail.com）
 *   MAIL_FROM             … 送信元（Resend で認証済みのドメインのアドレス。例: form@office-lifechange.com）
 */
interface Env {
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  MAIL_TO?: string;
  MAIL_FROM?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const form = await request.formData();
  const get = (k: string) => (form.get(k)?.toString() ?? '').trim();

  // ハニーポット（人間には見えない欄。埋まっていればbot）
  if (get('website')) return Response.redirect(`${url.origin}/contact/thanks/`, 303);

  const name = get('name');
  const email = get('email');
  const message = get('message');
  if (!name || !email || !message) {
    return new Response('必須項目が入力されていません。ブラウザの戻るで前のページへお戻りください。', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // Turnstile 検証
  if (env.TURNSTILE_SECRET_KEY) {
    const token = get('cf-turnstile-response');
    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
    });
    const vj = (await vr.json()) as { success: boolean };
    if (!vj.success) {
      return new Response('確認に失敗しました。ページを再読み込みして、もう一度お試しください。', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  }

  const fields: [string, string][] = [
    ['お名前', name],
    ['会社名・事務所名', get('company')],
    ['メール', email],
    ['電話', get('tel')],
    ['種類', get('type')],
    ['自治体・所在地', get('place')],
    ['現況・地目', get('status')],
    ['希望時期', get('timing')],
  ];
  const text = fields.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n---- ご相談内容 ----\n${message}\n`;
  const html = `<table>${fields.map(([k, v]) => `<tr><th align="left">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table><h3>ご相談内容</h3><pre style="white-space:pre-wrap;font-family:inherit">${esc(message)}</pre>`;

  if (env.RESEND_API_KEY && env.MAIL_TO && env.MAIL_FROM) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: `Life行政書士事務所 Web <${env.MAIL_FROM}>`,
        to: [env.MAIL_TO],
        reply_to: email,
        subject: `【HPお問い合わせ】${get('type') || 'ご相談'}：${name} 様`,
        text,
        html,
      }),
    });
    if (!r.ok) {
      console.error('resend error', r.status, await r.text());
      return new Response('送信に失敗しました。お手数ですがお電話またはメールでご連絡ください。', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  } else {
    // 未設定の間はログに残すだけ（プレビュー環境用）
    console.log('contact form (mail not configured):', text);
  }

  return Response.redirect(`${url.origin}/contact/thanks/`, 303);
};
