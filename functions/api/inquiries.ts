/**
 * お問い合わせ帳面の閲覧（店主専用・教科書 第5章）
 *
 *   GET /api/inquiries            … 新しい順に最大50件（JSON）
 *   GET /api/inquiries?format=html … 同じものを簡単な表で
 *   GET /api/inquiries?probe=1    … 書き込みプローブ（罠帖 B-2: 読むだけの点検では書けない故障が見えない）
 *
 * 鍵: リクエストヘッダ  Authorization: Bearer <ADMIN_KEY>
 *   - 鍵は URL に書かない（履歴に残る）。ヘッダで送る（第5章「封筒の中へ」）
 *   - ADMIN_KEY 未設定なら 401 で閉じる（罠帖 G-4: 未設定で素通りする実装にしない）
 */
interface Env { DB?: D1Database; ADMIN_KEY?: string }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  if (!env.ADMIN_KEY) return new Response('ADMIN_KEY is not configured', { status: 401 });
  const auth = request.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${env.ADMIN_KEY}`) return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
  if (!env.DB) return new Response('D1 binding DB is not configured', { status: 500 });

  if (url.searchParams.get('probe') === '1') {
    // 実際に1件書いて読み戻し、消す（帳面が「書ける」状態かを確かめる）
    const t = new Date().toISOString();
    const ins = await env.DB.prepare(
      `INSERT INTO inquiries (created_at, name, email, message, turnstile, mail_status) VALUES (?1, 'probe', 'probe@example.invalid', 'write probe', 'probe', 'probe')`,
    ).bind(t).run();
    const id = (ins.meta as { last_row_id?: number }).last_row_id;
    const back = await env.DB.prepare('SELECT id FROM inquiries WHERE id = ?1').bind(id).first();
    await env.DB.prepare('DELETE FROM inquiries WHERE id = ?1').bind(id).run();
    return Response.json({ ok: !!back, wrote_id: id, at: t });
  }

  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 200);
  const rows = await env.DB.prepare('SELECT * FROM inquiries ORDER BY id DESC LIMIT ?1').bind(limit).all();
  const list = rows.results ?? [];

  if (url.searchParams.get('format') === 'html') {
    const cols = ['id', 'created_at', 'name', 'company', 'email', 'tel', 'type', 'place', 'status', 'timing', 'message', 'turnstile', 'mail_status', 'handled_at'];
    const body = `<!doctype html><meta charset="utf-8"><title>お問い合わせ帳面</title>
<style>body{font:14px/1.6 system-ui,sans-serif;padding:1rem}table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:.3em .5em;vertical-align:top;font-size:12px}td.msg{white-space:pre-wrap;max-width:32em}</style>
<h1>お問い合わせ帳面（${list.length}件）</h1>
<table><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>
${list.map((r: Record<string, unknown>) => `<tr>${cols.map((c) => `<td class="${c === 'message' ? 'msg' : ''}">${esc(r[c])}</td>`).join('')}</tr>`).join('\n')}
</table>`;
    return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return Response.json({ count: list.length, inquiries: list }, { headers: { 'cache-control': 'no-store' } });
};
