"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./login.css";

export default function LoginEquipe() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const router = useRouter();

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, senha }),
    });

    if (res.ok) {
      router.push("/equipe");
    } else {
      const v: any = await res.json().catch(() => ({}));
      alert(v.error || "Usuário e/ou senha incorreto");
    }
  }

  return (
    <main className="lg-page">
      <aside className="lg-side" aria-hidden="true">
        <div className="lg-plate">
          <span className="lg-plate-small">Acesso</span>
          <span className="lg-plate-big">Equipe</span>
        </div>
        <p className="lg-side-name">Hotel de Trânsito “Montanhas de Minas”</p>
      </aside>

      <section className="lg-panel">
        <form className="lg-form" noValidate onSubmit={entrar}>
          <h1>Entrar no painel</h1>
          <p className="lg-lead">
            Área restrita aos colaboradores do Hotel de Trânsito.
          </p>

          <label htmlFor="usuario">Usuário</label>
          <input
            id="usuario"
            type="text"
            autoComplete="username"
            placeholder="seu usuário"
            required
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />

          <label htmlFor="senha">Senha</label>
          <div className="lg-senha">
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          <button className="lg-enviar" type="submit">
            Entrar
          </button>

          {/* NOVO: botão para voltar à página inicial */}
          <button
            className="lg-voltar"
            type="button"
            onClick={() => router.push("/")}>
            ← Voltar à página inicial
          </button>

          <p className="lg-ajuda">
            Sem acesso? Fale com a gerência ou o setor de TI.
          </p>
        </form>
      </section>
    </main>
  );
}