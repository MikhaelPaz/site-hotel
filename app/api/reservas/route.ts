// app/api/reservas/route.ts
// -----------------------------------------------------------------------
// API de RESERVAS (responde em "/api/reservas").
//
//   GET   /api/reservas -> lista todas as reservas
//   POST  /api/reservas -> cria uma nova solicitação
//   PATCH /api/reservas -> altera a situação de uma reserva
//
// ATENÇÃO: nesta versão a verificação de login foi REMOVIDA (útil para
// testes locais). Antes de publicar, recoloque uma autenticação real,
// senão qualquer visitante poderá listar, aprovar e cancelar reservas.
// -----------------------------------------------------------------------

import { database, sameOrigin } from '@/lib/server';

import { validate, estimate, rates, today } from '@/lib/rules';
import { guestKey } from '@/lib/guests';

// Identificação registrada na coluna "updated_by" enquanto não há login.
const ACTOR = 'equipe';

// =====================================================================
// GET — lista todas as reservas cadastradas.
// =====================================================================
export async function GET() {
  try {
    const r = await database()
      .prepare('SELECT * FROM bookings ORDER BY created DESC')
      .all();
    // A coluna "data" é salva como texto JSON; aqui voltamos para objeto.
    return Response.json(
      { bookings: r.results.map((b: any) => ({ ...b, data: JSON.parse(b.data) })) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: 'Não foi possível carregar as reservas.' },
      { status: 503 },
    );
  }
}

