// lib/rules.ts
// -----------------------------------------------------------------------
// Este arquivo é o "cérebro das regras de negócio" do hotel: preços,
// datas permitidas, e a validação de uma solicitação de reserva.
//
// Ele é usado tanto no formulário do cliente (app/booking-form.tsx)
// quanto na API do servidor (app/api/reservas/route.ts), garantindo que
// as MESMAS regras valham nos dois lados. Isso é importante: nunca se
// deve confiar só na validação feita no navegador, porque um usuário mal
// intencionado pode chamar a API diretamente. Por isso a função
// `validate` também roda de novo no servidor.
// -----------------------------------------------------------------------

// Valor da diária (em reais) para cada categoria/posto do hóspede.
// A "chave" (ex: 'sargento') é usada como identificador interno; o texto
// que aparece para o usuário está em `ranks`, logo abaixo.
export const rates: Record<string, number> = {
  general: 60, // oficial-general
  superior: 50, // oficial superior
  intermediario: 45, // oficial intermediário / subalterno / aspirante
  sargento: 40, // cadete / subtenente / sargento
  civil: 70, // civil (público habilitado)
};

// Rótulos amigáveis exibidos no <select> do formulário para cada posto.
export const ranks: Record<string, string> = {
  general: 'Oficial-general',
  superior: 'Oficial superior',
  intermediario: 'Oficial intermediário / subalterno / aspirante',
  sargento: 'Cadete / subtenente / sargento',
  civil: 'Civil (público habilitado)',
};

// Formata um número como moeda brasileira, ex: 60 -> "R$ 60,00".
export const money = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Retorna a data de HOJE no fuso horário de São Paulo, no formato
// "AAAA-MM-DD" (o mesmo formato usado pelos campos <input type="date">).
// Usar Intl.DateTimeFormat garante que o "hoje" seja sempre o de Belo
// Horizonte, e não o fuso do computador de quem está acessando o site.
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Calcula a última data de entrada permitida: 1 mês a partir de `now`.
// Regra do hotel: só é possível reservar entrada em até um mês de
// antecedência. A conta usa Date.UTC(y, m, ...) — como o mês em
// JavaScript é 0-indexado, "m" (mês atual) na prática já representa o
// mês seguinte, e o Math.min garante que não estouremos o último dia
// válido daquele mês (ex: pedir dia 31 num mês que só tem 30).
export function maxArrival(now = today()) {
  const [y, m, d] = now.split('-').map(Number);
  const lastDayOfNextMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(y, m, Math.min(d, lastDayOfNextMonth)),
  )
    .toISOString()
    .slice(0, 10);
}

// Quantidade de diárias (noites) entre duas datas "AAAA-MM-DD".
// 86400000 é o número de milissegundos em um dia.
export function nights(start: string, end: string) {
  return (
    (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) /
    86400000
  );
}

// Calcula o orçamento estimado da estadia a partir dos dados da reserva
// (b = "booking"). A diária sobe 25% por dependente extra e 50% por
// acompanhante sem vínculo de dependência.
export function estimate(b: any) {
  const base = rates[b.rank];
  const daily =
    base * (1 + Number(b.dependents || 0) * 0.25 + Number(b.others || 0) * 0.5);
  return {
    base, // valor "puro" da diária pelo posto, sem acréscimos
    daily, // valor da diária já com os acréscimos de acompanhantes
    nights: nights(b.start, b.end),
    total: daily * nights(b.start, b.end),
  };
}

