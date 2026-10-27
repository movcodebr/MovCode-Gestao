/**
 * Cria um usuário do sistema (o cadastro público é desativado).
 *
 * Uso:  npm run criar-usuario
 *
 * Pergunta nome, e-mail e senha. Precisa de NEXT_PUBLIC_SUPABASE_URL e
 * SUPABASE_SERVICE_ROLE_KEY no arquivo .env.local.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
let ocultarDigitacao = false;
// Esconde a senha enquanto é digitada (só no terminal interativo)
const escreverOriginal = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = function (texto: string) {
  if (!ocultarDigitacao) escreverOriginal.call(rl, texto);
};

// O iterador guarda as linhas recebidas, então funciona também com entrada redirecionada
const linhas = rl[Symbol.asyncIterator]();

async function perguntar(pergunta: string, oculto = false): Promise<string> {
  stdout.write(pergunta);
  ocultarDigitacao = oculto;
  const { value } = await linhas.next();
  ocultarDigitacao = false;
  if (oculto && stdin.isTTY) stdout.write("\n");
  return String(value ?? "").trim();
}

async function main() {
  // Só o endereço base do projeto, mesmo que tenham colado /rest/v1 junto
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL.trim()).origin : "";
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }

  const nome = await perguntar("Nome: ");
  const email = await perguntar("E-mail: ");
  const senha = await perguntar("Senha (mínimo 8 caracteres): ", true);
  rl.close();
  if (!nome || !email.includes("@") || senha.length < 8) {
    console.error("Dados inválidos: informe nome, e-mail válido e senha com pelo menos 8 caracteres.");
    process.exit(1);
  }

  const supabase = createClient(url, chave, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error) {
    console.error(`Não foi possível criar o usuário: ${error.message}`);
    process.exit(1);
  }
  console.log(`Usuário criado: ${data.user.email}`);
}

main();
