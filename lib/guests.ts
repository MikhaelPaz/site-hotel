// lib/guests.ts
// -----------------------------------------------------------------------
// Regras compartilhadas do CADASTRO DE HÓSPEDES (tabela "guests").
//
// A "chave" de um hóspede é "e-mail|nome", sem diferença entre maiúsculas
// e minúsculas e sem espaços nas pontas. Assim, quem reserva várias vezes
// (ou digita o nome com outra caixa) continua sendo UM só hóspede.
//
// ATENÇÃO: o SQLite (banco D1) só converte para minúscula as letras do
// alfabeto ASCII (A-Z). A migração drizzle/0001_guests.sql monta a chave
// com lower(trim(...)) do SQLite; por isso aqui usamos a MESMA regra
// (e não toLowerCase(), que também mudaria "É" para "é"). Se as duas
// regras divergissem, um hóspede antigo e um novo poderiam virar duplicados.
// -----------------------------------------------------------------------

const lowerAscii = (s: string) => s.replace(/[A-Z]+/g, (m) => m.toLowerCase());

export function guestKey(email: string, name: string) {
  return `${lowerAscii(email.trim())}|${lowerAscii(name.trim())}`;
}

// Formato de um hóspede devolvido por GET /api/hospedes.
export type Guest = {
  id: string;
  name: string;
  email: string;
  phone: string;
  created: string;
  updated: string;
};
