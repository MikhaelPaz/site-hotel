// hooks/use-mobile.ts
// -----------------------------------------------------------------------
// Hook React reutilizável que informa se a tela atual é "de celular"
// (largura menor que 768px). Usado por componentes de UI (da pasta
// components/ui) que precisam se comportar diferente em telas pequenas,
// como menus que viram um "drawer" (gaveta) no mobile.
// -----------------------------------------------------------------------

import * as React from 'react';

const MOBILE_BREAKPOINT = 768; // ponto de corte, em pixels, entre "mobile" e "desktop"

export function useIsMobile() {
  // Começa como "undefined" porque, durante a primeira renderização no
  // servidor, não sabemos o tamanho da tela do usuário. Só depois que o
  // componente "monta" no navegador (useEffect) é que conseguimos ler
  // window.innerWidth de verdade.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // matchMedia cria um "ouvinte" que dispara sempre que a tela cruza
    // esse limite de 768px (ex: ao girar o celular ou redimensionar a
    // janela), sem precisarmos ficar checando o tamanho manualmente.
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    onChange(); // já calcula o valor inicial assim que monta no navegador
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Converte "undefined" em "false" no valor devolvido, para o
  // componente que usa este hook não precisar lidar com três estados.
  return !!isMobile;
}