// =====================================================================
// POST — cria uma nova solicitação de reserva.
// =====================================================================
export async function POST(req: Request) {
  // Proteção simples contra CSRF: só aceita pedidos da mesma origem.
  if (!sameOrigin(req)) {
    return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  }
  try {
    const raw: any = await req.json();

    // Sem login não dá para distinguir equipe de visitante; por isso
    // tratamos todos como equipe (apenas para testes).
    const staff = true;

    // Valida tudo novamente no servidor.
    validate(raw, staff);

    const id = crypto.randomUUID(); // "protocolo" da reserva

    // Campos sem coluna própria ficam agrupados no JSON da coluna "data".
    const b = {
      doubleBeds: raw.doubleBeds,
      singleBeds: raw.singleBeds,
      rank: raw.rank,
      dependents: raw.dependents,
      others: raw.others,
      children: raw.children,
      payment: raw.payment,
      source: staff && raw.source === 'E-mail' ? 'E-mail' : 'Site',
      requestedBy: raw.purpose === 'comando' ? raw.requestedBy : null,
      civilArmy: raw.civilArmy === true,
      couple: raw.couple === true,
      quote: estimate(raw), // orçamento calculado no momento do pedido
      discount: 0,
      discountReference: '',
      consumption: 0,
      paid: false,
    };

    const name = raw.name.trim();
    const email = raw.email.trim();
    const phone = raw.phone.trim();
    const key = guestKey(email, name);
    const now = new Date().toISOString();
    const db = database();

    // Valores da reserva, na ordem das colunas de "bookings" (sem guest_id).
    const bookingValues = [
      id,
      name,
      email,
      phone,
      raw.start,
      raw.end,
      raw.purpose,
      'Pendente', // toda reserva nova começa como "Pendente"
      JSON.stringify(b),
      now,
    ];

    // Duas operações numa só transação (batch): primeiro grava/atualiza o
    // hóspede no cadastro (tabela "guests"); depois grava a reserva ligada
    // a ele. Se uma falhar, nenhuma é salva.
    try {
      await db.batch([
        // Hóspede novo -> cria. Hóspede que já existe (mesma chave) -> só
        // atualiza nome, e-mail e telefone para os dados mais recentes.
        db
          .prepare(
            'INSERT INTO guests (id,key,name,email,phone,created,updated) VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,updated=excluded.updated',
          )
          .bind(crypto.randomUUID(), key, name, email, phone, now, now),
        db
          .prepare(
            'INSERT INTO bookings (id,name,email,phone,start,end,purpose,status,data,created,guest_id) VALUES (?,?,?,?,?,?,?,?,?,?,(SELECT id FROM guests WHERE key=?))',
          )
          .bind(...bookingValues, key),
      ]);
    } catch (e) {
      // Banco ainda SEM a migração de hóspedes (drizzle/0001_guests.sql):
      // não deixamos a reserva falhar por isso. Gravamos só a reserva e
      // avisamos no log; o cadastro de hóspedes passa a funcionar assim
      // que a migração for aplicada.
      if (!/no such table: guests|guest_id/i.test(String(e instanceof Error ? e.message : e))) {
        throw e;
      }
      console.error(
        '[reservas POST] Migração 0001_guests não aplicada; reserva salva sem cadastro de hóspede.',
      );
      await db
        .prepare(
          'INSERT INTO bookings (id,name,email,phone,start,end,purpose,status,data,created) VALUES (?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(...bookingValues)
        .run();
    }

    return Response.json({ id, quote: b.quote }, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json(
      {
        // Mensagens da nossa validação são mostradas; erros técnicos do
        // banco (D1) ficam escondidos atrás de uma mensagem genérica.
        error:
          e instanceof Error && !e.message.includes('D1')
            ? e.message
            : 'Não foi possível salvar. Tente novamente.',
      },
      { status: 400 },
    );
  }
}


export async function DELETE(req: Request) {
  if (!sameOrigin(req)) {
    return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  }
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return Response.json({ error: 'Reserva não informada.' }, { status: 400 });

    // A checagem de status fica no servidor, para não depender só do botão.
    const result = await database()
      .prepare("DELETE FROM bookings WHERE id = ? AND status = 'Recusada'")
      .bind(id)
      .run();

    if (!result.meta?.changes)
      return Response.json({ error: 'Só é possível excluir reservas recusadas.' }, { status: 400 });

    return Response.json({ ok: true });
  } catch (e) {
    console.error('[reservas DELETE]', e);
    return Response.json({ error: 'Não foi possível excluir.' }, { status: 500 });
  }
}


// =====================================================================
// PATCH — altera a SITUAÇÃO de uma reserva existente (aprovar, recusar,
// check-in, check-out, cancelar...).
//
// Máquina de estados: cada situação só pode avançar para algumas
// situações específicas, definidas em transitions.
// =====================================================================
export async function PATCH(req: Request) {
  if (!sameOrigin(req)) {
    return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  }
  try {
    const p: any = await req.json();
    const db = database();

    const b: any = await db
      .prepare('SELECT * FROM bookings WHERE id=?')
      .bind(String(p.id))
      .first();
    if (!b) return Response.json({ error: 'Reserva não encontrada.' }, { status: 404 });

    // Situação atual -> situações para as quais ela PODE avançar.
    const transitions: Record<string, string[]> = {
      Pendente: ['Aprovada', 'Recusada'],
      Aprovada: ['Hospedado', 'Cancelada'],
      Hospedado: ['Concluída'],
      Concluída: ['Concluída'],
    };
    if (!transitions[b.status]?.includes(p.status)) {
      throw Error('Alteração de situação inválida.');
    }

    // Carrega os campos extras salvos no POST para alterar e regravar.
    const d = JSON.parse(b.data);

    // Check-in só é permitido durante o período reservado.
    if (p.status === 'Hospedado' && (today() < b.start || today() >= b.end)) {
      throw Error('O check-in deve ser registrado durante o período reservado.');
    }

    if (p.status === 'Aprovada') {
      // --------------------- Fluxo de APROVAÇÃO ---------------------
      if (b.start < today()) {
        throw Error(
          'A entrada solicitada já passou. Registre uma nova solicitação com as datas corretas.',
        );
      }

      // "comando" -> Q01, Q02, Q03 ou Q04 "saude" -> Q04, geral -> Q01, Q02 ou Q03.
      const allowed =
        b.purpose === 'comando' ? ['Q01', 'Q02', 'Q03', 'Q04'] : b.purpose === 'saude' ? ['Q04'] : ['Q01', 'Q02', 'Q03'];
      if (!allowed.includes(p.room)) {
        throw Error('Quarto incompatível com a destinação.');
      }
      if (!Object.hasOwn(rates, p.rank)) {
        throw Error('Confira a referência da diária.');
      }

      // Reduções (50% a 100%) só valem para hospedagem de saúde e exigem
      // referência de parecer social.
      const discount = Number(p.discount);
      if (
        discount !== 0 &&
        (b.purpose !== 'saude' ||
          discount < 50 ||
          discount > 100 ||
          !String(p.discountReference || '').trim())
      ) {
        throw Error(
          'Reduções de 50% a 100% exigem parecer social e hospedagem de saúde.',
        );
      }

      // Atualiza posto conferido, orçamento recalculado e desconto.
      d.rank = p.rank;
      d.quote = estimate({ ...b, ...d });
      d.discount = discount;
      d.discountReference = String(p.discountReference || '').slice(0, 120);

      // Só aprova se NÃO existir outra reserva "Aprovada"/"Hospedado" no
      // mesmo quarto com datas sobrepostas (evita reserva dupla mesmo com
      // aprovações quase simultâneas).
      const result = await db
        .prepare(
          "UPDATE bookings SET status='Aprovada',room=?,data=?,updated_by=? WHERE id=? AND status='Pendente' AND NOT EXISTS (SELECT 1 FROM bookings x WHERE x.room=? AND x.status IN ('Aprovada','Hospedado') AND x.start < ? AND x.end > ?)",
        )
        .bind(p.room, JSON.stringify(d), ACTOR, b.id, p.room, b.end, b.start)
        .run();

      if (!result.meta.changes) {
        throw Error('O quarto já está reservado nesse período ou a solicitação foi alterada.');
      }
    } else {
      // --------- Demais transições (recusar, check-in, cancelar, ---------
      // --------- concluir/check-out)                             ---------
      if (p.status === 'Concluída') {
        // No check-out registramos consumos extras e pagamento.
        const consumption = Number(p.consumption);
        if (!Number.isFinite(consumption) || consumption < 0 || consumption > 100000) {
          throw Error('Valor de consumo inválido.');
        }
        if (!['PIX', 'GRU'].includes(p.payment)) {
          throw Error('Selecione PIX ou GRU.');
        }
        d.consumption = consumption;
        d.payment = p.payment;
        d.paid = p.paid === true;

        // Dados do CONTROLE ORÇAMENTÁRIO (aba do painel da equipe):
        //  - valor efetivamente pago pelo hóspede (obrigatório quando o
        //    pagamento é conferido; pode ser 0, por ex. em reduções de 100%);
        //  - número de referência (da GRU, do PIX etc.), texto livre e
        //    opcional. Ficam guardados dentro de "data" da própria reserva.
        const blank = p.paidAmount === '' || p.paidAmount == null;
        const paidAmount = blank ? null : Math.round(Number(p.paidAmount) * 100) / 100;
        if (
          paidAmount !== null &&
          (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > 1000000)
        ) {
          throw Error('Valor pago inválido.');
        }
        if (d.paid && paidAmount === null) {
          throw Error('Informe o valor pago para registrar o pagamento como conferido.');
        }
        const paymentReference = String(p.paymentReference ?? '').trim();
        if (paymentReference.length > 60) {
          throw Error('O número de referência deve ter no máximo 60 caracteres.');
        }
        d.paidAmount = paidAmount;
        d.paymentReference = paymentReference;
      }

      // Atualização simples, protegida contra condição de corrida (só
      // aplica se o status no banco ainda for o que lemos).
      const result = await db
        .prepare('UPDATE bookings SET status=?,data=?,updated_by=? WHERE id=? AND status=?')
        .bind(p.status, JSON.stringify(d), ACTOR, b.id, b.status)
        .run();
      if (!result.meta.changes) {
        throw Error('A reserva foi alterada. Atualize a página.');
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: e instanceof Error ? e.message : 'Não foi possível alterar a reserva.' },
      { status: 400 },
    );
  }
}