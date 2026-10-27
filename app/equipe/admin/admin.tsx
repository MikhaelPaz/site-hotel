// app/equipe/admin/admin.tsx
// -----------------------------------------------------------------------
// PÁGINA DE ADMINISTRAÇÃO DOS LOGINS ("/equipe/admin").
// Permite CRIAR, ALTERAR (nome, e-mail, senha, perfil, bloqueio) e
// REMOVER os logins da área da equipe. Conversa com /api/usuarios
// (app/api/usuarios/route.ts), que só responde a administradores.
// -----------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Plus, ShieldCheck, Trash2, UserX, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import './admin.css';

type User = {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'equipe';
  active: number;
  lastLogin: string | null;
};

const empty = { name: '', username: '', password: '', role: 'equipe' as 'admin' | 'equipe' };

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'nunca entrou';

export default function Admin() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // id em edição (null = novo)
  const [form, setForm] = useState(empty);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/usuarios');
      const v: any = await r.json();
      if (r.status === 401) return router.push('/equipe/login');
      if (!r.ok) throw Error(v.error);
      setUsers(v.users);
      setMeId(v.meId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os logins.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Chamada genérica à API; devolve true se deu certo.
  async function call(method: string, body: object, success: string) {
    setError('');
    setOk('');
    try {
      const r = await fetch('/api/usuarios', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const v: any = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(v.error || 'Não foi possível concluir.');
      setOk(success);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
      return false;
    }
  }

  function startEdit(u: User) {
    setEditing(u.id);
    setForm({ name: u.name, username: u.username, password: '', role: u.role });
    setError('');
    setOk('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setEditing(null);
    setForm(empty);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const done = editing
      ? await call(
          'PATCH',
          {
            id: editing,
            name: form.name,
            username: form.username,
            role: form.role,
            ...(form.password ? { password: form.password } : {}),
          },
          'Login atualizado.',
        )
      : await call('POST', form, 'Login criado.');
    setSaving(false);
    if (done) reset();
  }

  async function sair() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/equipe/login');
  }

  return (
    <>
      <header>
        <a className="brand" href="/">
          <ShieldCheck size={35} />
          <span>
            HOTEL DE TRÂNSITO
            <small>12º BI Mth · Administração de logins</small>
          </span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button variant="outline" onClick={() => router.push('/equipe')}>
            <ArrowLeft size={16} /> Painel
          </Button>
          <button onClick={sair}>Sair</button>
        </div>
      </header>

      <main>
        <div className="eyebrow">ACESSO DA EQUIPE</div>
        <div className="page-heading">
          <div>
            <h1>Logins</h1>
            <p>Crie, altere ou remova quem pode entrar no painel do hotel.</p>
          </div>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {ok && (
          <p className="success" role="status">
            {ok}
          </p>
        )}

        {/* ------------------------ Formulário: novo / editar ------------------------ */}
        <section className="panel" style={{ marginTop: 20 }}>
          <h2>{editing ? 'Alterar login' : 'Novo login'}</h2>
          <form className="adm-form" onSubmit={save}>
            <div>
              <label htmlFor="adm-nome">Nome</label>
              <input
                id="adm-nome"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="adm-usuario">Usuário (usado para entrar)</label>
              <input
                id="adm-usuario"
                type="text"
                pattern="[A-Za-z0-9._\-]{3,30}"
                title="3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado"
                required
                autoComplete="off"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="adm-senha">{editing ? 'Nova senha' : 'Senha'}</label>
              <input
                id="adm-senha"
                type="password"
                autoComplete="new-password"
                required={!editing}
                minLength={editing ? undefined : 8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="adm-hint">
                {editing ? 'Deixe em branco para manter a senha atual. ' : ''}Mínimo de 8 caracteres.
              </p>
            </div>
            <div>
              <label htmlFor="adm-perfil">Perfil</label>
              <select
                id="adm-perfil"
                className="adm-select"
                value={form.role}
                disabled={editing === meId}
                onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'equipe' })}
              >
                <option value="equipe">Equipe (usa o painel)</option>
                <option value="admin">Administrador (também gerencia logins)</option>
              </select>
            </div>
            <div className="full actions" style={{ marginTop: 0 }}>
              <Button type="submit" disabled={saving}>
                {editing ? 'Salvar alterações' : (<><Plus size={16} /> Criar login</>)}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={reset}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </section>

        {/* ------------------------------ Lista de logins ------------------------------ */}
        {loading ? (
          <p role="status" style={{ marginTop: 28 }}>
            Carregando logins…
          </p>
        ) : (
          <div className="adm-list">
            {users.map((u) => {
              const me = u.id === meId;
              return (
                <div className="record adm-user" key={u.id}>
                  <div>
                    <h3>
                      {u.name}
                      {me && ' (você)'}
                    </h3>
                    <p>{u.username}</p>
                    <div className="adm-tags">
                      <span className="tag">{u.role === 'admin' ? 'Administrador' : 'Equipe'}</span>
                      {!u.active && <span className="tag adm-tag-off">Bloqueado</span>}
                      <span className="tag">Último acesso: {when(u.lastLogin)}</span>
                    </div>
                  </div>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <Button variant="outline" onClick={() => startEdit(u)}>
                      <Pencil size={16} /> Alterar
                    </Button>
                    {!me && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          call(
                            'PATCH',
                            { id: u.id, active: !u.active },
                            u.active ? 'Login bloqueado.' : 'Login liberado.',
                          )
                        }
                      >
                        {u.active ? (
                          <><UserX size={16} /> Bloquear</>
                        ) : (
                          <><UserCheck size={16} /> Liberar</>
                        )}
                      </Button>
                    )}
                    {!me && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline">
                            <Trash2 size={16} /> Remover
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover {u.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O usuário {u.username} será apagado e a pessoa perde o acesso na hora. Se for
                              só uma suspensão temporária, use “Bloquear”.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => call('DELETE', { id: u.id }, 'Login removido.')}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
