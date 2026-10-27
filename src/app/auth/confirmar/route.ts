import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { destinoSeguro } from "@/lib/rotas";
import { criarClienteSupabase } from "@/lib/supabase/servidor";

/**
 * Destino do link de "esqueci minha senha" enviado por e-mail.
 * Aceita os dois formatos do Supabase: token_hash (modelo de e-mail
 * recomendado no README, funciona em qualquer navegador) e code (padrão).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const destino = destinoSeguro(params.get("destino") ?? params.get("next"), "/redefinir-senha");
  const tokenHash = params.get("token_hash");
  const tipo = params.get("type") as EmailOtpType | null;
  const codigo = params.get("code");

  const supabase = await criarClienteSupabase();
  let erro = true;
  if (tokenHash && tipo) {
    erro = Boolean((await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })).error);
  } else if (codigo) {
    erro = Boolean((await supabase.auth.exchangeCodeForSession(codigo)).error);
  }

  const url = request.nextUrl.clone();
  url.search = "";
  if (erro) {
    url.pathname = "/login";
    url.searchParams.set("aviso", "link-invalido");
  } else {
    url.pathname = destino;
  }
  return NextResponse.redirect(url);
}
