import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { rotaPublica } from "@/lib/rotas";

/**
 * Roda antes de cada página: renova a sessão do Supabase e manda para o
 * login quem não estiver logado. A verificação definitiva é feita de novo
 * no layout das telas internas (src/app/(app)/layout.tsx).
 */
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesParaGravar) => {
          for (const { name, value } of cookiesParaGravar) request.cookies.set(name, value);
          resposta = NextResponse.next({ request });
          for (const { name, value, options } of cookiesParaGravar) {
            resposta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims?.sub);
  const caminho = request.nextUrl.pathname;

  if (!logado && !rotaPublica(caminho)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = caminho === "/" ? "" : `?destino=${encodeURIComponent(caminho)}`;
    return NextResponse.redirect(url);
  }

  if (logado && caminho === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return resposta;
}

export const config = {
  // Ignora arquivos estáticos (imagens, ícones, CSS/JS do Next)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
