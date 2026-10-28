import type { Metadata } from "next";
import { TituloPagina } from "@/components/ui";
import { formatarTelefone, normalizarTelefone, telefoneValido } from "@/lib/dominio/documento";
import { criarClienteSupabase } from "@/lib/supabase/servidor";
import { salvarCliente } from "../acoes";
import { FormularioCliente } from "../FormularioCliente";

export const metadata: Metadata = { title: "Novo cliente — Mov Code" };

/** Com ?lead=<id>, cadastra o cliente a partir de um lead da prospecção (nome e WhatsApp preenchidos). */
export default async function PaginaNovoCliente({ searchParams }: PageProps<"/clientes/novo">) {
  const { lead: leadId } = await searchParams;
  let lead: { id: string; nome: string; whatsapp: string } | null = null;
  if (typeof leadId === "string") {
    const supabase = await criarClienteSupabase();
    const { data } = await supabase.from("leads").select("id, nome, whatsapp").eq("id", leadId).maybeSingle();
    lead = data;
  }
  const telefone = lead ? normalizarTelefone(lead.whatsapp) : "";

  return (
    <>
      <TituloPagina descricao={lead ? `A partir do lead ${lead.nome}. Complete o CPF/CNPJ e o e-mail.` : undefined}>
        Novo cliente
      </TituloPagina>
      <FormularioCliente
        acao={salvarCliente.bind(null, null)}
        voltarPara={lead ? `/prospeccao/${lead.id}` : "/clientes"}
        leadId={lead?.id}
        inicial={
          lead
            ? {
                nome: lead.nome,
                telefone: telefoneValido(telefone) ? formatarTelefone(telefone) : "",
                email: "",
                documento: "",
                status: "ativo",
              }
            : undefined
        }
      />
    </>
  );
}
