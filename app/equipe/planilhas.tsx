// app/equipe/planilhas.tsx
// -----------------------------------------------------------------------
// Atalhos para as planilhas do Google usadas pela equipe do hotel.
// Para adicionar/remover uma planilha, edite apenas a lista PLANILHAS.
// -----------------------------------------------------------------------

'use client';

import { useState } from 'react';
import { ExternalLink, Eye, EyeOff, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Planilha = {
  id: string;
  nome: string;
  descricao: string;
  url: string; // link normal da planilha (o mesmo que você copia do navegador)
};

// >>> EDITE AQUI: coloque as planilhas reais do hotel <<<
const PLANILHAS: Planilha[] = [
  {
    id: 'escala',
    nome: 'Controle de hospedes',
    descricao: 'Controle de hospedes',
    url: 'https://docs.google.com/spreadsheets/d/10QLPQMpbHynBr1-wSkFzXVOlG7NjkOI2ZkPn7w_kiwA/edit?gid=1954877790#gid=1954877790',
  },
  
];

// Transforma o link comum em um link próprio para exibir dentro da página
// (versão enxuta, sem menus do Google).
function embedUrl(url: string) {
  return url.split('/edit')[0] + '/edit?rm=minimal';
}

export default function Planilhas() {
  // Guarda qual planilha está aberta na visualização embutida (só uma por vez).
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <div className="records" style={{ marginTop: 24 }}>
      {PLANILHAS.map((p) => {
        const visivel = aberta === p.id;
        return (
          <article className="record" key={p.id}>
            <div className="record-top">
              <div>
                <h3 style={{ margin: 0 }}>
                  <FileSpreadsheet size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  {p.nome}
                </h3>
                <p>{p.descricao}</p>
              </div>
            </div>

            <div className="actions">
              <Button asChild>
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} /> Abrir no Google Planilhas
                </a>
              </Button>
              <Button variant="outline" onClick={() => setAberta(visivel ? null : p.id)}>
                {visivel ? <EyeOff size={16} /> : <Eye size={16} />}
                {visivel ? ' Ocultar' : ' Visualizar aqui'}
              </Button>
            </div>

            {visivel && (
              <>
                <iframe
                  src={embedUrl(p.url)}
                  title={p.nome}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: 600,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    marginTop: 16,
                  }}
                />
                <p className="fine">
                  Se a planilha não carregar aqui, entre na sua conta Google
                  autorizada neste navegador ou use “Abrir no Google Planilhas”.
                </p>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}