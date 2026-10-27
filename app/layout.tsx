// app/layout.tsx
// -----------------------------------------------------------------------
// No App Router do Next.js, o "layout" é o "molde" que envolve TODAS as
// páginas do site. Aqui é onde ficam a tag <html>, a tag <body> e
// qualquer coisa que deva aparecer em todas as telas (ex: um menu fixo).
//
// Neste projeto o layout é bem enxuto: só define o idioma da página
// (português do Brasil), importa o CSS global e configura os metadados
// que aparecem na aba do navegador (título, descrição, ícone).
// -----------------------------------------------------------------------

import type { Metadata } from 'next';
import './globals.css'; // estilos que valem para o site inteiro

// "metadata" é uma convenção especial do Next.js: ele lê este objeto
// automaticamente e gera as tags <title>, <meta description> e <link
// rel="icon"> dentro do <head> da página, sem precisarmos escrever HTML.
export const metadata: Metadata = {
  title: 'Hotel de Trânsito | 12º BI Mth',
  description: 'Solicitações de hospedagem em Belo Horizonte.',
  icons: { icon: '/favicon.svg' },
};

// Todo componente de layout recebe "children": é o conteúdo da página
// atual (por exemplo, o que está em app/page.tsx) que será encaixado
// aqui dentro do <body>.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" translate="no">
      <body>{children}</body>
    </html>
  );
}


