/**
 * お問い合わせフォームの受け口（Cloudflare Pages Functions）
 *
 * 設計（『Cloudflareの教科書』第4〜5章・罠帖 A-9 / D-1 / G-4 に従う）:
 *   1. 受け取ったら、まず D1 の帳面（inquiries）に必ず書く   … 取っておく
 *   2. そのあとメールで知らせる（Resend）。失敗しても帳面には残っている … 通知は格下げ
 *   3. 帳面にもメールにも残せなかったときだけ、送信者に「届いていない」と伝える（静かに失う形にしない）
 *   4. Turnstile の照合結果は error-codes ごとにログへ（鍵側の故障と画面側の故障を一発で切り分ける）
 *
 * 必要な設定（Cloudflare Pages → Settings）:
 *   D1 binding  DB               … wrangler.toml の [[d1_databases]]（binding = "DB"）
 *   TURNSTILE_SECRET_KEY         … Turnstile のシークレット（未設定なら照合をスキップし、警告ログ）
 *   RESEND_API_KEY / MAIL_TO / MAIL_FROM … 通知メール（未設定なら帳面のみ）
 */
interface Env {
  DB?: D1Database;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  MAIL_TO?: string;
  MAIL_FROM?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const plain = (msg: string, status: number) => new Response(msg, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
const MAX = { name: 100, company: 150, email: 200, tel: 40, type: 40, place: 200, status: 200, timing: 100, message: 4000 };

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const url = new URL(request.url);
  const form = await request.formData();
  const get = (k: keyof typeof MAX) => (form.get(k)?.toString() ?? '').trim().slice(0, MAX[k]);

  // ハニーポット（人間には見えない欄。埋まっていればbot → 何もせずお礼ページへ）
  if ((form.get('website')?.toString() ?? '').trim()) return Response.redirect(`${url.origin}/contact/thanks/`, 303);

  const name = get('name');
  const email = get('email');
  const message = get('message');
  // 門前の作法: 空・長すぎ・形式外は受け取らない（第4章）
  if (!name || !email || !message) return plain('必須項目が入力されていません。ブラウザの戻るで前のページへお戻りください。', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return plain('メールアドレスの形式をご確認ください。ブラウザの戻るで前のページへお戻りください。', 400);

  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const ua = request.headers.get('User-Agent') ?? '';

  // Turnstile 照合（罠帖 D-1: 結果はエラー種別ごとにログへ）
  let turnstile = 'skipped';
  if (env.TURNSTILE_SECRET_KEY) {
    const token = (form.get('cf-turnstile-response')?.toString() ?? '').trim();
    try {
      const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      });
      const vj = (await vr.json()) as { success: boolean; 'error-codes'?: string[]; hostname?: string };
      if (!vj.success) {
        const codes = (vj['error-codes'] ?? []).join(',') || 'unknown';
        // invalid-input-secret = 鍵側（設定）／ invalid-input-response, missing-input-response = 画面側（ウィジェット）
        console.error('turnstile failed', JSON.stringify({ codes, hostname: vj.hostname, hasToken: !!token, ip }));
        return plain('確認に失敗しました。ページを再読み込みして、もう一度お試しください。', 403);
      }
      turnstile = 'ok';
    } catch (e) {
      console.error('turnstile siteverify error', String(e));
      return plain('確認に失敗しました。しばらくしてからもう一度お試しください。', 503);
    }
  } else {
    console.warn('turnstile: TURNSTILE_SECRET_KEY not set, verification skipped');
  }

  const rec = {
    created_at: new Date().toISOString(),
    name, company: get('company'), email, tel: get('tel'), type: get('type'),
    place: get('place'), status: get('status'), timing: get('timing'), message, ip, user_agent: ua, turnstile,
  };

  // 1) 帳面に書く（D1）
  let saved = false;
  let rowId: number | null = null;
  if (env.DB) {
    try {
      const r = await env.DB.prepare(
        `INSERT INTO inquiries (created_at, name, company, email, tel, type, place, status, timing, message, ip, user_agent, turnstile, mail_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
      ).bind(rec.created_at, rec.name, rec.company, rec.email, rec.tel, rec.type, rec.place, rec.status, rec.timing, rec.message, rec.ip, rec.user_agent, rec.turnstile, 'pending').run();
      saved = r.success;
      rowId = (r.meta as { last_row_id?: number }).last_row_id ?? null;
    } catch (e) {
      console.error('d1 insert failed', String(e));
    }
  } else {
    console.error('d1 binding DB is not configured');
  }

  // 2) メールで知らせる（Resend）
  const fields: [string, string][] = [
    ['お名前', rec.name], ['会社名・事務所名', rec.company], ['メール', rec.email], ['電話', rec.tel],
    ['種類', rec.type], ['自治体・所在地', rec.place], ['現況・地目', rec.status], ['希望時期', rec.timing],
  ];
  const text = fields.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n---- ご相談内容 ----\n${rec.message}\n\n(帳面ID: ${rowId ?? '-'} / Turnstile: ${turnstile})\n`;
  const html = `<table>${fields.map(([k, v]) => `<tr><th align="left">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table><h3>ご相談内容</h3><pre style="white-space:pre-wrap;font-family:inherit">${esc(rec.message)}</pre><p style="color:#888;font-size:12px">帳面ID: ${rowId ?? '-'} / Turnstile: ${turnstile}</p>`;

  let mailStatus = 'not_configured';
  let mailed = false;
  if (env.RESEND_API_KEY && env.MAIL_TO && env.MAIL_FROM) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: `Life行政書士事務所 Web <${env.MAIL_FROM}>`,
          to: [env.MAIL_TO],
          reply_to: rec.email,
          subject: `【HPお問い合わせ】${rec.type || 'ご相談'}：${rec.name} 様`,
          text, html,
        }),
      });
      if (r.ok) { mailed = true; mailStatus = 'sent'; }
      else { mailStatus = `failed:${r.status}`; console.error('resend error', r.status, await r.text()); }
    } catch (e) {
      mailStatus = 'failed:exception';
      console.error('resend exception', String(e));
    }
  } else {
    console.warn('mail not configured; inquiry kept in D1 only', JSON.stringify({ rowId, name: rec.name }));
  }

  // 帳面にメールの結果を書き戻す（返事を返したあとで裏でやってよい処理）
  if (saved && env.DB && rowId !== null) {
    waitUntil(env.DB.prepare('UPDATE inquiries SET mail_status = ?1 WHERE id = ?2').bind(mailStatus, rowId).run().catch((e) => console.error('d1 update failed', String(e))));
  }

  // 3) どちらにも残らなかったときだけ、送信者に正直に伝える
  if (!saved && !mailed) {
    console.error('inquiry LOST', JSON.stringify({ name: rec.name, email: rec.email }));
    return plain('申し訳ありません。送信を受け付けられませんでした。お手数ですがお電話またはメールで直接ご連絡ください。', 502);
  }
  return Response.redirect(`${url.origin}/contact/thanks/`, 303);
};
