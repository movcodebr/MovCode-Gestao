import { SubMenu } from "./SubMenu";

export default function LayoutFinanceiro({ children }: LayoutProps<"/financeiro">) {
  return (
    <>
      <SubMenu />
      {children}
    </>
  );
}
