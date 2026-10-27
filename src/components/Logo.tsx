import Image from "next/image";

type Props = {
  /** Altura do símbolo em pixels; o texto acompanha a proporção. */
  tamanho?: number;
};

/** Logo da Mov Code: símbolo + "MovCode." com "Code." em laranja. */
export function Logo({ tamanho = 28 }: Props) {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight">
      <Image
        src="/logo-simbolo.svg"
        alt=""
        width={Math.round(tamanho * 0.8)}
        height={tamanho}
        priority
      />
      <span style={{ fontSize: tamanho * 0.75 }}>
        Mov<span className="text-destaque">Code.</span>
      </span>
    </span>
  );
}
