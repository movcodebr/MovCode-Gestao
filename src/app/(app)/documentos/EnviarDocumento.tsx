"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Mensagem } from "@/components/ui";
import { caminhoDocumento, formatarTamanho, TAMANHO_MAXIMO_DOCUMENTO } from "@/lib/dominio/documentos";
import { criarClienteNavegador } from "@/lib/supabase/navegador";
import { registrarDocumento } from "./acoes";

/** Envio de arquivos direto do navegador para o Storage privado (sem limite de tamanho do servidor). */
export function EnviarDocumento() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setAviso(null);
    const supabase = criarClienteNavegador();
    const mensagens: string[] = [];
    let erro = false;
    for (const arquivo of Array.from(arquivos)) {
      if (arquivo.size > TAMANHO_MAXIMO_DOCUMENTO) {
        mensagens.push(`"${arquivo.name}" tem ${formatarTamanho(arquivo.size)}; o limite é 50 MB.`);
        erro = true;
        continue;
      }
      setEnviando(arquivo.name);
      const caminho = caminhoDocumento(crypto.randomUUID(), arquivo.name);
      const { error } = await supabase.storage
        .from("documentos")
        .upload(caminho, arquivo, { contentType: arquivo.type || "application/octet-stream" });
      if (error) {
        mensagens.push(`Não foi possível enviar "${arquivo.name}".`);
        erro = true;
        continue;
      }
      const r = await registrarDocumento({ caminho, nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type || null });
      if (r.erro) {
        mensagens.push(r.erro);
        erro = true;
      } else mensagens.push(r.sucesso!);
    }
    setEnviando(null);
    setAviso({ tipo: erro ? "erro" : "sucesso", texto: mensagens.join(" ") });
    if (entrada.current) entrada.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-borda px-4 py-8 text-center transition hover:border-destaque ${enviando ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="font-medium">{enviando ? `Enviando "${enviando}"...` : "Clique para escolher arquivos"}</span>
        <span className="text-sm text-texto-secundario">Planilhas, PDFs, prompts e outros arquivos internos — até 50 MB cada</span>
        <input
          ref={entrada}
          type="file"
          multiple
          className="sr-only"
          aria-label="Escolher arquivos para enviar"
          onChange={(e) => enviar(e.target.files)}
        />
      </label>
      {aviso && <Mensagem tipo={aviso.tipo}>{aviso.texto}</Mensagem>}
    </div>
  );
}
