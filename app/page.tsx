// app/page.tsx
// -----------------------------------------------------------------------
// Esta é a "página raiz" do site no App Router do Next.js.
// Quando alguém acessa a URL principal (ex: https://seusite.com/),
// o Next.js automaticamente renderiza o componente exportado aqui.
//
// A única responsabilidade deste arquivo é mostrar o componente <Hotel />,
// que contém toda a página pública (cabeçalho, banner, formulário de
// reserva, informações de contato etc). Isso mantém page.tsx bem simples
// e joga a lógica "de verdade" para dentro de hotel.tsx.
// -----------------------------------------------------------------------

import Hotel from './hotel';

export default function Page() {
  return <Hotel />;
}
