// app/equipe/hospedes.tsx
// -----------------------------------------------------------------------
// Aba "Hóspedes" do painel da equipe: mostra o cadastro de hóspedes
// (nome, e-mail e telefone, tabela "guests") e permite PESQUISAR por
// qualquer um desses dados. Cada hóspede pode ser aberto para ver o
// histórico de reservas dele.
//
// O cadastro é alimentado automaticamente quando uma reserva é registrada
// (POST em app/api/reservas/route.ts). Os dados chegam por props do
// componente Staff (app/equipe/staff.tsx), que os busca em /api/hospedes.
// -----------------------------------------------------------------------

'use client';

import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import type { Guest } from '@/lib/guests';

// "AAAA-MM-DD" -> "DD/MM/AAAA".
const date = (s: string) => s.split('-').reverse().join('/');

// Data ISO (com hora) -> "DD/MM/AAAA" no horário de São Paulo.
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// Deixa o texto em minúsculas e sem acentos, para a busca encontrar
// "joao" ao procurar por "João".
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Só os números: "(31) 99999-1234" -> "31999991234".
const digits = (s: string) => s.replace(/\D/g, '');

// Uma pesquisa pode ter várias palavras ("maria gmail"); todas precisam
// aparecer em algum dado do hóspede (nome, e-mail ou telefone). Números de
// telefone são comparados sem pontuação, então "99999 1234" também acha.
function matches(g: Guest, query: string) {
  const text = norm(`${g.name} ${g.email} ${g.phone}`);
  const phone = digits(g.phone);
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => {
      if (text.includes(norm(token))) return true;
      const d = digits(token);
      return d.length > 0 && phone.includes(d);
    });
}

export default function Hospedes({
  guests,
  rows,
  loading,
  error,
}: {
  guests: Guest[];
  rows: any[]; // reservas (para o histórico de cada hóspede)
  loading: boolean;
  error: string;
}) {
  const [q, setQ] = useState('');

  // Reservas agrupadas por hóspede, da mais recente para a mais antiga.
  const history = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      if (!r.guest_id) continue;
      map.set(r.guest_id, [...(map.get(r.guest_id) || []), r]);
    }
    for (const list of map.values()) list.sort((a, b) => b.start.localeCompare(a.start));
    return map;
  }, [rows]);

  // Ordem alfabética (como numa agenda de contatos).
  const shown = useMemo(
    () =>
      guests
        .filter((g) => matches(g, q))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
    [guests, q],
  );

  return (
    <section style={{ marginTop: 24 }}>
      <div className="field-grid" style={{ maxWidth: 700, marginBottom: 8 }}>
        <label>
          Pesquisar hóspede
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, e-mail ou telefone"
            autoComplete="off"
          />
        </label>
      </div>
      <p className="fine" role="status" style={{ marginBottom: 16 }}>
        {loading
          ? 'Carregando hóspedes…'
          : q.trim()
            ? `${shown.length} de ${guests.length} hóspede(s)`
            : `${guests.length} hóspede(s) cadastrado(s)`}
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="records">
        {!loading &&
          shown.map((g) => {
            const list = history.get(g.id) || [];
            return (
              <article className="record" key={g.id}>
                <div className="record-top">
                  <div>
                    <h3 style={{ margin: 0 }}>{g.name}</h3>
                    <p>
                      <a href={'mailto:' + g.email}>{g.email}</a> ·{' '}
                      <a href={'tel:' + g.phone}>{g.phone}</a>
                    </p>
                  </div>
                  <span className="tag">{list.length} reserva(s)</span>
                </div>
                <p className="fine">Cadastrado em {day(g.created)}</p>

                {list.length > 0 && (
                  <details>
                    <summary style={{ cursor: 'pointer' }}>Ver histórico de reservas</summary>
                    {list.map((r) => (
                      <p key={r.id}>
                        {date(r.start)} → {date(r.end)} · {r.room || 'Quarto a definir'} ·{' '}
                        {r.status}
                      </p>
                    ))}
                  </details>
                )}
              </article>
            );
          })}

        {!loading && !error && shown.length === 0 && (
          <section className="panel">
            <Users />
            <h2>{guests.length === 0 ? 'Nenhum hóspede cadastrado' : 'Nenhum hóspede encontrado'}</h2>
            <p>
              {guests.length === 0
                ? 'Os hóspedes são cadastrados automaticamente quando uma reserva é registrada.'
                : 'Confira a grafia ou tente buscar só por parte do nome, e-mail ou telefone.'}
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
