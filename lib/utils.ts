// lib/utils.ts
// -----------------------------------------------------------------------
// Função utilitária padrão em projetos que usam shadcn/ui + Tailwind CSS.
// `cn` (de "className") combina várias classes CSS condicionais em uma
// única string, removendo conflitos (ex: se você passar "p-2" e depois
// "p-4", o tailwind-merge garante que só "p-4" sobrevive, em vez de
// aplicar as duas e deixar o resultado imprevisível).
//
// Exemplo de uso: cn('botao', isAtivo && 'botao-ativo', 'p-2')
// -----------------------------------------------------------------------

import { clsx, type ClassValue } from 'clsx'; // junta classes e ignora valores falsy (false, null, undefined)
import { twMerge } from 'tailwind-merge'; // resolve conflitos entre classes do Tailwind

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