// Valida uma solicitação de reserva por completo, lançando um erro (com
// mensagem em português, pronta para mostrar ao usuário) assim que
// encontra o primeiro problema. Se tudo estiver certo, devolve o
// orçamento calculado por `estimate`.
//
// `staff` indica se quem está enviando é um membro da equipe (usado, por
// exemplo, para liberar a finalidade "comando", que o público em geral
// não pode escolher).
export function validate(b: any, staff = false) {
  if (!b || typeof b !== 'object') throw Error('Solicitação inválida.');

  // Campos de texto obrigatórios: precisam existir, não estar vazios e
  // ter no máximo 160 caracteres.
  for (const k of ['name', 'email', 'phone', 'start', 'end', 'rank', 'purpose']) {
    if (typeof b[k] !== 'string' || !b[k].trim() || b[k].length > 160) {
      throw Error('Preencha todos os campos obrigatórios.');
    }
  }

  // Validação simples de formato de e-mail (não é 100% RFC-completa,
  // mas cobre bem os casos comuns).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) {
    throw Error('Informe um e-mail válido.');
  }

  // As datas devem estar no formato AAAA-MM-DD e ser datas "reais"
  // (ex: rejeita 2024-02-30, que não existe).
  for (const k of ['start', 'end']) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(b[k]) ||
      new Date(b[k] + 'T00:00:00Z').toISOString().slice(0, 10) !== b[k]
    ) {
      throw Error('Data inválida.');
    }
  }

  // A entrada deve estar entre hoje e o limite de 1 mês (regra do hotel).
  if (b.start < today() || b.start > maxArrival()) {
    throw Error('A entrada deve ocorrer entre hoje e um mês a partir de hoje.');
  }

  // A estadia deve durar entre 1 e 20 diárias.
  const n = nights(b.start, b.end);
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    throw Error('A permanência deve ser de 1 a 20 diárias.');
  }

  // O posto/graduação informado precisa existir na tabela de tarifas.
  if (!Object.hasOwn(rates, b.rank)) {
    throw Error('Referência de tarifa inválida.');
  }

  // Finalidade da hospedagem: só "geral" e "saude" são liberadas para o
  // público; "comando" só pode ser escolhida pela equipe (staff = true).
  if (
    !['geral', 'saude', 'comando'].includes(b.purpose) ||
    (b.purpose === 'comando' && !staff)
  ) {
    throw Error('Destinação não permitida.');
  }

  // Pedidos do tipo "comando" precisam declarar quem autorizou o pedido.
  if (
    b.purpose === 'comando' &&
    !['Comandante do Batalhão', 'Chefe da Comunicação Social'].includes(
      b.requestedBy,
    )
  ) {
    throw Error('Informe a origem autorizada do pedido do Q01.');
  }

  // Quantidade de acompanhantes: cada categoria aceita de 0 a 2 pessoas.
  for (const k of ['dependents', 'others', 'children']) {
    if (!Number.isInteger(b[k]) || b[k] < 0 || b[k] > 2) {
      throw Error('Quantidade de hóspedes inválida.');
    }
  }

  // O total de pessoas (responsável + acompanhantes) não pode passar de 3,
  // que é a capacidade máxima de um quarto.
  if (1 + b.dependents + b.others + b.children > 3) {
    throw Error('Número de hóspedes excede a capacidade do quarto.');
  }

  if (!['PIX', 'GRU', 'A definir'].includes(b.payment)) {
    throw Error('Forma de pagamento inválida.');
  }

  // Configuração de camas: entre 1 e 3 camas no total.
  if (
    !Number.isInteger(b.doubleBeds) ||
    !Number.isInteger(b.singleBeds) ||
    b.doubleBeds < 0 ||
    b.singleBeds < 0 ||
    b.doubleBeds + b.singleBeds < 1 ||
    b.doubleBeds + b.singleBeds > 3
  ) {
    throw Error('Informe de 1 a 3 camas desejadas para o grupo.');
  }

  // Regra específica de hospedagem de saúde ("D Sau"): só camas de
  // solteiro (1 a 3), nunca cama de casal.
  if (
    b.purpose === 'saude' &&
    (b.doubleBeds !== 0 || b.singleBeds < 1 || b.singleBeds > 3)
  ) {
    throw Error(
      'Pacientes D Sau: selecione de 1 a 3 camas de solteiro, sem cama de casal.',
    );
  }

  // Regra da hospedagem geral: no máximo 1 cama de casal e 2 de solteiro.
  if (b.purpose !== 'saude' && (b.doubleBeds > 1 || b.singleBeds > 2)) {
    throw Error(
      'Hospedagem geral: no máximo 1 cama de casal e 2 camas de solteiro.',
    );
  }

  // O usuário precisa confirmar que leu as regras e que se enquadra no
  // público atendido pelo hotel.
  if (b.eligible !== true) {
    throw Error('Confirme o enquadramento no público atendido.');
  }

  // Se passou por todas as checagens acima, calcula e devolve o
  // orçamento da estadia.
  return estimate(b);
}
